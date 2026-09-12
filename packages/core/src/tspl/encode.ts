/**
 * `marklife-tspl` job encoder — composes a TSPL II print job using
 * `@thermal-label/tspl-core` for the spec-aligned subset and
 * marklife-local builders for the upstream-gap (`SET GAP`).
 *
 * Job byte stream:
 *
 *   1. `CLS` — clear buffer.
 *   2. `SIZE w mm,h mm\r\n` — label dimensions.
 *   3. `GAP g mm,o mm\r\n` (die-cut) **or** `BLINE g mm,o mm\r\n`
 *      (continuous with black-line). Continuous-no-mark omits both.
 *   4. `SET GAP ON\r\n` (die-cut) — local-only buildSetGap (D6).
 *   5. `DENSITY n\r\n`.
 *   6. `SPEED n\r\n` (default 4).
 *   7. `BITMAP x,y,widthBytes,height,3,lzoLen,` + LZO bytes + `\r\n`.
 *   8. `PRINT 1\r\n`.
 *
 * Diffs vs. `tspl-core`'s default behaviour:
 *
 * - **Bit polarity.** Marklife packs `1=dark`, inverted from the
 *   TSPL II spec but matching `tspl-core`'s `D1` decision.
 *   `LabelBitmap.data` from `@mbtech-nl/bitmap` is already `1=dark`,
 *   so we hand it straight to the compressor.
 * - **`SET GAP`.** Hosted locally in `protocol.ts`.
 * - **`BITMAP` mode 3.** Despite mode 3 being LZO in the published
 *   TSPL spec, this family's compressor for this path is plain zlib
 *   at default settings — from our own analysis of the family, and
 *   distinct from the 1 KiB-window deflate the YXQ stream uses. Uses
 *   `tsplZlibCompress` (DECISIONS.md § D3).
 */

import type { LabelBitmap } from '@mbtech-nl/bitmap';
import {
  BITMAP_TAIL,
  buildBitmapHeader,
  buildCls,
  buildDensity,
  buildGap,
  buildPrint,
  buildSize,
  buildSpeed,
  concatBytes,
} from '@thermal-label/tspl-core';
import type { MarklifeEngine, MarklifeMedia, MarklifePrintOptions } from '../types.js';
import { tsplZlibCompress } from '../zlib.js';
import { buildSetGap } from './protocol.js';

const enc = new TextEncoder();
const DEFAULT_SPEED = 4;
const DEFAULT_DENSITY = 8;

export interface MarklifeTsplPage {
  bitmap: LabelBitmap;
  media: MarklifeMedia;
  options?: MarklifePrintOptions;
}

export type MarklifeTsplEngine = MarklifeEngine & {
  protocol: 'marklife-tspl';
};

/**
 * Type guard — true when the engine binds to marklife-tspl.
 */
export function isMarklifeTsplEngine(engine: { protocol: string }): engine is MarklifeTsplEngine {
  return engine.protocol === 'marklife-tspl';
}

/**
 * Encode a marklife-tspl print job.
 *
 * Bitmap padding to a multiple of 8 dots is the caller's
 * responsibility (`padBitmap({ widthMod: 8 })` from
 * `@mbtech-nl/bitmap`). The wire format expects `widthBytes =
 * ceil(widthPx / 8)`.
 */
export function encodeMarklifeTsplJob(
  _engine: MarklifeTsplEngine,
  page: MarklifeTsplPage,
): Uint8Array {
  const { bitmap, media, options } = page;
  const widthBytes = Math.ceil(bitmap.widthPx / 8);
  const heightDots = bitmap.heightPx;

  const widthMm = media.widthMm;
  const heightMm = media.type === 'die-cut' ? (media.heightMm ?? widthMm) : widthMm;

  const copies = options?.copies ?? 1;
  const density = resolveDensity(options);
  const speed = DEFAULT_SPEED;

  const compressed = tsplZlibCompress(bitmap.data);

  const parts: Uint8Array[] = [buildCls(), buildSize(widthMm, heightMm)];

  if (media.type === 'die-cut') {
    // Die-cut stock: gap-sense feed + SET GAP ON.
    parts.push(buildGap(2, 0)); // 2 mm gap, 0 offset — typical default
    parts.push(buildSetGap({ on: true }));
  }
  // Continuous stock: emit no GAP/SET GAP — the firmware feeds N mm
  // of media as configured by SIZE.

  parts.push(buildDensity(density));
  parts.push(buildSpeed(speed));

  // BITMAP header. tspl-core's buildBitmapHeader emits
  // `BITMAP x,y,widthBytes,height,mode,` (5 fields). Mode 3 needs a
  // 6th `lzoLen,` field appended before the payload.
  parts.push(buildBitmapHeader(0, 0, widthBytes, heightDots, 3));
  parts.push(enc.encode(`${String(compressed.length)},`));
  parts.push(compressed);
  parts.push(BITMAP_TAIL);

  parts.push(buildPrint(copies));

  return concatBytes(...parts);
}

function resolveDensity(options: MarklifePrintOptions | undefined): number {
  if (options?.densityLevel !== undefined) return options.densityLevel;
  switch (options?.density) {
    case 'light':
      return 5;
    case 'normal':
      return 8;
    case 'dark':
      return 12;
    default:
      return DEFAULT_DENSITY;
  }
}
