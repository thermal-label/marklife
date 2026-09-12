import { describe, expect, it } from 'vitest';
import { lzoCompress, lzoDecompress } from '../lzo.js';

describe('lzoCompress', () => {
  it('round-trips empty input', () => {
    const compressed = lzoCompress(new Uint8Array());
    expect(Array.from(compressed)).toEqual([0x11, 0x00, 0x00]);
    expect(lzoDecompress(compressed, 0)).toEqual(new Uint8Array());
  });

  it('round-trips short input via first-instruction shortcut', () => {
    const input = new Uint8Array([1, 2, 3, 4, 5]);
    const compressed = lzoCompress(input);
    // 5 + 17 = 22 → first byte 0x16, then literals, then EOS.
    expect(compressed[0]).toBe(22);
    expect(compressed.slice(1, 6)).toEqual(input);
    expect(compressed.slice(6)).toEqual(new Uint8Array([0x11, 0x00, 0x00]));
    expect(lzoDecompress(compressed, input.length)).toEqual(input);
  });

  it('round-trips 238-byte input (boundary of first-instruction shortcut)', () => {
    const input = new Uint8Array(238);
    for (let i = 0; i < 238; i++) input[i] = i & 0xff;
    const compressed = lzoCompress(input);
    expect(compressed[0]).toBe(238 + 17);
    expect(lzoDecompress(compressed, 238)).toEqual(input);
  });

  it('round-trips 239-byte input (first long-literal instruction)', () => {
    const input = new Uint8Array(239);
    for (let i = 0; i < 239; i++) input[i] = (i * 7) & 0xff;
    const compressed = lzoCompress(input);
    expect(compressed[0]).toBe(0);
    expect(lzoDecompress(compressed, 239)).toEqual(input);
  });

  it('round-trips 4 KiB input', () => {
    const input = new Uint8Array(4096);
    for (let i = 0; i < 4096; i++) input[i] = (i * 31) & 0xff;
    const compressed = lzoCompress(input);
    expect(lzoDecompress(compressed, 4096)).toEqual(input);
  });

  it('round-trips 8 KiB input', () => {
    const input = new Uint8Array(8192);
    for (let i = 0; i < 8192; i++) input[i] = ((i * 13) ^ 0xa5) & 0xff;
    const compressed = lzoCompress(input);
    expect(lzoDecompress(compressed, 8192)).toEqual(input);
  });

  it('throws on truncated input', () => {
    expect(() => lzoDecompress(new Uint8Array([0x11, 0x00]), 0)).toThrow(/too short/);
  });

  it('throws on missing EOS marker', () => {
    const compressed = lzoCompress(new Uint8Array([1, 2, 3]));
    const broken = compressed.subarray(0, compressed.length - 1);
    const broken2 = new Uint8Array(broken);
    expect(() => lzoDecompress(broken2, 3)).toThrow();
  });

  it('throws on EOS at offset 0 with non-zero expectedLen', () => {
    expect(() => lzoDecompress(new Uint8Array([0x11, 0x00, 0x00]), 5)).toThrow(/found EOS/);
  });

  it('throws on truncated long-literal extension (zero run never terminated)', () => {
    expect(() => lzoDecompress(new Uint8Array([0x00, 0x00, 0x00, 0x00]), 100)).toThrow(
      /truncated long-literal/,
    );
  });

  it('throws on long-literal with zero terminator', () => {
    // long-literal frame: 0 (regular dispatch) + 0 zero-extension +
    // 0 nz-byte → reject (zero terminator is invalid).
    const broken = new Uint8Array([0x00, 0x00, 0x11, 0x00, 0x00]);
    expect(() => lzoDecompress(broken, 0)).toThrow();
  });

  it('throws on unsupported first byte 1..16 (real M-codes not handled)', () => {
    expect(() => lzoDecompress(new Uint8Array([0x05, 0x11, 0x00, 0x00]), 0)).toThrow(
      /unsupported first byte/,
    );
  });

  it('throws when literal run overflows expected length', () => {
    // first byte 22 → 5 literals; expectedLen 2 < 5 → overflow.
    const compressed = lzoCompress(new Uint8Array([1, 2, 3, 4, 5]));
    expect(() => lzoDecompress(compressed, 2)).toThrow(/overflows expected length/);
  });

  it('throws when literal run truncated', () => {
    // 22 (5 literals expected) but input total is 3 bytes — ip+litCount=6 > 3.
    expect(() => lzoDecompress(new Uint8Array([22, 1, 2]), 5)).toThrow(/literal run truncated/);
  });

  it('throws when produced length doesn’t match expected', () => {
    // Compress 5 bytes but ask for 4.
    const compressed = lzoCompress(new Uint8Array([1, 2, 3, 4, 5]));
    expect(() => lzoDecompress(compressed, 4)).toThrow();
  });
});
