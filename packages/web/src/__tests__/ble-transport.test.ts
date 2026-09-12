/**
 * Coverage for the Profile A credit gate.
 *
 * The failure this guards against is silent: a chassis that accepts
 * every write and prints nothing because the host outran the credit
 * window. So the tests assert on *when* writes happen relative to
 * credit grants, not just that they happen. Pacing is the printer's
 * and is covered in printer.test.ts.
 */
import { describe, expect, it, vi } from 'vitest';
import { MarklifeBleTransport } from '../ble-transport.js';
import type { ResolvedProfile } from '../ble-profiles.js';

interface FakeChar {
  uuid: string;
  handler?: (e: Event) => void;
  writes: Uint8Array[];
  startNotifications: () => Promise<void>;
  stopNotifications: () => Promise<void>;
  addEventListener: (t: string, h: (e: Event) => void) => void;
  removeEventListener: unknown;
  writeValueWithoutResponse: (d: Uint8Array) => Promise<void>;
  /** Push a notification payload to whatever listener is attached. */
  notify: (bytes: number[]) => void;
}

function fakeChar(uuid: string): FakeChar {
  const c: FakeChar = {
    uuid,
    writes: [],
    startNotifications: () => Promise.resolve(),
    stopNotifications: () => Promise.resolve(),
    addEventListener: (_t, h) => {
      c.handler = h;
    },
    removeEventListener: vi.fn(),
    writeValueWithoutResponse: (d: Uint8Array) => {
      c.writes.push(new Uint8Array(d));
      return Promise.resolve();
    },
    notify: bytes => {
      const view = new DataView(new Uint8Array(bytes).buffer);
      c.handler?.({ target: { ...c, value: view } } as unknown as Event);
    },
  };
  return c;
}

function fakeDevice(): { addEventListener: unknown; removeEventListener: unknown } {
  return { addEventListener: vi.fn(), removeEventListener: vi.fn() };
}

async function openA(
  maxPacket = 20,
): Promise<{ t: MarklifeBleTransport; tx: FakeChar; cx: FakeChar }> {
  const tx = fakeChar('ff02');
  const rx = fakeChar('ff01');
  const cx = fakeChar('ff03');
  const resolved = {
    profile: {
      id: 'A',
      serviceUuid: 'ff00',
      txCharacteristicUuid: 'ff02',
      rxCharacteristicUuid: 'ff01',
      cxCharacteristicUuid: 'ff03',
    },
    tx,
    rx,
    cx,
  } as unknown as ResolvedProfile;
  // The ceiling is also the starting chunk size, so callers wanting
  // several packets out of a small buffer pass a small one.
  const t = await MarklifeBleTransport.open(
    fakeDevice() as unknown as BluetoothDevice,
    resolved,
    maxPacket,
  );
  return { t, tx, cx };
}

const flush = (): Promise<void> => new Promise(r => setTimeout(r, 0));

describe('MarklifeBleTransport — Profile A credit gate', () => {
  it('blocks the first write until the printer grants credit', async () => {
    const { t, tx } = await openA();
    const done = vi.fn();
    // close() below aborts this write, so the rejection must be
    // handled here — an unattached one fails the whole run.
    const pending = t.write(new Uint8Array(10)).then(done, () => {
      /* close() below aborts it; swallow so the run does not fail */
    });
    await flush();
    // No grant yet: nothing may go out.
    expect(tx.writes.length).toBe(0);
    expect(done).not.toHaveBeenCalled();
    await t.close();
    await pending;
  });

  it('releases writes once the opening grant arrives', async () => {
    const { t, tx, cx } = await openA();
    const write = t.write(new Uint8Array(10));
    await flush();
    cx.notify([0x01, 0x04]);
    await write;
    expect(tx.writes.length).toBe(1);
    await t.close();
  });

  it('spends one credit per packet and waits for a top-up', async () => {
    const { t, tx, cx } = await openA();
    // 5 packets at the 20-byte default MTU; opening window is 4.
    const write = t.write(new Uint8Array(100));
    await flush();
    cx.notify([0x01, 0x04]);
    await flush();
    expect(tx.writes.length).toBe(4);
    cx.notify([0x01, 0x01]);
    await write;
    expect(tx.writes.length).toBe(5);
    await t.close();
  });

  it('honours an announced MTU for chunk size', async () => {
    const { t, tx, cx } = await openA(240);
    // 0x02 lo hi — 103 little-endian, so payload is 100 bytes.
    cx.notify([0x02, 0x67, 0x00]);
    const write = t.write(new Uint8Array(100));
    await flush();
    cx.notify([0x01, 0x04]);
    await write;
    expect(tx.writes.length).toBe(1);
    expect(tx.writes[0]?.length).toBe(100);
    await t.close();
  });

  it('reports the resolved profile id', async () => {
    const { t } = await openA();
    expect(t.profileId).toBe('A');
    await t.close();
  });

  it('rejects a write after close', async () => {
    const { t } = await openA();
    await t.close();
    expect(t.connected).toBe(false);
    await expect(t.write(new Uint8Array(4))).rejects.toThrow();
  });
});

describe('MarklifeBleTransport — unthrottled profiles', () => {
  it('writes freely when the profile exposes no credit channel', async () => {
    const tx = fakeChar('49535343-8841');
    const rx = fakeChar('49535343-1e4d');
    const resolved = {
      profile: {
        id: 'B',
        serviceUuid: '49535343-fe7d',
        txCharacteristicUuid: '49535343-8841',
        rxCharacteristicUuid: '49535343-1e4d',
      },
      tx,
      rx,
    } as unknown as ResolvedProfile;
    const t = await MarklifeBleTransport.open(
      fakeDevice() as unknown as BluetoothDevice,
      resolved,
      20,
    );
    await t.write(new Uint8Array(100));
    expect(tx.writes.length).toBe(5);
    expect(t.profileId).toBe('B');
    await t.close();
  });
});

describe('MarklifeBleTransport — read path', () => {
  it('accumulates notifications and satisfies a pending read', async () => {
    const tx = fakeChar('ff02');
    const rx = fakeChar('ff01');
    const resolved = {
      profile: {
        id: 'B',
        serviceUuid: 's',
        txCharacteristicUuid: 'ff02',
        rxCharacteristicUuid: 'ff01',
      },
      tx,
      rx,
    } as unknown as ResolvedProfile;
    const t = await MarklifeBleTransport.open(
      fakeDevice() as unknown as BluetoothDevice,
      resolved,
      20,
    );
    const pending = t.read(3);
    rx.notify([0xaa, 0xbb]);
    rx.notify([0xcc]);
    expect([...(await pending)]).toEqual([0xaa, 0xbb, 0xcc]);
    await t.close();
  });
});

describe('profile probe order', () => {
  it('matches the P12 GATT table observed on the bench', async () => {
    const { PROFILES, resolveProfile } = await import('../ble-profiles.js');
    // The P12 hosts A, B and D simultaneously (GATT probe 2026-09-10).
    // Preference order must land on A, the one with the credit channel.
    const hosted = new Set([
      '0000ff00-0000-1000-8000-00805f9b34fb',
      '49535343-fe7d-4ae5-8fa9-9fafd205e455',
      '000018f0-0000-1000-8000-00805f9b34fb',
    ]);
    const server = {
      getPrimaryService: (u: string) =>
        hosted.has(u)
          ? Promise.resolve({
              uuid: u,
              getCharacteristic: (c: string) => Promise.resolve({ uuid: c }),
            })
          : Promise.reject(Object.assign(new Error('x'), { name: 'NotFoundError' })),
    } as unknown as BluetoothRemoteGATTServer;

    const resolved = await resolveProfile(server);
    expect(resolved.profile.id).toBe('A');
    expect(resolved.cx).toBeDefined();
    expect(PROFILES.map(p => p.id)).toEqual(['A', 'B', 'C', 'D']);
  });
});

describe('credit stall recovery', () => {
  it('self-grants and continues when a grant goes missing', async () => {
    vi.useFakeTimers();
    try {
      const { t, tx, cx } = await openA();
      const write = t.write(new Uint8Array(60)); // 3 packets at mtu 20
      await vi.advanceTimersByTimeAsync(0);
      cx.notify([0x01, 0x04]);
      await vi.advanceTimersByTimeAsync(0);
      expect(tx.writes.length).toBe(3);
      await write;
      await t.close();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not abort the job when no grant ever arrives', async () => {
    vi.useFakeTimers();
    try {
      const { t, tx } = await openA();
      // No credit is ever granted. thermoprint's implementation
      // self-grants after a 1 s stall rather than failing; a lost
      // notification must not sink an otherwise healthy print.
      const write = t.write(new Uint8Array(40)); // 2 packets
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(1000);
      await write;
      expect(tx.writes.length).toBe(2);
      await t.close();
    } finally {
      vi.useRealTimers();
    }
  });

  it('a close during a credit wait ends the write promptly', async () => {
    const { t } = await openA();
    const write = t.write(new Uint8Array(40));
    await flush();
    await t.close();
    await expect(write).rejects.toThrow();
  });
});

describe('packet ceiling', () => {
  it('never exceeds the registry ceiling, even when the MTU announces more', async () => {
    const tx = fakeChar('ff02');
    const rx = fakeChar('ff01');
    const cx = fakeChar('ff03');
    const resolved = {
      profile: {
        id: 'A',
        serviceUuid: 'ff00',
        txCharacteristicUuid: 'ff02',
        rxCharacteristicUuid: 'ff01',
        cxCharacteristicUuid: 'ff03',
      },
      tx,
      rx,
      cx,
    } as unknown as ResolvedProfile;
    // S2: announces MTU 179 but only accepts 95-byte packets.
    const t = await MarklifeBleTransport.open(
      fakeDevice() as unknown as BluetoothDevice,
      resolved,
      95,
    );
    cx.notify([0x02, 0xb3, 0x00]); // 179 little-endian
    const write = t.write(new Uint8Array(200));
    await flush();
    cx.notify([0x01, 0x04]);
    await flush();
    cx.notify([0x01, 0x04]);
    await write;
    // 176 would have been two packets; the ceiling forces three.
    expect(tx.writes.length).toBe(3);
    for (const w of tx.writes) expect(w.length).toBeLessThanOrEqual(95);
    await t.close();
  });

  it('lets a small announced MTU lower the ceiling further', async () => {
    const tx = fakeChar('ff02');
    const rx = fakeChar('ff01');
    const cx = fakeChar('ff03');
    const resolved = {
      profile: {
        id: 'A',
        serviceUuid: 'ff00',
        txCharacteristicUuid: 'ff02',
        rxCharacteristicUuid: 'ff01',
        cxCharacteristicUuid: 'ff03',
      },
      tx,
      rx,
      cx,
    } as unknown as ResolvedProfile;
    const t = await MarklifeBleTransport.open(
      fakeDevice() as unknown as BluetoothDevice,
      resolved,
      95,
    );
    cx.notify([0x02, 0x17, 0x00]); // 23 -> 20 byte payload
    const write = t.write(new Uint8Array(40));
    await flush();
    cx.notify([0x01, 0x04]);
    await write;
    expect(tx.writes.length).toBe(2);
    expect(tx.writes[0]?.length).toBe(20);
    await t.close();
  });
});

describe('chunk size starts at the chassis ceiling', () => {
  it('uses the registry ceiling before any MTU is announced', async () => {
    // Only Profile A ever announces an MTU. If the chunk size waited
    // to be raised from the BLE floor, every other profile would sit
    // at 20 bytes forever — ~660 B/s once paced.
    const tx = fakeChar('tx');
    const rx = fakeChar('rx');
    const resolved = {
      profile: {
        id: 'B',
        serviceUuid: 's',
        txCharacteristicUuid: 'tx',
        rxCharacteristicUuid: 'rx',
      },
      tx,
      rx,
    } as unknown as ResolvedProfile;
    const t = await MarklifeBleTransport.open(
      fakeDevice() as unknown as BluetoothDevice,
      resolved,
      95,
    );
    await t.write(new Uint8Array(190));
    expect(tx.writes.length).toBe(2);
    expect(tx.writes[0]?.length).toBe(95);
    await t.close();
  });
});

describe('close during a credit wait', () => {
  it('aborts a blocked write immediately, not after the stall timeout', async () => {
    const { t, tx } = await openA();
    const write = t.write(new Uint8Array(40));
    await flush();
    expect(tx.writes.length).toBe(0); // parked on credit
    const t0 = Date.now();
    await t.close();
    await expect(write).rejects.toThrow(/closed/i);
    // The stall timer is 1 s. Closing must wake the writer well
    // inside that: the credit-capped release frees nobody here,
    // because credit is 0 in exactly this state.
    expect(Date.now() - t0).toBeLessThan(500);
    expect(tx.writes.length).toBe(0);
  });
});
