export { WebMarklifePrinter, type WebMarklifePrinterOptions } from './printer.js';

/* eslint-disable @typescript-eslint/no-deprecated -- legacy factories re-exported during plan-10 transition */
export { fromSerialPort, requestPrinterSerial, type RequestSerialOptions } from './factories.js';
/* eslint-enable @typescript-eslint/no-deprecated */

export { devicesForTransport, requestPrinters } from './request-printers.js';
export {
  OPTIONAL_SERVICES,
  PROFILES as MARKLIFE_BLE_PROFILES,
  resolveProfile,
  type MarklifeBleProfile,
  type ProfileId as MarklifeBleProfileId,
  type ResolvedProfile,
} from './ble-profiles.js';
export { MarklifeBleTransport } from './ble-transport.js';
export type { ConnectOptions, PrinterAdapterMap } from '@thermal-label/contracts';
export { DeviceIdentificationRequiredError } from '@thermal-label/contracts';

// Re-export the core surface for one-stop imports.
export {
  DEFAULT_MEDIA,
  DEVICES,
  MEDIA,
  PROTOCOLS,
  ROTATE_DIRECTION,
  encodeJobForEngine,
  encodeYxqJob,
  encodeMarklifeTsplJob,
  encodeMarklifeEscposJob,
  findDevice,
  findDeviceByName,
  findMediaByDimensions,
  isEngineDrivable,
  isYxqEngine,
  isMarklifeTsplEngine,
  isMarklifeEscposEngine,
  parseYxqStatus,
  pickRotation,
  renderImage,
  type DeviceEntry,
  type DeviceKey,
  type MarklifeMedia,
  type MarklifePrintOptions,
  type MarklifeStatus,
  type MediaDescriptor,
  type PrinterAdapter,
  type Transport,
  type TransportType,
} from '@thermal-label/marklife-core';
