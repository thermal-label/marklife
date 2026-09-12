// re-exported from @mbtech-nl/bitmap so consumers import from one place
export type { LabelBitmap, RawImageData, PaletteEntry } from '@mbtech-nl/bitmap';
export { renderImage, renderText, rotateBitmap, padBitmap, scaleBitmap } from '@mbtech-nl/bitmap';

// re-exported from contracts (so node/web don't need a second import)
export type {
  DeviceEntry,
  DeviceRegistry,
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- retained for consumers during alias transition; remove with DeviceSupport cleanup PR
  DeviceSupport,
  MediaDescriptor,
  PreviewOptions,
  PreviewPlane,
  PreviewResult,
  PrintEngine,
  PrintOptions,
  PrinterAdapter,
  PrinterError,
  PrinterStatus,
  RotateDirection,
  Transport,
  TransportType,
} from '@thermal-label/contracts';
export {
  MediaNotSpecifiedError,
  UnsupportedOperationError,
  pickRotation,
} from '@thermal-label/contracts';

// device + media registries
export {
  DEVICES,
  REGISTRY_MARKLIFE,
  findDevice,
  findDeviceByName,
  findDeviceByUsbIds,
  type DeviceKey,
} from './devices.js';
export { ALL_MEDIA, DEFAULT_MEDIA, MEDIA, findMediaByDimensions, type MediaKey } from './media.js';
export { ROTATE_DIRECTION } from './orientation.js';
export {
  DEFAULT_PACKET_BYTES,
  DEFAULT_PACKET_DELAY_MS,
  pacingFor,
  type SendPacing,
} from './pacing.js';

// shared encoders/utilities (used by multiple sub-engines)
export { lzoCompress, lzoDecompress } from './lzo.js';
export { yxqZlibCompress, yxqZlibDecompress } from './zlib.js';
export { jbigEncode } from './jbig.js';
export { parseYxqStatus, YXQ_QUERY_OPCODES } from './status.js';

// preview (offline)
export { createPreviewOffline } from './preview.js';

// engine-level dispatch
export { encodeJobForEngine, isEngineDrivable, type MarklifePage } from './encode.js';

// === YXQ-stream sub-engine ===
export {
  YXQ_RASTER_HEADER,
  buildYxqDensity,
  buildYxqDensityGear,
  buildYxqEnablePrinter,
  buildYxqPaperType,
  buildYxqPrintLineDots,
  buildYxqRasterHeader,
  buildYxqStop,
  buildYxqWakeup,
  encodeYxqJob,
  isYxqEngine,
  concatBytes,
  type YxqEngine,
  type YxqPage,
} from './yxq/index.js';

// === L11 binary sub-engine (P12 + narrow-tape L11 family) ===
// `concatBytes` is already exported above from the YXQ sub-engine
// (identical helper) — not re-exported here to avoid a name clash.
export {
  buildL11BitmapHeader,
  buildL11Density,
  buildL11Enable,
  buildL11FeedDots,
  buildL11PositionToGap,
  buildL11Stop,
  buildL11Wakeup,
  encodeL11Job,
  isL11Engine,
  type L11Engine,
  type L11Page,
} from './l11/index.js';

// === TSPL sub-engine (thin wrapper over @thermal-label/tspl-core) ===
export {
  // re-exports from tspl-core (the spec-aligned subset)
  BITMAP_TAIL,
  buildBitmapHeader,
  buildBline,
  buildCls,
  buildDensity,
  buildDirection,
  buildGap,
  buildInitialPrinter,
  buildOffset,
  buildPrint,
  buildReference,
  buildSetCutter,
  buildSize,
  buildSpeed,
  // local-only — pending upstream landing
  buildSetGap,
  buildSetGapAuto,
  buildSetGapDistances,
  // encoder
  encodeMarklifeTsplJob,
  isMarklifeTsplEngine,
  type MarklifeTsplEngine,
  type MarklifeTsplPage,
} from './tspl/index.js';

// === ESC/POS sub-engine (thin wrapper over @thermal-label/escpos-core) ===
export {
  // re-exports from escpos-core (the spec-aligned subset)
  buildEscposReset,
  buildGsV0Raster,
  buildEscposDensity,
  buildFeedLines,
  buildFeedDots,
  buildLeftMargin,
  buildPrintWidth,
  buildLineSpacing,
  buildDefaultLineSpacing,
  buildCut,
  buildRealtimeStatusQuery,
  // local-only — pending upstream landing
  FORM_FEED,
  buildFormFeed as buildFormFeedEsc,
  buildPrinterWake,
  // encoder
  encodeMarklifeEscposJob,
  isMarklifeEscposEngine,
  type MarklifeEscposEngine,
  type MarklifeEscposPage,
} from './escpos/index.js';

// === CPCL-dialect sub-engine (T3) ===
// `concatBytes` is already exported above from the YXQ sub-engine
// (identical helper) — not re-exported here to avoid a name clash.
//
// Unverified: the encoder emits bytes, but no CPCL chassis has ever
// been bench-tested. See `src/cpcl/protocol.ts`.
export {
  CPCL_DPI,
  CPCL_HEAD_DOTS,
  CPCL_PAPER_TYPE_CONTINUOUS,
  CPCL_PAPER_TYPE_GAP,
  CPCL_PAPER_TYPE_RESERVED_20,
  CPCL_PAPER_TYPE_RESERVED_30,
  CPCL_RASTER_TAIL,
  buildCpclGapSense,
  buildCpclPageHeader,
  buildCpclPageWidth,
  buildCpclPaperType,
  buildCpclPrint,
  buildCpclRasterHeader,
  encodeCpclJob,
  isCpclEngine,
  type CpclEngine,
  type CpclPage,
} from './cpcl/index.js';

// === JBIG (ESC/POS-dialect) sub-engine ===
//
// Encoder deferred — encodeJbigJob throws UnsupportedOperationError
// until the WASM build of libjbigkit ships (DECISIONS.md § D4).
// Surrounding byte builders are usable standalone.
export {
  buildEscJustify,
  buildFormFeed,
  buildGsFormFeed,
  buildGsLeftMargin,
  buildGsLeftParenJ,
  buildGsLeftParenS,
  buildGsPrintWidth,
  buildJbigDensity,
  encodeJbigJob,
  isJbigEngine,
  type JbigEngine,
  type JbigPage,
} from './jbig/index.js';

// marklife-specific types
export type {
  MarklifeAnyMedia,
  MarklifeBitPolarity,
  MarklifeBleProfile,
  MarklifeCompression,
  MarklifeDevice,
  MarklifeEngine,
  MarklifeEngineCapabilities,
  MarklifeMedia,
  MarklifePhysicalSizeClass,
  MarklifePrintOptions,
  MarklifeProtocol,
  MarklifeStatus,
  MarklifeTargetModel,
} from './types.js';

/**
 * Protocols this core's encoder can produce wire bytes for.
 *
 * `marklife-cpcl` emits bytes but is **unverified**: the whole stream
 * is inferred from our own wire analysis and has never been run
 * against a printer.
 */
export const PROTOCOLS: ReadonlySet<string> = new Set([
  'marklife-yxq',
  'marklife-l11',
  'marklife-tspl',
  'marklife-escpos',
  'marklife-cpcl',
  // 'marklife-jbig' is reserved (encoder deferred — DECISIONS.md § D4).
]);
