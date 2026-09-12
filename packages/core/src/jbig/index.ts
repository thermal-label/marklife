/**
 * marklife-jbig — JBIG-via-ESC/POS-dialect encoder.
 *
 * Payload encoder is deferred (DECISIONS.md § D4) — `encodeJbigJob`
 * throws `UnsupportedOperationError` from `jbigEncode` until the WASM
 * build of libjbigkit ships. The wrapper byte builders below are
 * usable standalone for building diagnostic / probe sequences.
 */

export {
  buildEscJustify,
  buildFormFeed,
  buildGsFormFeed,
  buildGsLeftMargin,
  buildGsLeftParenJ,
  buildGsLeftParenS,
  buildGsPrintWidth,
  buildJbigDensity,
  buildJbigPaperType,
  buildJbigPreRasterMarker,
  buildJbigTrailer,
  computeJbigPrintSpeedId7,
  computeJbigPrintSpeedId12,
  jbigPrintWidthDots,
  concatBytes as concatJbigBytes,
  type JbigPaperType,
} from './protocol.js';

export { encodeJbigJob, isJbigEngine, type JbigEngine, type JbigPage } from './encode.js';
