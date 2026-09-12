/**
 * marklife-cpcl — CPCL-dialect encoder.
 *
 * Public API surface for the CPCL sub-engine (T3). CPCL text in a
 * binary envelope: `1F 80 01 <code>` paper type, then a `ZG` raster
 * whose payload is 1 KiB-window zlib behind a 4-byte big-endian
 * length.
 *
 * **Unverified** — inferred from our own wire analysis, never run
 * against a printer.
 */

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
  concatBytes,
} from './protocol.js';

export { encodeCpclJob, isCpclEngine, type CpclEngine, type CpclPage } from './encode.js';
