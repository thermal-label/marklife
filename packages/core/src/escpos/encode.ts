/**
 * `marklife-escpos` job encoder — composes a vanilla Epson ESC/POS
 * job using `@thermal-label/escpos-core` for the spec-aligned
 * subset and marklife-local builders for the upstream-gap
 * (`buildFormFeed`) and the vendor `buildPrinterWake`.
 *
 * Job byte stream (the bitmap-relevant subset):
 *
 *   1. `ESC @` — reset (re-exported from escpos-core).
 *   2. `printerWake` — six NULs (vendor preamble).
 *   3. `GS L 0 0` — left margin = 0 (re-exported).
 *   4. `GS W ww wh` — print width (re-exported; from media or head).
 *   5. `ESC 3 n` / `ESC 2` — line spacing (re-exported).
 *   6. `ESC N 7 n` — density (re-exported).
 *   7. `GS v 0 m wL wH hL hH` + raster bytes — re-exported.
 *   8. `FF` — form feed (local-only; D6 upstream gap).
 *   9. `ESC J n` (optional) — feed lines (re-exported).
 *
 * Diffs vs. `escpos-core`'s default behaviour:
 *
 * - **Width truncation.** Wire format uses `widthBytes = width / 8`
 *   truncating, **not** `(width + 7) / 8`. The encoder pads bitmap
 *   width to a multiple of 8 dots before invoking. Caller's
 *   responsibility (`padBitmap({ widthMod: 8 })`).
 * - **`FF`** hosted locally; flagged upstream.
 * - **`printerWake`** is a vendor opcode (six NULs).
 * - **Out of v1 scope:** every text / barcode / QR / page-mode
 *   feature of ESC/POS (per the bitmap-only scope).
 */

import type { LabelBitmap } from '@mbtech-nl/bitmap';
import {
  buildEscposReset,
  buildEscposDensity,
  buildFeedLines,
  buildGsV0Raster,
  buildLeftMargin,
  buildLineSpacing,
  buildPrintWidth,
  concatBytes,
} from '@thermal-label/escpos-core';
import type { MarklifeEngine, MarklifeMedia, MarklifePrintOptions } from '../types.js';
import { buildFormFeed, buildPrinterWake } from './protocol.js';

const DEFAULT_DENSITY = 8;
const DEFAULT_PRINT_WIDTH_DOTS = 384; // 2"-class default
const DEFAULT_TRAILING_FEED = 4;

export interface MarklifeEscposPage {
  bitmap: LabelBitmap;
  media: MarklifeMedia;
  options?: MarklifePrintOptions;
}

export type MarklifeEscposEngine = MarklifeEngine & {
  protocol: 'marklife-escpos';
};

export function isMarklifeEscposEngine(engine: {
  protocol: string;
}): engine is MarklifeEscposEngine {
  return engine.protocol === 'marklife-escpos';
}

/**
 * Encode a marklife-escpos print job.
 *
 * The bitmap row-stride must be a multiple of 8 dots (caller-padded).
 * Wire-format width = `widthPx / 8` truncating; pixels past the last
 * 8-dot boundary are silently dropped if not pre-padded.
 */
export function encodeMarklifeEscposJob(
  engine: MarklifeEscposEngine,
  page: MarklifeEscposPage,
): Uint8Array {
  const { bitmap, options } = page;

  // ceil, not floor. Every raster path in this family rounds the row
  // stride up; flooring silently dropped the last 1-7 columns of any
  // width that is not a multiple of 8, and produced a zero-width
  // raster — printing nothing — for anything under 8 dots wide. The
  // bitmap library already packs rows at ceil(widthPx/8), so the
  // buffer is wire-ready as-is.
  const widthBytes = Math.ceil(bitmap.widthPx / 8);
  const heightDots = bitmap.heightPx;
  const headWidthMm = engine.capabilities?.headWidthMm;
  let printWidthDots = DEFAULT_PRINT_WIDTH_DOTS;
  if (typeof headWidthMm === 'number') {
    printWidthDots = Math.round(headWidthMm * 8);
  } else if (engine.headDots > 0) {
    printWidthDots = engine.headDots;
  }

  const density = resolveDensity(options);

  const parts: Uint8Array[] = [
    buildEscposReset(),
    buildPrinterWake(),
    buildLeftMargin(0),
    buildPrintWidth(printWidthDots),
    buildLineSpacing(0),
    buildEscposDensity(density),
    buildGsV0Raster(widthBytes, heightDots),
    sliceRasterRows(bitmap, widthBytes, heightDots),
    buildFormFeed(),
    buildFeedLines(DEFAULT_TRAILING_FEED),
  ];

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

/**
 * Slice the bitmap to the wire format's expected row stride.
 *
 * `LabelBitmap.data` is `ceil(widthPx/8) * heightPx` bytes; the wire
 * format expects `ceil(widthPx/8) * heightPx`. When `widthPx` is a
 * multiple of 8 these are identical (the typical case after a
 * caller-side `padBitmap({ widthMod: 8 })`). For non-multiple-of-8
 * widths we drop the trailing ragged byte per row.
 */
/**
 * Row stride is now always `ceil(widthPx/8)`, which is exactly how the
 * bitmap library packs, so this is an identity for every input. It is
 * kept as the one place that would need to change if a chassis ever
 * turns out to want a truncated stride.
 */
function sliceRasterRows(bitmap: LabelBitmap, widthBytes: number, heightDots: number): Uint8Array {
  const inputStride = Math.ceil(bitmap.widthPx / 8);
  if (inputStride === widthBytes) {
    return bitmap.data;
  }
  const out = new Uint8Array(widthBytes * heightDots);
  for (let y = 0; y < heightDots; y++) {
    out.set(bitmap.data.subarray(y * inputStride, y * inputStride + widthBytes), y * widthBytes);
  }
  return out;
}
