/**
 * LZO1X-1 encoding for the marklife driver.
 *
 * **What this is.** A bit-correct LZO1X-1 byte stream is one that any
 * `lzo1x_decompress` / `lzo1x_decompress_safe` (`liblzo2`, miniLZO,
 * lzokay, …) will decompress to the original input. Kept as a
 * correct encoder; not on any print path — see DECISIONS.md § D3.
 *
 * **What this isn't.** A match-finding compressor. The encoder below
 * emits the input as a single literal run plus an end-of-stream
 * marker. Trade-off: ~1.0–2.5× wire-size vs a match-finding encoder,
 * dramatically simpler to maintain. Same algorithm choice labelife
 * landed on — once `@thermal-label/lzo` (or `@mbtech-nl/lzo`) is
 * extracted, switch the import.
 *
 * Used by `marklife-tspl` for the `BITMAP …,3,…` mode-3 path. Marklife
 * does not use the chunked-framing variants labelife uses for mode-4.
 */

const EOS_MARKER = new Uint8Array([0x11, 0x00, 0x00]);
const EOS_LEN = EOS_MARKER.length;

/**
 * LZO1X-1 compress — emits `input` as a single literal run plus the
 * standard 3-byte end-of-stream marker.
 */
export function lzoCompress(input: Uint8Array): Uint8Array {
  const N = input.length;

  if (N === 0) {
    return new Uint8Array(EOS_MARKER);
  }

  if (N <= 238) {
    const out = new Uint8Array(N + 1 + EOS_LEN);
    out[0] = N + 17;
    out.set(input, 1);
    out.set(EOS_MARKER, N + 1);
    return out;
  }

  const target = N - 18;
  const zeros = Math.floor((target - 1) / 255);
  const nz = target - zeros * 255;
  const headerLen = 1 + zeros + 1;
  const out = new Uint8Array(headerLen + N + EOS_LEN);
  let ip = 0;
  out[ip++] = 0;
  for (let i = 0; i < zeros; i++) out[ip++] = 0;
  out[ip++] = nz;
  out.set(input, ip);
  ip += N;
  out.set(EOS_MARKER, ip);
  return out;
}

/**
 * LZO1X-1 decompressor — sufficient for round-trip testing the
 * encoder above. Handles only the literal-only streams `lzoCompress`
 * produces; full match-resolving decoder is unnecessary because the
 * driver never reads LZO bytes back from a printer.
 */
export function lzoDecompress(input: Uint8Array, expectedLen: number): Uint8Array {
  const out = new Uint8Array(expectedLen);
  let ip = 0;
  let op = 0;

  if (input.length < EOS_LEN) {
    throw new Error(`lzoDecompress: input too short (${String(input.length)} bytes)`);
  }

  const t0 = input[ip++] ?? 0;
  let litCount: number;

  if (t0 === 0x11 && input[ip] === 0 && input[ip + 1] === 0) {
    if (expectedLen !== 0) {
      throw new Error(
        `lzoDecompress: expected ${String(expectedLen)} bytes, found EOS at offset 0`,
      );
    }
    return out;
  }

  if (t0 > 17) {
    litCount = t0 - 17;
  } else if (t0 === 0) {
    let zeros = 0;
    while (input[ip] === 0) {
      zeros++;
      ip++;
      if (ip >= input.length) {
        throw new Error('lzoDecompress: truncated long-literal extension');
      }
    }
    const nz = input[ip++] ?? 0;
    if (nz === 0) {
      throw new Error('lzoDecompress: invalid long-literal — expected nonzero terminator');
    }
    litCount = 18 + zeros * 255 + nz;
  } else {
    throw new Error(`lzoDecompress: unsupported first byte 0x${t0.toString(16).padStart(2, '0')}`);
  }

  if (op + litCount > expectedLen) {
    throw new Error(
      `lzoDecompress: literal run (${String(litCount)}) overflows expected length (${String(expectedLen)})`,
    );
  }
  if (ip + litCount > input.length) {
    throw new Error('lzoDecompress: literal run truncated');
  }

  for (let i = 0; i < litCount; i++) out[op++] = input[ip++] ?? 0;

  if (input[ip] !== 0x11 || input[ip + 1] !== 0x00 || input[ip + 2] !== 0x00) {
    throw new Error(
      `lzoDecompress: expected EOS marker, got [${String(input[ip] ?? -1)}, ${String(input[ip + 1] ?? -1)}, ${String(input[ip + 2] ?? -1)}]`,
    );
  }
  ip += EOS_LEN;

  if (op !== expectedLen) {
    throw new Error(`lzoDecompress: produced ${String(op)} bytes, expected ${String(expectedLen)}`);
  }

  return out;
}
