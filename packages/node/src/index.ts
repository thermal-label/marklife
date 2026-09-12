export { MarklifePrinter, type MarklifePrinterOptions } from './printer.js';

export { MarklifeDiscovery, REGISTRY_MARKLIFE, discovery } from './discovery.js';

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
