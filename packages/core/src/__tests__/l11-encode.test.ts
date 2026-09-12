import { describe, expect, it } from 'vitest';
import type { LabelBitmap } from '@mbtech-nl/bitmap';
import { DEVICES } from '../devices.js';
import { MEDIA } from '../media.js';
import { buildL11BitmapHeader, encodeL11Job, isL11Engine, type L11Engine } from '../l11/index.js';

function createBitmap(widthPx: number, heightPx: number, fillByte = 0): LabelBitmap {
  const bytesPerRow = Math.ceil(widthPx / 8);
  const data = new Uint8Array(bytesPerRow * heightPx);
  data.fill(fillByte);
  return { widthPx, heightPx, data };
}

const engine = DEVICES.P12.engines[0] as L11Engine;

describe('isL11Engine', () => {
  it('matches engines bound to marklife-l11 (P12)', () => {
    expect(isL11Engine(engine)).toBe(true);
  });

  it('rejects engines bound to other protocols', () => {
    expect(isL11Engine(DEVICES.S8.engines[0]!)).toBe(false);
    expect(isL11Engine(DEVICES.D100.engines[0]!)).toBe(false);
  });
});

describe('buildL11BitmapHeader', () => {
  it('emits GS v 0 with little-endian bytesPerRow + height', () => {
    expect(Array.from(buildL11BitmapHeader(12, 20))).toEqual([
      0x1d, 0x76, 0x30, 0x00, 12, 0, 20, 0,
    ]);
  });

  it('encodes 16-bit dimensions little-endian', () => {
    // bytesPerRow 300 → 2C 01, height 512 → 00 02
    expect(Array.from(buildL11BitmapHeader(300, 512))).toEqual([
      0x1d, 0x76, 0x30, 0x00, 0x2c, 0x01, 0x00, 0x02,
    ]);
  });

  it('clamps the quality nibble to 0..3', () => {
    expect(buildL11BitmapHeader(1, 1, 9)[3]).toBe(1);
  });
});

describe('encodeL11Job', () => {
  const bitmap = createBitmap(96, 20, 0xab); // bytesPerRow 12, 240 raster bytes

  it('composes wakeup / enable / header / raster / feed / stop — no density by default', () => {
    const out = encodeL11Job(engine, { bitmap, media: MEDIA.CONTINUOUS_15MM });
    expect(Array.from(out.subarray(0, 15))).toEqual(new Array(15).fill(0)); // wakeup
    expect(Array.from(out.subarray(15, 19))).toEqual([0x10, 0xff, 0xf1, 0x02]); // enable
    expect(Array.from(out.subarray(19, 27))).toEqual([0x1d, 0x76, 0x30, 0x00, 12, 0, 20, 0]); // header
    expect(Array.from(out.subarray(out.length - 4))).toEqual([0x10, 0xff, 0xf1, 0x45]); // stop
    // a captured P12 job carries no density command — neither do we, unprompted
    expect(out[0]).not.toBe(0x1f);
  });

  it('embeds the raw bitmap uncompressed', () => {
    const out = encodeL11Job(engine, { bitmap, media: MEDIA.CONTINUOUS_15MM });
    const raster = out.subarray(27, 27 + bitmap.data.length);
    expect(Array.from(raster)).toEqual(Array.from(bitmap.data));
  });

  it('uses ESC J feed for continuous stock', () => {
    const out = encodeL11Job(engine, { bitmap, media: MEDIA.CONTINUOUS_15MM });
    expect(Array.from(out.subarray(out.length - 7, out.length - 4))).toEqual([0x1b, 0x4a, 100]);
  });

  it('uses position-to-gap for die-cut stock', () => {
    const out = encodeL11Job(engine, { bitmap, media: MEDIA.GAP_50X30 });
    expect(Array.from(out.subarray(out.length - 6, out.length - 4))).toEqual([0x1d, 0x0c]);
  });

  it('prepends a density command only when a density is requested', () => {
    const normal = encodeL11Job(engine, {
      bitmap,
      media: MEDIA.CONTINUOUS_15MM,
      options: { density: 'normal' },
    });
    expect(Array.from(normal.subarray(0, 4))).toEqual([0x1f, 0x70, 0x02, 2]);
    const light = encodeL11Job(engine, {
      bitmap,
      media: MEDIA.CONTINUOUS_15MM,
      options: { density: 'light' },
    });
    expect(Array.from(light.subarray(0, 4))).toEqual([0x1f, 0x70, 0x02, 1]);
    const dark = encodeL11Job(engine, {
      bitmap,
      media: MEDIA.CONTINUOUS_15MM,
      options: { density: 'dark' },
    });
    expect(Array.from(dark.subarray(0, 4))).toEqual([0x1f, 0x70, 0x02, 3]);
  });

  it('honours an explicit densityLevel override', () => {
    const out = encodeL11Job(engine, {
      bitmap,
      media: MEDIA.CONTINUOUS_15MM,
      options: { densityLevel: 7 },
    });
    expect(Array.from(out.subarray(0, 4))).toEqual([0x1f, 0x70, 0x02, 7]);
  });

  it('normalises a bitmap whose buffer size does not match its dimensions', () => {
    const odd: LabelBitmap = { widthPx: 96, heightPx: 20, data: new Uint8Array(50) };
    const out = encodeL11Job(engine, { bitmap: odd, media: MEDIA.CONTINUOUS_15MM });
    // no density (no options) → 15 + 4 + 8 + 240 + 3 + 4
    expect(out.length).toBe(15 + 4 + 8 + 240 + 3 + 4);
  });
});
