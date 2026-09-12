import {
  DEVICES,
  REGISTRY_MARKLIFE,
  type DeviceEntry,
  type DeviceKey,
} from '@thermal-label/marklife-core';
import type { DiscoveredPrinter, OpenOptions, PrinterDiscovery } from '@thermal-label/contracts';
import { SerialTransport } from '@thermal-label/transport/node';
import { MarklifePrinter } from './printer.js';

/**
 * `PrinterDiscovery` implementation for marklife printers.
 *
 * Every chassis speaks Bluetooth; the P12 and P15 also expose a USB
 * Printer-class interface, and none speaks TCP. The discovery surface
 * is therefore:
 *
 * - **Classic-BT SPP** (the bulk of the catalogue) — `openBluetoothSpp`
 *   accepts an OS-paired RFCOMM device path (`/dev/rfcomm0`,
 *   `/dev/tty.<Name>-SPPDev`, `COMx`) plus a `deviceKey`. The user
 *   pairs at the OS level; `SerialTransport.open` opens the path.
 * - **BLE GATT** — deferred. Node BLE (`noble`) is rough; for v1,
 *   `openBluetoothGatt` throws. Browser hosts use the web package's
 *   `requestPrinterBluetooth` factory.
 *
 * `listPrinters()` returns an empty list because none of the
 * supported transports are auto-enumerable to a specific marklife
 * model from Node — Classic-BT pairing is OS-managed and BLE is
 * deferred.
 */
export class MarklifeDiscovery implements PrinterDiscovery {
  readonly family = 'marklife';

  /**
   * Returns an empty list — no auto-enumeration in v1.
   *
   * Classic-BT SPP printers don't surface a model identifier on
   * their RFCOMM channel, so we can't bind a registry entry without
   * a user-provided `deviceKey`. BLE enumeration is deferred until
   * a Node BLE backend is wired in.
   */
  async listPrinters(): Promise<DiscoveredPrinter[]> {
    return Promise.resolve([]);
  }

  /**
   * Open a printer.
   *
   * - `serialPath` + `deviceKey` → opens an OS-paired Bluetooth-SPP
   *   port via `SerialTransport`.
   * - `host` → throws (no TCP transport in this catalogue).
   * - `vid`+`pid` → throws (no USB transport).
   *
   * Use `openBluetoothSpp` / `openBluetoothGatt` directly for the
   * marklife-specific surface.
   */
  async openPrinter(options: OpenOptions = {}): Promise<MarklifePrinter> {
    if (options.serialPath !== undefined) {
      const args: { serialPath: string; deviceKey: DeviceKey; baudRate?: number } = {
        serialPath: options.serialPath,
        deviceKey: options.deviceKey as DeviceKey,
      };
      if (options.baudRate !== undefined) args.baudRate = options.baudRate;
      return this.openBluetoothSpp(args);
    }
    if (options.host !== undefined) {
      throw new Error('openPrinter: no TCP transport — no marklife chassis exposes one.');
    }
    if (options.vid !== undefined || options.pid !== undefined) {
      throw new Error(
        'openPrinter: this discovery surface does not open USB. The P12 and ' +
          'P15 do expose a USB Printer-class interface — open it with ' +
          'UsbTransport from @thermal-label/transport/node and construct ' +
          'MarklifePrinter directly.',
      );
    }
    throw new Error(
      'openPrinter: marklife discovery requires `serialPath` + `deviceKey` (Bluetooth-SPP via OS pairing).',
    );
  }

  /**
   * Open a Bluetooth-SPP printer by OS-paired RFCOMM path.
   *
   * On Linux: `/dev/rfcomm0` (after `rfcomm bind` or `rfcomm
   * connect`). On macOS: `/dev/tty.<Name>-SPPDev` (after Bluetooth
   * pairing). On Windows: `COMx` (after pairing in the Bluetooth
   * settings). The `deviceKey` is required because RFCOMM carries no
   * protocol-binding information.
   */
  async openBluetoothSpp(options: {
    serialPath: string;
    deviceKey: DeviceKey;
    baudRate?: number;
  }): Promise<MarklifePrinter> {
    const entry = pickEntryByKey(options.deviceKey);
    if (!entry) {
      throw new Error(`openBluetoothSpp: deviceKey "${options.deviceKey}" not found in registry`);
    }
    const transport = await SerialTransport.open(options.serialPath, options.baudRate);
    return new MarklifePrinter(entry, transport, 'bluetooth-spp');
  }

  /**
   * Open a BLE printer.
   *
   * **Deferred in v1** — Node BLE backends (`noble`) are rough and
   * the BLE Profile A / B / C dispatch layer is non-trivial. Browser
   * hosts use `@thermal-label/marklife-web`'s
   * `requestPrinterBluetooth(modelKey)` factory, which surfaces the
   * Web Bluetooth picker with the right service UUID.
   *
   * @throws always.
   */
  async openBluetoothGatt(_options: { deviceKey: DeviceKey }): Promise<MarklifePrinter> {
    return Promise.reject(
      new Error(
        'openBluetoothGatt: Node BLE not wired in v1 — use the web package or construct a Transport yourself and call `new MarklifePrinter(...)` directly.',
      ),
    );
  }
}

function pickEntryByKey(key: string | undefined): DeviceEntry | undefined {
  if (key === undefined) return undefined;
  return DEVICES[key as DeviceKey];
}

export { REGISTRY_MARKLIFE };

/**
 * Default `MarklifeDiscovery` singleton.
 *
 * `thermal-label-cli` auto-detects installed driver packages by
 * walking a `KNOWN_DRIVERS` allowlist and looking for the named
 * `discovery` export with a `listPrinters` method.
 */
export const discovery = new MarklifeDiscovery();
