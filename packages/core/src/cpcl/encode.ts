/**
 * CPCL-dialect job encoder.
 *
 * **Unverified.** No CPCL chassis has ever reached the bench. The job
 * shape below comes from our own wire analysis, not from hardware.
 *
 * Job byte stream:
 *
 *   1. `1F 80 01 <code>` — paper type (`0x10` gap, `0x40` continuous).
 *   2. `! 0 200 200 <heightDots> 1\r\n` — CPCL page header.
 *   3. `PAGE-WIDTH <widthDots>\r\n`.
 *   4. `ZG <widthBytes> <heightDots> 0 0 ` + 4-byte big-endian
 *      compressed length + zlib payload + `\r\n\r\n`.
 *   5. `GAP-SENSE\r\nFORM\r\n` — gap stock only.
 *   6. `PRINT\r\n`.
 *
 * No density command anywhere on this path: none has been observed
 * for this family's CPCL job, so emitting one would be inventing wire
 * traffic the chassis has never been shown to accept.
 *
 * The raster is `LabelBitmap.data` handed over untouched: it is
 * already `ceil(widthPx / 8)` bytes per row, MSB-first, `1 = dark`,
 * which is exactly what `ZG` expects. Re-packing would invert or
 * mirror the image.
 */

import type { LabelBitmap } from '@mbtech-nl/bitmap';
import type { MarklifeEngine, MarklifeMedia, MarklifePrintOptions } from '../types.js';
import { yxqZlibCompress } from '../zlib.js';
import {
  CPCL_PAPER_TYPE_CONTINUOUS,
  CPCL_PAPER_TYPE_GAP,
  CPCL_RASTER_TAIL,
  buildCpclGapSense,
  buildCpclPageHeader,
  buildCpclPageWidth,
  buildCpclPaperType,
  buildCpclPrint,
  buildCpclRasterHeader,
  concatBytes,
} from './protocol.js';

export interface CpclPage {
  bitmap: LabelBitmap;
  media: MarklifeMedia;
  options?: MarklifePrintOptions;
}

export type CpclEngine = MarklifeEngine & {
  protocol: 'marklife-cpcl';
};

/**
 * Type guard — true when the engine binds to the CPCL protocol.
 *
 * Accepts any `{ protocol }` so it can refine entries straight from
 * `DEVICES[…].engines`.
 */
export function isCpclEngine(engine: { protocol: string }): engine is CpclEngine {
  return engine.protocol === 'marklife-cpcl';
}

/**
 * Encode a marklife-cpcl print job.
 *
 * Width padding to a byte boundary is the bitmap library's job
 * (`padBitmap({ widthMod: 8 })`); this encoder does not pre-transform.
 */
export function encodeCpclJob(engine: CpclEngine, page: CpclPage): Uint8Array {
  const { bitmap, media } = page;
  const widthBytes = Math.ceil(bitmap.widthPx / 8);
  const heightDots = bitmap.heightPx;

  // PAGE-WIDTH is clamped to the head: the coordinate path tops out at
  // the head width, and a page declared wider than the head has no
  // dots behind its right-hand columns.
  const widthDots = Math.min(bitmap.widthPx, engine.headDots);

  // The wire raster is `LabelBitmap.data` verbatim — see the module
  // header. Only the buffer length is checked, in case a caller
  // hand-builds a bitmap with a stride that does not match its width.
  const expected = widthBytes * heightDots;
  let raster = bitmap.data;
  if (raster.length !== expected) {
    const fixed = new Uint8Array(expected);
    fixed.set(raster.subarray(0, Math.min(raster.length, expected)));
    raster = fixed;
  }

  // Same 1 KiB-window deflate as the YXQ raster (DECISIONS.md § D2).
  // Not `tsplZlibCompress` — that one runs the stock 32 KiB window,
  // which a 1 KiB inflate window cannot read.
  const compressed = yxqZlibCompress(raster);

  const isContinuous = media.type === 'continuous';

  const parts: Uint8Array[] = [
    buildCpclPaperType(isContinuous ? CPCL_PAPER_TYPE_CONTINUOUS : CPCL_PAPER_TYPE_GAP),
    buildCpclPageHeader(heightDots),
    buildCpclPageWidth(widthDots),
    buildCpclRasterHeader(widthBytes, heightDots, compressed.length),
    compressed,
    CPCL_RASTER_TAIL,
  ];

  // Gap stock registers to the next die-cut edge before printing.
  if (!isContinuous) parts.push(buildCpclGapSense());

  parts.push(buildCpclPrint());

  return concatBytes(...parts);
}
