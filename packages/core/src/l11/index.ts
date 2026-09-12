/**
 * marklife-l11 — L11 binary-protocol encoder.
 *
 * Public API surface for the L11 sub-engine (P12 and the narrow-tape
 * L11 family). Uncompressed `GS v 0` raster. See
 * `docs/protocol/l11.md` for the wire format.
 */

export {
  buildL11BitmapHeader,
  buildL11Density,
  buildL11Enable,
  buildL11FeedDots,
  buildL11PositionToGap,
  buildL11Stop,
  buildL11Wakeup,
  concatBytes,
} from './protocol.js';

export { encodeL11Job, isL11Engine, type L11Engine, type L11Page } from './encode.js';
