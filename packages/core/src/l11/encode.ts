/**
 * L11 job encoder — composes a full print job for the narrow-tape
 * L11 chassis (P12 and family).
 *
 * Job byte stream:
 *
 *   1. Density command (`1F 70 02 DD`) — **optional**, emitted only
 *      when the caller requests a density. A captured P12 job carries
 *      none; the printer uses its stored default.
 *   2. Wakeup (15 NUL bytes).
 *   3. Enable-printer command (`10 FF F1 02`).
 *   4. Raster header (`1D 76 30 …`) + raw 1-bpp bitmap.
 *   5. Feed: `ESC J` for continuous stock, `1D 0C` position-to-gap
 *      for die-cut stock.
 *   6. Stop command (`10 FF F1 45`).
 *
 * The raster is sent **uncompressed** — `LabelBitmap.data` from
 * `@mbtech-nl/bitmap` is already row-major MSB-first `1 = dark`,
 * which is exactly the wire format L11 expects. No zlib, unlike
 * `marklife-yxq`.
 */

import type { LabelBitmap } from '@mbtech-nl/bitmap';
import type { MarklifeEngine, MarklifeMedia, MarklifePrintOptions } from '../types.js';
import {
  buildL11BitmapHeader,
  buildL11Density,
  buildL11Enable,
  buildL11FeedDots,
  buildL11PositionToGap,
  buildL11Stop,
  buildL11Wakeup,
  concatBytes,
} from './protocol.js';

/** Catalogue density scale: 1 light / 2 normal / 3 dark. */
const DEFAULT_DENSITY = 2;

/** Trailing feed for continuous stock, in dots. */
const CONTINUOUS_FEED_DOTS = 100;

export interface L11Page {
  bitmap: LabelBitmap;
  media: MarklifeMedia;
  options?: MarklifePrintOptions;
}

export type L11Engine = MarklifeEngine & {
  protocol: 'marklife-l11';
};

/**
 * Type guard — true when the engine binds to the L11 protocol.
 *
 * Accepts any `{ protocol }` so it can refine entries straight from
 * `DEVICES[…].engines`.
 */
export function isL11Engine(engine: { protocol: string }): engine is L11Engine {
  return engine.protocol === 'marklife-l11';
}

/**
 * Resolve the density byte from the print options. An explicit
 * `densityLevel` wins; otherwise the `'light' | 'normal' | 'dark'`
 * string maps onto the 1 / 2 / 3 scale. Only called once the caller
 * has actually requested a density.
 */
function resolveDensity(options: MarklifePrintOptions): number {
  if (options.densityLevel !== undefined) return options.densityLevel;
  switch (options.density) {
    case 'light':
      return 1;
    case 'dark':
      return 3;
    default:
      return DEFAULT_DENSITY; // 'normal'
  }
}

/**
 * Encode a marklife-l11 print job.
 *
 * The bitmap is consumed as-is: `LabelBitmap.data` is already packed
 * to a `ceil(widthPx / 8)`-byte row stride, MSB-first, `1 = dark` —
 * the L11 raw raster format. Width-padding to a byte boundary is the
 * bitmap library's job; this encoder does not pre-transform.
 */
export function encodeL11Job(_engine: L11Engine, page: L11Page): Uint8Array {
  const { bitmap } = page;
  const bytesPerRow = Math.ceil(bitmap.widthPx / 8);
  const height = bitmap.heightPx;

  // `LabelBitmap.data` is always `bytesPerRow * height` for a
  // bitmap-library bitmap; guard with a conservative copy in case a
  // caller hands in a hand-built bitmap with a mismatched buffer.
  const expected = bytesPerRow * height;
  let raster = bitmap.data;
  if (raster.length !== expected) {
    const fixed = new Uint8Array(expected);
    fixed.set(raster.subarray(0, Math.min(raster.length, expected)));
    raster = fixed;
  }

  const wakeup = buildL11Wakeup();
  const enable = buildL11Enable();
  const header = buildL11BitmapHeader(bytesPerRow, height);
  // Continuous stock feeds a fixed advance; die-cut / gap stock
  // registers to the next label edge.
  const feed =
    page.media.type === 'continuous'
      ? buildL11FeedDots(CONTINUOUS_FEED_DOTS)
      : buildL11PositionToGap();
  const stop = buildL11Stop();

  // Density is opt-in — emit `1F 70 02 DD` only when the caller asks
  // for one. A captured P12 job carries no density command; the
  // printer uses its stored default.
  const opts = page.options;
  const parts =
    opts && (opts.density !== undefined || opts.densityLevel !== undefined)
      ? [buildL11Density(resolveDensity(opts)), wakeup, enable, header, raster, feed, stop]
      : [wakeup, enable, header, raster, feed, stop];

  return concatBytes(...parts);
}
