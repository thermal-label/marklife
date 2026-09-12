/**
 * marklife-tspl — TSC TSPL II + LZO mode-3 BITMAP, thin wrapper over
 * `@thermal-label/tspl-core`.
 *
 * Public API: re-exports the spec-aligned tspl-core builders + the
 * marklife-local `buildSetGap` (D6 upstream gap) + the high-level
 * job encoder.
 */

// Re-exported from tspl-core for one-stop import.
export {
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
  concatBytes,
} from '@thermal-label/tspl-core';

// Local-only — pending upstream landing in tspl-core@0.3.0.
export { buildSetGap, buildSetGapAuto, buildSetGapDistances } from './protocol.js';

// High-level encoder.
export {
  encodeMarklifeTsplJob,
  isMarklifeTsplEngine,
  type MarklifeTsplEngine,
  type MarklifeTsplPage,
} from './encode.js';
