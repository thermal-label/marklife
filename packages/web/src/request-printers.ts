import {
  DeviceIdentificationRequiredError,
  type ConnectOptions,
  type DeviceEntry,
  type PrinterAdapterMap,
  type Transport,
  type TransportType,
} from '@thermal-label/contracts';
import {
  DEVICES,
  REGISTRY_MARKLIFE,
  findDeviceByName,
  findDeviceByUsbIds,
} from '@thermal-label/marklife-core';
import { OPTIONAL_SERVICES, resolveProfile } from './ble-profiles.js';
import { MarklifeBleTransport } from './ble-transport.js';
import { buildUsbFilters } from '@thermal-label/transport';
import { WebSerialTransport, WebUsbTransport } from '@thermal-label/transport/web';
import { WebMarklifePrinter } from './printer.js';

/**
 * Unified browser-picker factory for the marklife driver family.
 *
 * Marklife chassis reach the browser over USB, BLE and Serial.
 * Dispatches on `opts.transport`:
 *
 * - `'usb'` — WebUSB. The picker is filtered to the registry's
 *   USB-capable chassis; the picked device auto-identifies by
 *   vid/pid, falling back to an operator choice.
 * - `'bluetooth-gatt'` — name-filtered picker, runtime profile
 *   probe, and identification from the advertised name; the operator
 *   is only asked when the name matches no registry entry.
 * - `'serial'` / `'bluetooth-spp'` — always-ask. `deviceKey`
 *   required; throws immediately on omission.
 */
export async function requestPrinters(opts: ConnectOptions): Promise<PrinterAdapterMap> {
  switch (opts.transport) {
    case 'bluetooth-gatt':
      return requestPrintersBluetoothGatt(opts);
    case 'serial':
      return requestPrintersSerial(opts);
    case 'bluetooth-spp':
      return requestPrintersBluetoothSpp(opts);
    case 'usb':
      return requestPrintersUsb(opts);
  }
}

async function requestPrintersUsb(
  opts: Extract<ConnectOptions, { transport: 'usb' }>,
): Promise<PrinterAdapterMap> {
  const usbDevice = await navigator.usb.requestDevice({
    filters: buildUsbFilters(devicesForTransport('usb')),
  });

  if (opts.deviceKey !== undefined) {
    const entry = entryByKey(opts.deviceKey);
    if (!entry) throw new Error(`requestPrinters(usb): unknown deviceKey "${opts.deviceKey}"`);
    return adapterMap(entry, await WebUsbTransport.fromDevice(usbDevice));
  }

  // vid/pid is a hard identity on USB — no need to ask the operator.
  const matched = findDeviceByUsbIds(usbDevice.vendorId, usbDevice.productId);
  if (matched) {
    return adapterMap(matched, await WebUsbTransport.fromDevice(usbDevice));
  }

  // Unknown vid/pid: let the operator pick, reusing the same
  // already-permitted USBDevice across the resume so the picker
  // does not open twice.
  throw new DeviceIdentificationRequiredError(
    devicesForTransport('usb'),
    async (deviceKey: string) => {
      const chosen = entryByKey(deviceKey);
      if (!chosen) throw new Error(`continueWith: unknown deviceKey "${deviceKey}"`);
      return adapterMap(chosen, await WebUsbTransport.fromDevice(usbDevice));
    },
  );
}

function requestPrintersBluetoothGatt(
  opts: Extract<ConnectOptions, { transport: 'bluetooth-gatt' }>,
): Promise<PrinterAdapterMap> {
  return openBluetoothGatt(opts.deviceKey);
}

/**
 * Open a marklife chassis over BLE.
 *
 * The picker filters on **name**, not service UUID: these chassis
 * advertise a vendor UUID rather than the service they host, so a
 * service filter matches nothing (see `ble-profiles.ts`). Every
 * registry name prefix becomes a filter clause, and every candidate
 * service is declared optional so the page may reach it post-connect.
 *
 * Identification is by advertised name: `P12_ZA15B_BLE` resolves to
 * the P12 by longest-prefix match. An explicit `deviceKey` wins over the name. Only when
 * neither identifies the chassis does the operator get asked, and
 * then the already-connected device is reused so the picker never
 * opens twice.
 *
 * The transport is opened only once the entry is known: its packet
 * ceiling comes from the entry, and an operator's choice has to set
 * it just as a name match does.
 */
async function openBluetoothGatt(deviceKey?: string): Promise<PrinterAdapterMap> {
  const candidates = devicesForTransport('bluetooth-gatt');
  const prefixes = new Set<string>();
  for (const entry of candidates) {
    const prefix = entry.transports['bluetooth-gatt']?.namePrefix;
    if (prefix !== undefined) prefixes.add(prefix);
  }

  const device = await navigator.bluetooth.requestDevice({
    filters: [...prefixes].map(namePrefix => ({ namePrefix })),
    optionalServices: [...OPTIONAL_SERVICES],
  });
  if (!device.gatt) throw new Error('Selected Bluetooth device has no GATT server');

  const server = await device.gatt.connect();
  const resolved = await resolveProfile(server);
  const open = async (entry: DeviceEntry): Promise<PrinterAdapterMap> =>
    adapterMap(
      entry,
      await MarklifeBleTransport.open(device, resolved, entry.transports['bluetooth-gatt']?.mtu),
    );

  if (deviceKey !== undefined) {
    const entry = entryByKey(deviceKey);
    if (!entry) {
      throw new Error(`requestPrinters(bluetooth-gatt): unknown deviceKey "${deviceKey}"`);
    }
    return open(entry);
  }

  const matched = device.name === undefined ? undefined : findDeviceByName(device.name);
  if (matched) return open(matched);

  throw new DeviceIdentificationRequiredError(candidates, (chosenKey: string) => {
    const chosen = entryByKey(chosenKey);
    if (!chosen) throw new Error(`continueWith: unknown deviceKey "${chosenKey}"`);
    return open(chosen);
  });
}

function requestPrintersSerial(
  opts: Extract<ConnectOptions, { transport: 'serial' }>,
): Promise<PrinterAdapterMap> {
  if (opts.deviceKey === undefined) {
    return Promise.reject(
      new DeviceIdentificationRequiredError(devicesForTransport('serial'), deviceKey =>
        openSerial(deviceKey, opts.baudRate),
      ),
    );
  }
  return openSerial(opts.deviceKey, opts.baudRate);
}

async function openSerial(deviceKey: string, baudRate?: number): Promise<PrinterAdapterMap> {
  const entry = entryByKey(deviceKey);
  if (!entry) throw new Error(`requestPrinters(serial): unknown deviceKey "${deviceKey}"`);
  const resolvedBaud = baudRate ?? entry.transports.serial?.defaultBaud;
  const transport = await WebSerialTransport.request(undefined, resolvedBaud);
  return adapterMap(entry, transport);
}

function requestPrintersBluetoothSpp(
  opts: Extract<ConnectOptions, { transport: 'bluetooth-spp' }>,
): Promise<PrinterAdapterMap> {
  if (opts.deviceKey === undefined) {
    return Promise.reject(
      new DeviceIdentificationRequiredError(devicesForTransport('bluetooth-spp'), deviceKey =>
        openBluetoothSpp(deviceKey, opts.baudRate),
      ),
    );
  }
  return openBluetoothSpp(opts.deviceKey, opts.baudRate);
}

async function openBluetoothSpp(deviceKey: string, baudRate?: number): Promise<PrinterAdapterMap> {
  const entry = entryByKey(deviceKey);
  if (!entry) throw new Error(`requestPrinters(bluetooth-spp): unknown deviceKey "${deviceKey}"`);
  const transport = await WebSerialTransport.request(undefined, baudRate ?? 9600);
  return adapterMap(entry, transport);
}

function adapterMap(entry: DeviceEntry, transport: Transport): PrinterAdapterMap {
  const engine = entry.engines[0];
  if (!engine) throw new Error(`Device ${entry.key} has no engines.`);
  const printer = new WebMarklifePrinter(entry, transport);
  return { [engine.role]: printer };
}

/**
 * Filter the registry to entries declaring `transport`. Used to
 * populate `DeviceIdentificationRequiredError.candidates`.
 */
export function devicesForTransport(transport: TransportType): readonly DeviceEntry[] {
  return REGISTRY_MARKLIFE.devices.filter(d => transport in d.transports);
}

function entryByKey(key: string): DeviceEntry | undefined {
  return (DEVICES as Record<string, DeviceEntry | undefined>)[key];
}
