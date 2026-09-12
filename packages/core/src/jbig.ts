/**
 * JBIG raster encoder for `marklife-jbig`.
 *
 * **Deferred in v1** — see DECISIONS.md § D4.
 *
 * The chassis on this protocol wrap their raster bytes in the vendor
 * `1F ( J` opcode (`0x1F 0x28 0x4A`). The payload is JBIG (ITU-T
 * T.82), so a T.82 encoder is needed here.
 *
 * Two implementation options:
 *
 * 1. **JS port** of jbig-kit. Existing JS ports (e.g. `jbig.js`)
 *    exist but are unmaintained; vendor + audit + round-trip tests
 *    against `libjbigkit`. Risk: encoder correctness on edge cases
 *    (the JBIG arithmetic coder is fiddly).
 * 2. **WASM build** of `libjbigkit`. Clean. ~50 KB to web bundle.
 *    Recommended.
 *
 * Until one of those lands, this module exports a stub that throws
 * `UnsupportedOperationError`. Devices declared with
 * `protocol: 'marklife-jbig'` carry `support.status: 'unsupported'`.
 */

import { UnsupportedOperationError } from '@thermal-label/contracts';

/**
 * JBIG-encode a packed 1-bpp bitplane to a JBIG byte stream.
 *
 * Input contract — this is what an implementation must accept:
 *
 * - `plane` — `ceil(width / 8) * height` bytes, row-major, MSB-first,
 *   **bit set = dark pixel**. Not 8-bit greyscale, and not inverted:
 *   it is `LabelBitmap.data` verbatim, so callers pass the bitmap
 *   through untouched.
 * - `width` / `height` — pixel dimensions. `width` need not be a
 *   multiple of 8; the row stride rounds up and the spare low bits of
 *   the last byte in each row are undefined.
 *
 * @throws {UnsupportedOperationError} always — encoder is deferred
 *   in v1. See DECISIONS.md § D4.
 */
export function jbigEncode(_plane: Uint8Array, _width: number, _height: number): Uint8Array {
  throw new UnsupportedOperationError(
    'jbigEncode',
    'marklife-jbig encoder is deferred in v1 — see DECISIONS.md § D4. ' +
      'Affected chassis (D100 / X4 / X8 / U210 / L100) carry support.status: broken until the WASM build of libjbigkit ships.',
  );
}
