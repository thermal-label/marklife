import type { DeviceEntry, DeviceRegistry } from '@thermal-label/contracts';
import { DEVICES, REGISTRY, type DeviceKey } from './devices.generated.js';

/**
 * The marklife device registry — every model authored under
 * `data/devices/*.json5`, validated and aggregated by
 * `scripts/compile-data.mjs`.
 *
 * Pair with `PROTOCOLS` (from this package) and pass to
 * `resolveSupportedDevices` from `@thermal-label/contracts` to filter
 * the list down to what the runtime can actually drive.
 */
export const REGISTRY_MARKLIFE = REGISTRY as unknown as DeviceRegistry;

export { DEVICES, type DeviceKey };

/**
 * Find a device by Bluetooth advertised name.
 *
 * Longest registry prefix wins, so a name that extends another
 * entry's prefix resolves to the more specific entry. BLE names carry
 * the SPP name plus `_BLE` (`P12_ZA15B_BLE` → `P12`), so one prefix
 * serves both transports.
 *
 * Returns `undefined` when no entry's `namePrefix` matches.
 */
export function findDeviceByName(name: string): DeviceEntry | undefined {
  const candidates: { entry: DeviceEntry; prefix: string }[] = [];
  for (const entry of REGISTRY_MARKLIFE.devices) {
    const transports = entry.transports;
    const sppPrefix = transports['bluetooth-spp']?.namePrefix;
    if (sppPrefix !== undefined && name.startsWith(sppPrefix)) {
      candidates.push({ entry, prefix: sppPrefix });
    }
    const gattPrefix = transports['bluetooth-gatt']?.namePrefix;
    if (gattPrefix !== undefined && name.startsWith(gattPrefix)) {
      candidates.push({ entry, prefix: gattPrefix });
    }
  }
  if (candidates.length === 0) return undefined;
  // Longest-prefix-first wins.
  candidates.sort((a, b) => b.prefix.length - a.prefix.length);
  return candidates[0]?.entry;
}

/**
 * Find a device by registry key (string lookup, case-sensitive). A
 * thin wrapper around the typed `DEVICES` map for runtime callers
 * that don't have the literal key type at hand.
 */
export function findDevice(key: string): DeviceEntry | undefined {
  return (DEVICES as Record<string, DeviceEntry | undefined>)[key];
}

/**
 * Find a device by USB vendor / product id.
 *
 * The registry stores `vid` / `pid` as hex strings (`'0x09c7'`); the
 * WebUSB and libusb surfaces both hand back numbers, so the compare
 * happens after `parseInt`. Only a handful of marklife chassis expose
 * USB at all — the rest are Bluetooth-only and never match.
 */
export function findDeviceByUsbIds(vendorId: number, productId: number): DeviceEntry | undefined {
  return REGISTRY_MARKLIFE.devices.find(entry => {
    const usb = entry.transports.usb;
    if (!usb) return false;
    return parseInt(usb.vid, 16) === vendorId && parseInt(usb.pid, 16) === productId;
  });
}
