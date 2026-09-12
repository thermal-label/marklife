import { DEVICES, type DeviceEntry, type DeviceKey } from '@thermal-label/marklife-core';
import { WebSerialTransport } from '@thermal-label/transport/web';
import { WebMarklifePrinter } from './printer.js';

export interface RequestSerialOptions {
  /**
   * Model key — e.g. `'S8'`. Web Serial's picker is generic; the
   * registry binds the wire protocol once the user picks the port.
   */
  deviceKey: DeviceKey;
  baudRate?: number;
}

/**
 * Web Serial factory — for OS-paired Bluetooth-SPP printers.
 *
 * Web Serial's picker is generic (lists every serial port the page
 * is permitted to see); the user picks one, and `deviceKey` tells the
 * runtime which engine to drive.
 *
 * @deprecated Use `requestPrinters({ transport: 'serial', deviceKey })`
 *   or `requestPrinters({ transport: 'bluetooth-spp', deviceKey })`
 *   from `./request-printers.ts`. Removed once consumers migrate (plan 11).
 */
export async function requestPrinterSerial(
  options: RequestSerialOptions,
): Promise<WebMarklifePrinter> {
  const entry = entryByKey(options.deviceKey);
  if (!entry) {
    throw new Error(`requestPrinterSerial: unknown model "${options.deviceKey}"`);
  }
  const transport = await WebSerialTransport.request(undefined, options.baudRate);
  return new WebMarklifePrinter(entry, transport);
}

/**
 * Convenience: build a printer from an already-picked Web Serial port.
 *
 * `port` is typed as `unknown` to avoid a dependency on
 * `@types/w3c-web-serial`; the underlying
 * `WebSerialTransport.fromPort` accepts a `SerialPort` from the
 * browser global namespace.
 *
 * @deprecated Use `requestPrinters({ transport: 'serial', deviceKey })`
 *   from `./request-printers.ts`. Removed once consumers migrate (plan 11).
 */
export async function fromSerialPort(
  port: unknown,
  modelKey: DeviceKey,
  baudRate?: number,
): Promise<WebMarklifePrinter> {
  const entry = entryByKey(modelKey);
  if (!entry) throw new Error(`fromSerialPort: unknown model "${modelKey}"`);
  // The transport's fromPort signature is browser-global SerialPort;
  // we cast at the boundary so this package doesn't pull in
  // @types/w3c-web-serial.
  const transport = await WebSerialTransport.fromPort(
    port as Parameters<typeof WebSerialTransport.fromPort>[0],
    baudRate,
  );
  return new WebMarklifePrinter(entry, transport);
}

function entryByKey(key: string): DeviceEntry | undefined {
  return (DEVICES as Record<string, DeviceEntry | undefined>)[key];
}
