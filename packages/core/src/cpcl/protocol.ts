/**
 * CPCL-dialect byte builders.
 *
 * **Unverified.** No CPCL chassis has ever reached the bench. Every
 * byte below is inferred from our own wire analysis; none of it is
 * confirmed against hardware, and the whole path may be wrong.
 *
 * The dialect is CPCL text — `! 0 …` page header, `PAGE-WIDTH`, `ZG`,
 * `PRINT` — inside a binary envelope:
 *
 *   - A `1F 80 01 <code>` paper-type command precedes the page. Same
 *     opcode shape as the YXQ paper-type command, but emitted
 *     unconditionally rather than gated on a protocol id.
 *   - `ZG` carries a **zlib-deflated** payload behind a 4-byte
 *     big-endian length, not CPCL's stock hex-ASCII bitmap.
 *
 * Everything else in the job is plain ASCII with CRLF terminators.
 */

const enc = new TextEncoder();

/** Head width in dots — inferred, unconfirmed. */
export const CPCL_HEAD_DOTS = 576;

/** Resolution declared in the CPCL preamble, both axes. */
export const CPCL_DPI = 200;

/**
 * Paper-type codes for `1F 80 01 <code>`.
 *
 * Four codes — `0x10`, `0x20`, `0x30`, `0x40` — with gap stock at the
 * low end and continuous stock at the high end (inferred).
 * Our media vocabulary has only `die-cut` and `continuous`, so only
 * these two are reachable; `0x20` and `0x30` are unreachable until the
 * catalogue grows a third and fourth stock kind. Sending the wrong
 * code puts the firmware on the wrong feed strategy — gap-sensing on
 * continuous stock feeds forever looking for an edge.
 */
export const CPCL_PAPER_TYPE_GAP = 0x10;
/** Reserved middle code — no media type maps onto it yet. */
export const CPCL_PAPER_TYPE_RESERVED_20 = 0x20;
/** Reserved middle code — no media type maps onto it yet. */
export const CPCL_PAPER_TYPE_RESERVED_30 = 0x30;
/** Continuous stock. */
export const CPCL_PAPER_TYPE_CONTINUOUS = 0x40;

/**
 * Closes the `ZG` block: `\r\n\r\n`.
 *
 * Two terminators, not one — the first ends the binary payload, the
 * second ends the `ZG` command. A single CRLF leaves the parser inside
 * the raster and it swallows the next command.
 */
export const CPCL_RASTER_TAIL = new Uint8Array([0x0d, 0x0a, 0x0d, 0x0a]);

/** `1F 80 01 <code>` — declare the loaded stock before the page opens. */
export function buildCpclPaperType(code: number): Uint8Array {
  return new Uint8Array([0x1f, 0x80, 0x01, code & 0xff]);
}

/**
 * CPCL page header — `! 0 200 200 <heightDots> 1\r\n`.
 *
 * Fields are: horizontal offset (0), x dpi, y dpi, page height in
 * dots, label count. The count is fixed at 1 — no other value has been
 * seen for this family — so `options.copies` is deliberately not
 * plumbed through here.
 */
export function buildCpclPageHeader(heightDots: number): Uint8Array {
  return enc.encode(`! 0 ${String(CPCL_DPI)} ${String(CPCL_DPI)} ${String(heightDots)} 1\r\n`);
}

/** `PAGE-WIDTH <widthDots>\r\n` — print-area width in dots. */
export function buildCpclPageWidth(widthDots: number): Uint8Array {
  return enc.encode(`PAGE-WIDTH ${String(widthDots)}\r\n`);
}

/**
 * `ZG <widthBytes> <heightDots> 0 0 ` + 4-byte big-endian length.
 *
 * `0 0` is the raster origin. Two details are easy to get wrong and
 * both are fatal:
 *
 *   - The header ends with a **space**, not a newline — the length
 *     bytes butt straight up against it. A CRLF here would be read as
 *     the first two length bytes.
 *   - The length is **big-endian** and counts *compressed* bytes. Wrong
 *     endianness makes the parser wait for a payload that never
 *     arrives; the uncompressed length makes it overrun into the tail.
 */
export function buildCpclRasterHeader(
  widthBytes: number,
  heightDots: number,
  compressedLength: number,
): Uint8Array {
  const header = enc.encode(`ZG ${String(widthBytes)} ${String(heightDots)} 0 0 `);
  const out = new Uint8Array(header.length + 4);
  out.set(header, 0);
  out.set(beUint32(compressedLength), header.length);
  return out;
}

/**
 * `GAP-SENSE\r\nFORM\r\n` — register to the next die-cut edge.
 *
 * Gap stock only. On continuous stock there is no edge to find.
 */
export function buildCpclGapSense(): Uint8Array {
  return enc.encode('GAP-SENSE\r\nFORM\r\n');
}

/** `PRINT\r\n` — commit the page. Nothing images without it. */
export function buildCpclPrint(): Uint8Array {
  return enc.encode('PRINT\r\n');
}

/** 4-byte big-endian unsigned integer. */
function beUint32(value: number): Uint8Array {
  return new Uint8Array([
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ]);
}

/** Concatenate a list of byte arrays into one. */
export function concatBytes(...parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}
