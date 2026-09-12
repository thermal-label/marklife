import { UnsupportedOperationError } from '@thermal-label/contracts';
import type { LabelBitmap } from '@mbtech-nl/bitmap';
import type {
  MarklifeEngine,
  MarklifeMedia,
  MarklifePrintOptions,
  MarklifeProtocol,
} from './types.js';
import { encodeYxqJob, isYxqEngine } from './yxq/index.js';
import { encodeL11Job, isL11Engine } from './l11/index.js';
import { encodeJbigJob, isJbigEngine } from './jbig/index.js';
import { encodeMarklifeTsplJob, isMarklifeTsplEngine } from './tspl/index.js';
import { encodeMarklifeEscposJob, isMarklifeEscposEngine } from './escpos/index.js';
import { encodeCpclJob, isCpclEngine } from './cpcl/index.js';

export interface MarklifePage {
  bitmap: LabelBitmap;
  media: MarklifeMedia;
  options?: MarklifePrintOptions;
}

const IMPLEMENTED_PROTOCOLS = new Set<MarklifeProtocol>([
  'marklife-yxq',
  'marklife-l11',
  'marklife-tspl',
  'marklife-escpos',
  // 'marklife-cpcl' produces wire bytes, but from wire analysis only —
  // no CPCL chassis has ever been bench-tested. Drivable, unverified.
  'marklife-cpcl',
  // 'marklife-jbig' wrapper is implemented but the JBIG payload
  // encoder is deferred (DECISIONS.md § D4). encodeJbigJob throws
  // until the WASM build of libjbigkit ships, so devices on this
  // protocol stay flagged 'broken' and isEngineDrivable returns
  // false until then.
]);

/**
 * Whether the runtime can produce wire bytes for the given engine.
 */
export function isEngineDrivable(engine: MarklifeEngine): boolean {
  return IMPLEMENTED_PROTOCOLS.has(engine.protocol);
}

/**
 * Top-level dispatch — encode a page for the given engine into wire
 * bytes, routing on `engine.protocol`.
 */
export function encodeJobForEngine(engine: MarklifeEngine, page: MarklifePage): Uint8Array {
  if (isYxqEngine(engine)) {
    return encodeYxqJob(engine, page);
  }
  if (isL11Engine(engine)) {
    return encodeL11Job(engine, page);
  }
  if (isJbigEngine(engine)) {
    return encodeJbigJob(engine, page);
  }
  if (isMarklifeTsplEngine(engine)) {
    return encodeMarklifeTsplJob(engine, page);
  }
  if (isMarklifeEscposEngine(engine)) {
    return encodeMarklifeEscposJob(engine, page);
  }
  if (isCpclEngine(engine)) {
    return encodeCpclJob(engine, page);
  }
  throw new UnsupportedOperationError(
    'encodeJobForEngine',
    `protocol "${engine.protocol}" has no encoder in this build.`,
  );
}
