/**
 * marklife-yxq — vendor-proprietary stream encoder.
 *
 * Public API surface for the YXQ-stream sub-engine. See
 * `docs/protocol/yxq.md` for the wire format.
 */

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
  concatBytes,
} from './protocol.js';

export { encodeYxqJob, isYxqEngine, type YxqEngine, type YxqPage } from './encode.js';
