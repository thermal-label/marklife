/**
 * BLE transport for the marklife family: the stock
 * `WebBluetoothTransport` plus Profile A flow control.
 *
 * Profile A chassis gate their intake on a **credit** counter
 * published on a third characteristic (`cx`, `ff03`). Writing past
 * the granted credit silently drops raster on the floor — the job
 * looks sent and nothing comes out of the head. The stock transport
 * has no notion of a third characteristic, so this class wraps it:
 * connect, `read`, `close` and the RX buffer are the stock ones, and
 * only the gate is local.
 *
 * Framing on `cx`, from our own on-the-wire analysis and documented
 * independently by thermoprint (REVERSE_ENGINEERING.md § 2.5):
 *
 * ```
 *   02 lo hi   MTU announcement — payload size is MTU - 3
 *   01 n       credit grant: n more packets may be written
 * ```
 *
 * The first grant is `01 04`, i.e. four packets in flight. Every
 * packet written costs one credit, and the printer grants more as it
 * drains. Profiles B, C and D expose no `cx`; they are constructed
 * with no gate and write freely.
 *
 * Chunking and pacing are the printer's job (`pacingFor` in core):
 * it hands this transport one packet at a time. A larger write is
 * still split at the packet ceiling, one credit per packet.
 */
import { TransportClosedError, type Transport } from '@thermal-label/contracts';
import { WebBluetoothTransport } from '@thermal-label/transport/web';
import type { ProfileId, ResolvedProfile } from './ble-profiles.js';

/** Ceiling when the registry declares none — the family's usual value. */
const DEFAULT_MAX_PACKET = 237;
/** The printer's opening grant. Also the ceiling we let it reach. */
const INITIAL_CREDIT = 4;
/**
 * How long to sit on an ungranted credit before assuming the grant
 * was lost and sending anyway. The same 1 s thermoprint documents
 * (REVERSE_ENGINEERING.md § 2.5).
 */
const CREDIT_STALL_MS = 1_000;

export class MarklifeBleTransport implements Transport {
  /** Which GATT profile resolved — surfaced for triage reports. */
  readonly profileId: ProfileId;

  private readonly inner: WebBluetoothTransport;
  private readonly device: BluetoothDevice;
  private readonly cx: BluetoothRemoteGATTCharacteristic | undefined;

  /**
   * Packet size actually used. Starts at the chassis ceiling and is
   * only ever lowered — by an MTU announcement that says the link
   * carries less.
   *
   * It must NOT start at the BLE 4.0 20-byte floor waiting to be
   * raised: only Profile A ever announces an MTU, so every other
   * profile would sit at 20 bytes forever.
   */
  private mtu: number;
  /**
   * Hard ceiling on packet size, from the registry.
   *
   * A negotiated MTU is what the *link* will carry; this is what the
   * *firmware* will accept, and the two are not the same. The S2
   * announces MTU 179 but drops anything over 95 bytes — the job is
   * taken, acked, and silently not printed. So the announcement may
   * only ever lower the packet size, never raise it above this.
   */
  private readonly maxPacket: number;
  private credit: number;
  private creditWaiters: (() => void)[] = [];
  /**
   * Flipped synchronously at the top of `close()`, before anything is
   * awaited. A writer woken by that close re-checks liveness on its
   * next tick, which is before the inner transport has closed — this
   * is what it sees.
   */
  private closed = false;

  private readonly onCx = (event: Event): void => {
    const view = (event.target as BluetoothRemoteGATTCharacteristic).value;
    if (!view) return;
    if (view.byteLength === 3 && view.getUint8(0) === 0x02) {
      // Little-endian MTU, minus the 3-byte ATT write header, then
      // clamped to what the firmware actually accepts.
      const announced = (view.getUint8(2) << 8) + view.getUint8(1);
      if (announced > 3) this.mtu = Math.min(announced - 3, this.maxPacket);
      return;
    }
    if (view.byteLength === 2 && view.getUint8(0) === 0x01) {
      const granted = view.getUint8(1);
      // The opening grant sets the window rather than adding to it;
      // later grants top it up as the printer drains.
      this.credit = granted === INITIAL_CREDIT ? INITIAL_CREDIT : this.credit + granted;
      this.releaseCreditWaiters();
    }
  };

  private readonly onDisconnected = (): void => {
    this.closed = true;
    this.abandonCreditWaiters();
  };

  private constructor(device: BluetoothDevice, resolved: ResolvedProfile, maxPacket: number) {
    // The inner transport is sized to the ceiling so a packet handed
    // to it goes out as one write, never re-split.
    this.inner = WebBluetoothTransport.fromCharacteristics(
      device,
      resolved.tx,
      resolved.rx,
      maxPacket,
    );
    this.device = device;
    this.maxPacket = maxPacket;
    this.mtu = maxPacket;
    this.profileId = resolved.profile.id;
    this.cx = resolved.cx;
    // No flow-control characteristic means an unthrottled peripheral:
    // start with an effectively open window.
    this.credit = resolved.cx === undefined ? Number.POSITIVE_INFINITY : 0;

    device.addEventListener('gattserverdisconnected', this.onDisconnected);
    this.cx?.addEventListener('characteristicvaluechanged', this.onCx);
  }

  /**
   * Wrap a probed profile on an already-connected device, starting
   * notifications on RX (and on the credit channel when present).
   *
   * @param maxPacket — the registry's `bluetooth-gatt.mtu`, the
   *   firmware's packet ceiling.
   */
  static async open(
    device: BluetoothDevice,
    resolved: ResolvedProfile,
    maxPacket: number = DEFAULT_MAX_PACKET,
  ): Promise<MarklifeBleTransport> {
    const transport = new MarklifeBleTransport(device, resolved, maxPacket);
    await resolved.rx.startNotifications();
    if (resolved.cx) {
      // Must be running before the first write — the opening credit
      // grant arrives unprompted and would otherwise be missed,
      // leaving every write blocked on a window that never opens.
      await resolved.cx.startNotifications();
    }
    return transport;
  }

  get connected(): boolean {
    return !this.isClosed();
  }

  /**
   * Liveness as a call rather than a field read. `closed` flips from
   * an event handler during an `await`, which control-flow narrowing
   * cannot see — it decides the field is still `false` and calls
   * every later check dead. Going through a method keeps the check
   * honest at runtime and un-narrowed at compile time.
   */
  private isClosed(): boolean {
    return this.closed || !this.inner.connected;
  }

  async write(data: Uint8Array): Promise<void> {
    // Captured once: an announcement landing mid-write must not move
    // the stride under a chunk already sent.
    const mtu = this.mtu;
    for (let offset = 0; offset < data.length; offset += mtu) {
      // Re-checks liveness every iteration: the link can drop while
      // we are parked waiting for a credit.
      await this.acquireCredit();
      await this.inner.write(data.subarray(offset, offset + mtu));
    }
  }

  read(length: number, timeout?: number): Promise<Uint8Array> {
    return this.inner.read(length, timeout);
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    // Wake any blocked writer before tearing down, so a close during
    // a credit wait ends the write now rather than a stall-timeout
    // later.
    this.abandonCreditWaiters();
    this.cx?.removeEventListener('characteristicvaluechanged', this.onCx);
    this.device.removeEventListener('gattserverdisconnected', this.onDisconnected);
    try {
      if (this.cx) await this.cx.stopNotifications();
    } catch {
      // Already gone — not fatal for close().
    }
    await this.inner.close();
  }

  /**
   * Block until the printer has granted room for one more packet.
   * Doubles as the per-packet liveness check for `write()`.
   *
   * A stalled grant is not treated as failure. Grants arrive as BLE
   * notifications, which are unacknowledged and do go missing, and
   * aborting on one lost notification fails a print that was
   * otherwise healthy. So after a stall we self-grant a packet and
   * carry on, as thermoprint's implementation does. Only a closed
   * link ends a write.
   */
  private async acquireCredit(): Promise<void> {
    if (this.isClosed()) throw new TransportClosedError('bluetooth-gatt');
    if (this.cx === undefined) return;
    if (this.credit > 0) {
      this.credit -= 1;
      return;
    }
    await new Promise<void>(resolve => {
      const timer = setTimeout(() => {
        this.creditWaiters = this.creditWaiters.filter(w => w !== onGrant);
        this.credit = Math.max(this.credit, 1);
        resolve();
      }, CREDIT_STALL_MS);
      const onGrant = (): void => {
        clearTimeout(timer);
        resolve();
      };
      this.creditWaiters.push(onGrant);
    });
    if (this.isClosed()) throw new TransportClosedError('bluetooth-gatt');
    this.credit -= 1;
  }

  /**
   * Wake every blocked writer, ignoring the credit count.
   *
   * Used when the link goes away, by either route. `credit` is 0 in
   * exactly the state where a writer is parked, so the ordinary
   * credit-capped release frees nobody — the write would sit until
   * its own stall timer fired, a second later, and only then discover
   * the transport had closed. Each woken waiter re-checks liveness
   * and throws `TransportClosedError`.
   */
  private abandonCreditWaiters(): void {
    const waiters = this.creditWaiters.splice(0, this.creditWaiters.length);
    for (const w of waiters) w();
  }

  private releaseCreditWaiters(): void {
    const waiters = this.creditWaiters.splice(0, Math.max(0, Math.trunc(this.credit)));
    for (const w of waiters) w();
  }
}
