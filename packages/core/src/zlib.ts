/**
 * zlib wrapper for `marklife-yxq`.
 *
 * Backed by `pako`, not `node:zlib`. This package runs in browsers as
 * well as Node, and a Node builtin forces every browser consumer to
 * alias it and re-supply the options below — which is precisely how
 * the harness lost `windowBits` and spent two days on a printer that
 * accepted jobs and printed nothing. pako is byte-identical to
 * `node:zlib` at these settings (asserted in the tests), so one
 * implementation serves both runtimes and there is nothing left to
 * substitute.
 *
 * The compressed raster that follows the `1F 10 …` header is a zlib
 * stream deflated with a **1 KiB window** (`windowBits` 10), level 6.
 * Both are bench-confirmed on the S2 and visible in every captured S2
 * job (CMF byte `0x28`). A printer this size has every reason to run
 * a small inflate window — a 1 KiB window costs 1 KiB of RAM, a
 * 32 KiB one costs 32.
 *
 * The asymmetry matters. A decoder with a large window can always read
 * a stream written with a smaller one, but **not the reverse**: a
 * printer holding a 1 KiB window cannot inflate a 32 KiB-window
 * stream, and drops the raster. So emitting `windowBits: 10` is the
 * conservative choice in both directions — still valid zlib for any
 * standard decoder, and decodable by a constrained one.
 *
 * See DECISIONS.md § D2.
 */

import { deflate, inflate } from 'pako';

const VENDOR_LEVEL = 6;
/** 1 KiB sliding window — see the note above. */
const VENDOR_WINDOW_BITS = 10;

/**
 * Compress to vendor-zlib format: zlib container, level 6, 1 KiB
 * window. Output is readable by any standard zlib decoder.
 */
export function yxqZlibCompress(input: Uint8Array): Uint8Array {
  return deflate(input, { level: VENDOR_LEVEL, windowBits: VENDOR_WINDOW_BITS });
}

/**
 * Decompress vendor-zlib bytes. Used by tests for round-trip
 * verification and by the status parser when receiving vendor
 * replies that include zlib-compressed payloads (rare).
 *
 * Deliberately left at the default window: inflate must accept the
 * printer's own streams as well as ours, and a large window reads
 * everything a small one can.
 */
export function yxqZlibDecompress(input: Uint8Array): Uint8Array {
  return inflate(input);
}

/**
 * Compress for the TSPL `BITMAP …,3,…` path.
 *
 * A different path with stock zlib defaults — level 6, `windowBits`
 * 15 — not the 1 KiB window the YXQ stream needs. The two must not be
 * conflated; sharing one helper between them would silently give one
 * of the paths the wrong window.
 */
export function tsplZlibCompress(input: Uint8Array): Uint8Array {
  return deflate(input, { level: VENDOR_LEVEL });
}
