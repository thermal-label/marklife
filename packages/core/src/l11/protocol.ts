/**
 * L11 binary-protocol byte builders.
 *
 * L11 drives the narrow-tape P12 / P15 / P11 / P7 chassis. Unlike
 * `marklife-yxq`, it sends an **uncompressed** 1-bpp raster after a
 * `GS v 0` (`1D 76 30`) header — no zlib. Commands are raw byte
 * arrays.
 *
 * Source: public prior art — the `tomLadder/thermoprint` project's
 * L11 reverse-engineering notes (`REVERSE_ENGINEERING.md` § 3.2),
 * cross-checked against on-the-wire behaviour of a bench P12 (the
 * printer ack's `0xAA` on success and runs credit-based flow control
 * over the BLE CX characteristic).
 */

/** ESC J — feed `dots` dots in the paper-feed direction. */
export function buildL11FeedDots(dots: number): Uint8Array {
  return new Uint8Array([0x1b, 0x4a, dots & 0xff]);
}

/** `1D 0C` — advance to the next die-cut / gap label edge. */
export function buildL11PositionToGap(): Uint8Array {
  return new Uint8Array([0x1d, 0x0c]);
}

/** 15 NUL bytes — wake the print engine. */
export function buildL11Wakeup(): Uint8Array {
  return new Uint8Array(15);
}

/** `10 FF F1 02` — enable / activate the print engine. */
export function buildL11Enable(): Uint8Array {
  return new Uint8Array([0x10, 0xff, 0xf1, 0x02]);
}

/** `10 FF F1 45` — end the print session. */
export function buildL11Stop(): Uint8Array {
  return new Uint8Array([0x10, 0xff, 0xf1, 0x45]);
}

/**
 * `1F 70 02 DD` — set print density. `DD` is the L11 density value
 * (the firmware clamps; the catalogue scale is 1 light / 2 normal /
 * 3 dark).
 */
export function buildL11Density(density: number): Uint8Array {
  return new Uint8Array([0x1f, 0x70, 0x02, density & 0xff]);
}

/**
 * `GS v 0` raster header — `1D 76 30 quality wL wH hL hH`.
 *
 * `bytesPerRow` and `height` are little-endian 16-bit fields.
 * `quality` is 0..3 (0 is the standard value). The raw 1-bpp bitmap
 * (`bytesPerRow * height` bytes, MSB-first, `1 = black`) follows the
 * header immediately — no compression, no length field.
 */
export function buildL11BitmapHeader(bytesPerRow: number, height: number, quality = 0): Uint8Array {
  return new Uint8Array([
    0x1d,
    0x76,
    0x30,
    quality & 0x03,
    bytesPerRow & 0xff,
    (bytesPerRow >> 8) & 0xff,
    height & 0xff,
    (height >> 8) & 0xff,
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
