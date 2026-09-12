/**
 * `marklife-jbig` byte builders.
 *
 * Two chassis families share this dialect, and they differ in more
 * than a constant:
 *
 * - **protocol id 12** (D100) — `GS L` + 864-dot print width,
 *   density on every copy, print speed prepended to the whole job,
 *   feed markers gated on paper type.
 * - **protocol id 7** (X4 / L100) — no `GS L`, 800-dot print
 *   width, a paper-type prelude and density on the first copy only,
 *   print speed inside each copy's header, pre-raster marker
 *   unconditional.
 *
 * Protocol id 10 (X8 / U210) carries the same
 * `marklife-jbig` tag but is a different wire protocol; `encode.ts`
 * rejects it rather than emitting an id-12-shaped job.
 *
 * **Unverified.** No chassis on this protocol has ever been on the
 * bench and there is no capture behind these bytes — every value and
 * every branch below is inference.
 *
 * Opcodes:
 *
 * - **`1F 28 73 02 00 spdL spdH`** — print speed, little-endian u16.
 *   Shaped like Epson's `GS ( s` but on the vendor `0x1F` prefix.
 *   OOS in `escpos-core@0.2.1`; hosted here.
 * - **`GS L nL nH` (`0x1D 0x4C`)** — left margin. Spec; not in
 *   `escpos-core` either. Emitted by id 12 only.
 * - **`GS W nL nH` (`0x1D 0x57`)** — print width.
 * - **`ESC a n` (`0x1B 0x61`)** — justify (0 left, 1 center, 2 right).
 *   OOS in `escpos-core@0.2.1`; hosted here.
 * - **`FF` (`0x0C`)** — form feed. Universal Epson; OOS in
 *   `escpos-core@0.2.1` (DECISIONS.md § D6); hosted here.
 * - **`GS FF` (`0x1D 0x0C`)** — print and home (page mode). Doubles as
 *   the black-mark trailer.
 * - **`1F 80 01 n`** — paper-type prelude. Id 7 only.
 * - **`1A 0C FF` / `1A 0C 00`** — pre-raster and post-raster feed
 *   markers. Without the pair the head buffers the page and idles.
 * - **`1F 28 4A pL pH wL wH hL`** — vendor JBIG raster wrapper.
 */

/**
 * Paper type as the wire expresses it.
 *
 * Only `continuous` and `gap` are reachable from the media registry
 * today — `MediaDescriptor.type` has no black-mark member, so the two
 * black-mark modes cannot be selected until that vocabulary grows.
 * They are implemented because the trailer differs per mode and a
 * wrong trailer stalls the head.
 */
export type JbigPaperType = 'continuous' | 'gap' | 'black-mark' | 'black-mark-2';

/** Paper-type byte for the id-7 `1F 80 01 n` prelude. */
const PAPER_TYPE_CODES: Record<JbigPaperType, number> = {
  continuous: 0x10,
  gap: 0x20,
  'black-mark': 0x30,
  'black-mark-2': 0x40,
};

/**
 * Print speed — `1F 28 73 02 00 spdL spdH`.
 *
 * The parameter word is the speed from `computeJbigPrintSpeedId7` /
 * `computeJbigPrintSpeedId12`, little-endian. Position is
 * load-bearing: this block must precede the raster (see `encode.ts`),
 * because a speed set after the page is committed does nothing and
 * the trailing bytes land in undefined parser state.
 */
export function buildGsLeftParenS(printSpeed: number): Uint8Array {
  return new Uint8Array([
    0x1f,
    0x28,
    0x73,
    0x02,
    0x00,
    printSpeed & 0xff,
    (printSpeed >> 8) & 0xff,
  ]);
}

/** Set left margin in standard mode — `GS L nL nH`. Id 12 only. */
export function buildGsLeftMargin(leftDots: number): Uint8Array {
  return new Uint8Array([0x1d, 0x4c, leftDots & 0xff, (leftDots >> 8) & 0xff]);
}

/** Set print width in standard mode — `GS W nL nH`. */
export function buildGsPrintWidth(widthDots: number): Uint8Array {
  return new Uint8Array([0x1d, 0x57, widthDots & 0xff, (widthDots >> 8) & 0xff]);
}

/**
 * Print width in dots, per protocol id — 800 on id 7, 864 on id 12.
 *
 * These are head-independent page widths, not `engine.headDots`; both
 * families declare 384 head dots. `encode.ts` rejects every other id,
 * so the id-12 value is also the fallback.
 */
export function jbigPrintWidthDots(protocolId: number): number {
  return protocolId === 7 ? 0x0320 : 0x0360;
}

/**
 * Justify — `ESC a n` (0 = left, 1 = center, 2 = right).
 *
 * Real Epson spec but OOS in `escpos-core@0.2.1` (vendor extension
 * of bitmap-only scope). Flagged upstream to escpos-core@0.3.0.
 */
export function buildEscJustify(mode: 0 | 1 | 2): Uint8Array {
  return new Uint8Array([0x1b, 0x61, mode]);
}

/**
 * Form feed — `FF` (`0x0C`).
 *
 * Universal Epson spec but OOS in `escpos-core@0.2.1`. Hosted here
 * temporarily; flagged upstream to escpos-core@0.3.0 (DECISIONS.md
 * § D6).
 */
export function buildFormFeed(): Uint8Array {
  return new Uint8Array([0x0c]);
}

/** GS FF — print page contents and return to standard mode. */
export function buildGsFormFeed(): Uint8Array {
  return new Uint8Array([0x1d, 0x0c]);
}

/**
 * Paper-type prelude — `1F 80 01 n`. Id 7 only; empty elsewhere.
 *
 * Id 12 has no paper-type command at all: it expresses the same
 * choice through the feed markers (`buildJbigPreRasterMarker` /
 * `buildJbigTrailer`) instead.
 */
export function buildJbigPaperType(protocolId: number, paperType: JbigPaperType): Uint8Array {
  if (protocolId !== 7) return new Uint8Array(0);
  return new Uint8Array([0x1f, 0x80, 0x01, PAPER_TYPE_CODES[paperType]]);
}

/**
 * Pre-raster feed marker — `1A 0C FF`, immediately before the raster
 * block.
 *
 * Unconditional on id 7; gap stock only on id 12. Paired with
 * `buildJbigTrailer`: without the pair the head buffers the page and
 * never runs the motor.
 */
export function buildJbigPreRasterMarker(protocolId: number, paperType: JbigPaperType): Uint8Array {
  if (protocolId === 7) return new Uint8Array([0x1a, 0x0c, 0xff]);
  if (protocolId === 12 && paperType === 'gap') return new Uint8Array([0x1a, 0x0c, 0xff]);
  return new Uint8Array(0);
}

/**
 * Job trailer, per id and paper type.
 *
 * - id 7 — `GS FF` on black-mark-2, `1A 0C 00` on everything else.
 * - id 12 — `1A 0C 00` on gap, `GS FF` on black-mark, nothing on
 *   continuous or black-mark-2 (those two close the page on their
 *   own).
 *
 * The empty id-12 branches are deliberate, not a gap: an extra feed
 * on continuous stock advances blank media on every copy.
 */
export function buildJbigTrailer(protocolId: number, paperType: JbigPaperType): Uint8Array {
  if (protocolId === 7) {
    return paperType === 'black-mark-2' ? buildGsFormFeed() : new Uint8Array([0x1a, 0x0c, 0x00]);
  }
  if (protocolId !== 12) return new Uint8Array(0);
  if (paperType === 'gap') return new Uint8Array([0x1a, 0x0c, 0x00]);
  if (paperType === 'black-mark') return buildGsFormFeed();
  return new Uint8Array(0);
}

/**
 * Print speed for id 12 — derived from the **assembled job body**,
 * not from the payload:
 *
 *   len   = jobBodyLen / 20480
 *   speed = min(150, clamp(round((heightDots / 8) / len), 30, 300))
 *
 * `jobBodyLen` spans density through trailer, payload included. Feed
 * it the payload length instead and the ratio is off by the wrapper
 * overhead; use the id-7 divisor and it is off by ~51x, which pins
 * every job at the 150 cap.
 */
export function computeJbigPrintSpeedId12(heightDots: number, jobBodyLen: number): number {
  const len = jobBodyLen / 20480;
  // A zero-length body cannot happen (the wrapper alone is 14+ bytes);
  // guard so a caller passing 0 gets the cap rather than NaN.
  if (!(len > 0)) return 150;
  let speed = Math.round(heightDots / 8 / len);
  if (speed < 30) speed = 30;
  if (speed > 300) speed = 300;
  return Math.min(150, speed);
}

/**
 * Print speed for id 7 — a different formula, not a variant:
 *
 *   speed = trunc((heightDots / 8) / (payloadLen / 262144))
 *
 * Payload length only, no clamp and no 150 cap. Values above 0xFFFF
 * are truncated to 16 bits by `buildGsLeftParenS`.
 */
export function computeJbigPrintSpeedId7(heightDots: number, payloadLen: number): number {
  const len = payloadLen / 262144;
  // Guard only: a JBIG payload is never empty, and the division would
  // otherwise put Infinity into the speed word.
  if (!(len > 0)) return 0;
  return Math.trunc(heightDots / 8 / len);
}

/**
 * Vendor `1F ( J` wrapper around a JBIG-encoded payload.
 *
 * Header layout:
 *
 *   1F 28 4A pL pH wL wH hL
 *
 * Where:
 * - `pL pH` — JBIG payload byte-length, little-endian u16. A payload
 *   over 65535 bytes has no representation here.
 * - `wL wH` — bitmap width in **dots** (not bytes), little-endian u16.
 * - `hL` — bitmap height, low byte only. Heights of 256 dots and up
 *   have no high byte anywhere in this framing; unresolved.
 *
 * The payload bytes are appended after the 8-byte header.
 */
export function buildGsLeftParenJ(
  payloadLen: number,
  widthDots: number,
  heightDots: number,
): Uint8Array {
  return new Uint8Array([
    // 0x1F, not GS. This is a vendor `1F (` opcode, not the Epson
    // `GS (` it resembles — sending 0x1D makes the firmware consume
    // 0x4A as a function code and eat raster bytes as parameters.
    0x1f,
    0x28,
    0x4a,
    payloadLen & 0xff,
    (payloadLen >> 8) & 0xff,
    widthDots & 0xff,
    (widthDots >> 8) & 0xff,
    heightDots & 0xff,
  ]);
}

/**
 * Vendor density byte — `[0x12, 0x23, density]`.
 *
 * Density is mapped from a 1..3 host value to
 * (4, 9, 13) firmware codes; default 10. Not in any Epson spec —
 * vendor opcode.
 */
export function buildJbigDensity(level: number): Uint8Array {
  // Caller passes a 1..3 host code.
  let mapped = 10;
  if (level === 1) mapped = 4;
  else if (level === 2) mapped = 9;
  else if (level === 3) mapped = 13;
  return new Uint8Array([0x12, 0x23, mapped & 0xff]);
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
