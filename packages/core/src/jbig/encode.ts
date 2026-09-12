/**
 * `marklife-jbig` job encoder — composes a full print job for the
 * JBIG-using chassis: protocol id 12 (D100) and id 7
 * (X4 / L100).
 *
 * **Payload encoder is deferred in v1** (DECISIONS.md § D4). The
 * wrapper below is complete; the JBIG payload comes from `jbigEncode`
 * in `../jbig.ts`, which throws `UnsupportedOperationError` until the
 * WASM build of libjbigkit ships. Devices on this protocol are
 * `unsupported` in the registry.
 *
 * **Unverified.** No JBIG chassis has been on the bench and there is
 * no capture behind any of this — the byte order, the per-id splits
 * and both speed formulas are inference.
 *
 * Job byte stream, id 12:
 *
 *   1. `1F 28 73 02 00 spdL spdH` — print speed, prepended to the
 *      whole job (first copy only).
 *   2. `12 23 d` — vendor density, on every copy.
 *   3. `GS L 0 0` — left margin.
 *   4. `GS W 60 03` — print width = 864 dots.
 *   5. `ESC a 1` — center justify.
 *   6. (gap stock) `1A 0C FF` — pre-raster feed marker.
 *   7. `1F 28 4A pL pH wL wH hL` + JBIG payload.
 *   8. Trailer — `1A 0C 00` on gap, `GS FF` on black-mark, nothing on
 *      continuous or black-mark-2.
 *
 * Job byte stream, id 7 — five differences, not a constant swap:
 *
 *   1. (first copy) `1F 80 01 n` — paper-type prelude. No id-12
 *      equivalent.
 *   2. (first copy) `12 23 d` — density, not repeated per copy.
 *   3. `1F 28 73 02 00 spdL spdH` — print speed, inside the header
 *      and on its own formula.
 *   4. `GS W 20 03` — print width = 800 dots, and no `GS L` at all.
 *   5. `ESC a 1`.
 *   6. `1A 0C FF` — unconditional, not gated on paper type.
 *   7. `1F 28 4A …` + JBIG payload.
 *   8. Trailer — `GS FF` on black-mark-2, `1A 0C 00` otherwise.
 *
 * Bitmap polarity: `LabelBitmap.data` is packed 1-bpp, `ceil(w/8)`
 * stride, MSB-first, `1 = dark` — which is the payload encoder's
 * input format verbatim. No expansion and no inversion. See
 * DECISIONS.md § D8.
 */

import type { LabelBitmap } from '@mbtech-nl/bitmap';
import { UnsupportedOperationError } from '@thermal-label/contracts';
import type { MarklifeEngine, MarklifeMedia, MarklifePrintOptions } from '../types.js';
import { jbigEncode } from '../jbig.js';
import {
  buildEscJustify,
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
  concatBytes,
  jbigPrintWidthDots,
  type JbigPaperType,
} from './protocol.js';

/** The two ids this encoder speaks. Id 10 is a different protocol. */
const SUPPORTED_PROTOCOL_IDS = new Set([7, 12]);

/**
 * Why id 10 (X8 / U210) is rejected instead of encoded.
 *
 * That chassis carries the `marklife-jbig` tag but shares no bytes
 * with ids 7 and 12. Its job shape, for whoever implements it:
 *
 *   1. A config block of `1F FD 01 A5 …` sub-commands.
 *   2. The bitmap split into 100-row bands, each introduced by a
 *      `1F 01 05 A5 …` band header.
 *   3. Each band written in 512-byte pieces.
 *   4. `1F 01 06 A5 <bandCount>` to finish.
 *
 * That is a sequence of separately paced writes, which
 * `encode() -> one write` cannot express — it needs its own encoder
 * and a transport shape that can pace the pieces. Emitting an
 * id-12-shaped job here would look like a working encoder and print
 * nothing. Unverified: no id-10 chassis has been on the bench.
 */
const ID10_REJECTION =
  'protocolId=10 (X8 / U210) is not this wire protocol. It uses a 1F FD 01 A5 config block, ' +
  '100-row bands with 1F 01 05 A5 headers written in 512-byte pieces, and a 1F 01 06 A5 ' +
  'terminator — a paced multi-write sequence that needs its own encoder and a transport shape ' +
  'that can pace it. See the comment on ID10_REJECTION in src/jbig/encode.ts.';

export interface JbigPage {
  bitmap: LabelBitmap;
  media: MarklifeMedia;
  options?: MarklifePrintOptions;

  /**
   * 0-based copy index, default 0.
   *
   * Both ids gate blocks on "first copy", and they gate different
   * ones: id 7 sends its paper-type prelude and density once, id 12
   * repeats density per copy but sends print speed once. A
   * multi-copy caller concatenates one `encodeJbigJob` per copy with
   * this incremented; a single-copy caller ignores it.
   */
  copyIndex?: number;
}

export type JbigEngine = MarklifeEngine & {
  protocol: 'marklife-jbig';
};

/**
 * Type guard — true when the engine binds to the JBIG protocol.
 */
export function isJbigEngine(engine: { protocol: string }): engine is JbigEngine {
  return engine.protocol === 'marklife-jbig';
}

/**
 * Encode a marklife-jbig print job.
 *
 * @throws {UnsupportedOperationError} for `protocolId` 10 (X8 /
 *   U210), which is a different wire protocol, and for any id other
 *   than 7 or 12.
 * @throws {UnsupportedOperationError} from `jbigEncode` until the
 *   WASM build of libjbigkit ships (DECISIONS.md § D4).
 */
export function encodeJbigJob(engine: JbigEngine, page: JbigPage): Uint8Array {
  const rawProtocolId = engine.capabilities?.protocolId;
  const protocolId = typeof rawProtocolId === 'number' ? rawProtocolId : 0;

  if (protocolId === 10) {
    throw new UnsupportedOperationError('encodeJbigJob', ID10_REJECTION);
  }
  if (!SUPPORTED_PROTOCOL_IDS.has(protocolId)) {
    throw new UnsupportedOperationError(
      'encodeJbigJob',
      `protocolId=${String(protocolId)} is not a marklife-jbig id. Supported: ${[...SUPPORTED_PROTOCOL_IDS].join(', ')}.`,
    );
  }

  const { bitmap } = page;
  const density = resolveDensity(page.options);
  const paperType = resolvePaperType(page.media);
  const isFirstCopy = (page.copyIndex ?? 0) === 0;

  // bitmap.data is the payload encoder's input verbatim — packed
  // 1-bpp, ceil(w/8) stride, MSB-first, 1 = dark. Throws per D4.
  const payload = jbigEncode(bitmap.data, bitmap.widthPx, bitmap.heightPx);

  const raster = concatBytes(
    buildGsLeftParenJ(payload.length, bitmap.widthPx, bitmap.heightPx),
    payload,
  );
  const printWidth = buildGsPrintWidth(jbigPrintWidthDots(protocolId));
  const preRaster = buildJbigPreRasterMarker(protocolId, paperType);
  const trailer = buildJbigTrailer(protocolId, paperType);

  if (protocolId === 12) {
    // Speed is a function of the assembled body length, so the body
    // has to exist before the speed block can be built — then the
    // block goes in front of it. Appending it instead sets speed
    // after the page is committed, which does nothing.
    const body = concatBytes(
      buildJbigDensity(density),
      buildGsLeftMargin(0),
      printWidth,
      buildEscJustify(1),
      preRaster,
      raster,
      trailer,
    );
    if (!isFirstCopy) return body;
    const speed = computeJbigPrintSpeedId12(bitmap.heightPx, body.length);
    return concatBytes(buildGsLeftParenS(speed), body);
  }

  // id 7 — paper type and density lead the first copy only; speed
  // sits between that prelude and GS W on every copy.
  const prelude = isFirstCopy
    ? concatBytes(buildJbigPaperType(protocolId, paperType), buildJbigDensity(density))
    : new Uint8Array(0);
  const speed = computeJbigPrintSpeedId7(bitmap.heightPx, payload.length);

  return concatBytes(
    prelude,
    buildGsLeftParenS(speed),
    printWidth,
    buildEscJustify(1),
    preRaster,
    raster,
    trailer,
  );
}

function resolveDensity(options: MarklifePrintOptions | undefined): number {
  if (options?.densityLevel !== undefined) return options.densityLevel;
  switch (options?.density) {
    case 'light':
      return 1;
    case 'normal':
      return 2;
    case 'dark':
      return 3;
    default:
      return 2;
  }
}

/**
 * Paper type from the media descriptor, matching how `yxq/encode.ts`
 * reads `media.type`.
 *
 * `MediaDescriptor.type` has only `continuous` and `die-cut` in this
 * family, so `black-mark` and `black-mark-2` are unreachable until
 * that vocabulary grows a black-mark member (and there is no
 * black-mark media in the registry to grow it for yet). Anything that
 * is not continuous falls to gap, which is the safe default: gap
 * stock's trailer feeds to the next gap, and feeding continuous stock
 * that way only wastes media.
 */
function resolvePaperType(media: MarklifeMedia): JbigPaperType {
  return media.type === 'continuous' ? 'continuous' : 'gap';
}
