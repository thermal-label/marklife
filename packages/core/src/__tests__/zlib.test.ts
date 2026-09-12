import { deflateSync, inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { yxqZlibCompress, yxqZlibDecompress } from '../zlib.js';

/** A 48 B/row × 240-row raster — the shape a 50 × 30 mm label produces. */
function ditherRaster(): Uint8Array {
  const raw = new Uint8Array(48 * 240);
  for (let i = 0; i < raw.length; i++) raw[i] = Math.floor(i / 48) % 2 ? 0xaa : 0x55;
  return raw;
}

describe('yxqZlibCompress', () => {
  it('round-trips empty input', () => {
    const compressed = yxqZlibCompress(new Uint8Array());
    const decompressed = yxqZlibDecompress(compressed);
    expect(decompressed).toEqual(new Uint8Array());
  });

  it('round-trips a short ASCII run', () => {
    const input = new TextEncoder().encode('Hello, marklife!');
    const compressed = yxqZlibCompress(input);
    const decompressed = yxqZlibDecompress(compressed);
    expect(decompressed).toEqual(input);
  });

  it('round-trips 4 KiB random-ish input', () => {
    const input = new Uint8Array(4096);
    for (let i = 0; i < 4096; i++) input[i] = ((i * 53) ^ 0xa5) & 0xff;
    const compressed = yxqZlibCompress(input);
    expect(compressed.length).toBeLessThan(input.length + 64); // crude smoke
    const decompressed = yxqZlibDecompress(compressed);
    expect(decompressed).toEqual(input);
  });

  it('round-trips 16 KiB compressible input', () => {
    const input = new Uint8Array(16384);
    input.fill(0); // all-zero raster — heavily compressible
    const compressed = yxqZlibCompress(input);
    expect(compressed.length).toBeLessThan(100); // should compress to a tiny stream
    const decompressed = yxqZlibDecompress(compressed);
    expect(decompressed.length).toBe(16384);
    expect(decompressed.every(b => b === 0)).toBe(true);
  });

  it('emits a zlib container declaring the 1 KiB vendor window', () => {
    const input = new Uint8Array(64);
    input.fill(0xaa);
    const compressed = yxqZlibCompress(input);
    // CMF packs windowBits into its high nibble: (windowBits - 8) << 4
    // | 8. windowBits 10 gives 0x28; the zlib default 15 would give
    // 0x78. The printer's inflate window is the smaller one, and a
    // stream cut with a larger window than the decoder holds is
    // undecodable — so this byte is load-bearing, not cosmetic.
    expect(compressed[0]).toBe(0x28);
    const cmf = compressed[0] ?? 0;
    expect((cmf >> 4) + 8).toBe(10);
    expect(cmf & 0x0f).toBe(8); // deflate method
    // Still a standard container: a default-window inflate reads it.
    expect([...yxqZlibDecompress(compressed)]).toEqual([...input]);
  });
});

describe('yxqZlibCompress — runtime independence', () => {
  const VENDOR = { level: 6, windowBits: 10 } as const;

  // The wrapper runs on pako so it works in a browser unchanged. That
  // is only a safe swap if the wire bytes are the same ones Node
  // produced, so hold the two implementations against each other.
  it('is byte-identical to node:zlib at the vendor settings', () => {
    const raster = ditherRaster();
    expect(yxqZlibCompress(raster)).toEqual(new Uint8Array(deflateSync(raster, VENDOR)));
  });

  // The header byte alone does not prove the stream is decodable by a
  // constrained printer — only that it claims to be. Inflating through
  // a real 1 KiB window is the behavioural check, and it is the one
  // that fails when the window is lost in a bundler substitution.
  it('emits a stream a 1 KiB-window decoder can actually inflate', () => {
    const raster = ditherRaster();
    const inflated = inflateSync(yxqZlibCompress(raster), { windowBits: 10 });
    expect(new Uint8Array(inflated)).toEqual(raster);
  });

  it('and the 32 KiB-window stream it replaces cannot be', () => {
    const wrongWindow = deflateSync(ditherRaster(), { level: 6 });
    expect(wrongWindow[0]).toBe(0x78);
    expect(() => inflateSync(wrongWindow, { windowBits: 10 })).toThrow();
  });
});
