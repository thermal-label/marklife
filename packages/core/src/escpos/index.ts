/**
 * marklife-escpos — vanilla Epson ESC/POS, thin wrapper over
 * `@thermal-label/escpos-core`.
 *
 * Public API: re-exports the spec-aligned escpos-core builders +
 * the marklife-local `buildFormFeed` (D6 upstream gap) and the
 * vendor `buildPrinterWake` + the high-level job encoder.
 */

// Re-exported from escpos-core for one-stop import.
export {
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
  concatBytes,
} from '@thermal-label/escpos-core';

// Local-only — pending upstream landing in escpos-core@0.3.0.
export { FORM_FEED, buildFormFeed, buildPrinterWake } from './protocol.js';

// High-level encoder.
export {
  encodeMarklifeEscposJob,
  isMarklifeEscposEngine,
  type MarklifeEscposEngine,
  type MarklifeEscposPage,
} from './encode.js';
