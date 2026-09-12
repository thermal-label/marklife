import { describe, expect, it } from 'vitest';
import { UnsupportedOperationError } from '@thermal-label/contracts';
import { DEVICES } from '../devices.js';
import { MEDIA } from '../media.js';
import type { MarklifeMedia, MarklifePrintOptions } from '../types.js';
import { encodeYxqJob, isYxqEngine, type YxqEngine } from '../yxq/index.js';
import { yxqZlibCompress, yxqZlibDecompress } from '../zlib.js';
import type { LabelBitmap } from '@mbtech-nl/bitmap';

function createBitmap(widthPx: number, heightPx: number, fillByte = 0): LabelBitmap {
  const bytesPerRow = Math.ceil(widthPx / 8);
  const data = new Uint8Array(bytesPerRow * heightPx);
  data.fill(fillByte);
  return { widthPx, heightPx, data };
}

/** Readable diffs: compare jobs as space-separated hex. */
function hex(bytes: Uint8Array | number[]): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join(' ');
}

function flatten(...parts: (number[] | Uint8Array)[]): number[] {
  const out: number[] = [];
  for (const p of parts) out.push(...Array.from(p));
  return out;
}

const NULS = (n: number): number[] => Array<number>(n).fill(0);

/** Expected `1F 10 …` raster block (big-endian fields + zlib payload). */
function zlibRasterBlock(bitmap: LabelBitmap): number[] {
  const widthBytes = Math.ceil(bitmap.widthPx / 8);
  const compressed = yxqZlibCompress(bitmap.data);
  const len = compressed.length;
  return flatten(
    [
      0x1f,
      0x10,
      (widthBytes >> 8) & 0xff,
      widthBytes & 0xff,
      (bitmap.heightPx >> 8) & 0xff,
      bitmap.heightPx & 0xff,
      (len >>> 24) & 0xff,
      (len >>> 16) & 0xff,
      (len >>> 8) & 0xff,
      len & 0xff,
    ],
    compressed,
  );
}

/** Expected `1D 76 30 …` raster block (little-endian fields + raw rows). */
function rawRasterBlock(bitmap: LabelBitmap): number[] {
  const widthBytes = Math.ceil(bitmap.widthPx / 8);
  return flatten(
    [
      0x1d,
      0x76,
      0x30,
      0x00,
      widthBytes & 0xff,
      (widthBytes >> 8) & 0xff,
      bitmap.heightPx & 0xff,
      (bitmap.heightPx >> 8) & 0xff,
    ],
    bitmap.data,
  );
}

/**
 * Black-mark stock is not in the catalogue — no marklife media
 * selects the black-mark sensor modes today. These stand in so the
 * sensor-mode branches are exercised end to end.
 */
const BLACK_MARK_MEDIA: MarklifeMedia = {
  id: 'test-black-mark',
  name: 'Black-mark test stock',
  widthMm: 50,
  heightMm: 30,
  type: 'black-mark',
  targetModels: ['mobile-2in'],
};

const BLACK_MARK_2_MEDIA: MarklifeMedia = {
  ...BLACK_MARK_MEDIA,
  id: 'test-black-mark-2',
  type: 'black-mark-2',
};

describe('isYxqEngine', () => {
  it('matches engines bound to marklife-yxq', () => {
    const eng = DEVICES.S8.engines[0] as YxqEngine;
    expect(isYxqEngine(eng)).toBe(true);
  });

  it('rejects engines bound to other protocols', () => {
    expect(isYxqEngine(DEVICES.D100.engines[0]!)).toBe(false);
    expect(isYxqEngine(DEVICES.P15.engines[0]!)).toBe(false);
  });
});

describe('encodeYxqJob (S2 — id 2, bench-confirmed)', () => {
  const engine = DEVICES.S2.engines[0] as YxqEngine;
  const bitmap = createBitmap(48, 16, 0xa5);

  // Byte-for-byte goldens captured from the encoder before the
  // id 1 / 3 / 5 / 8 / 9 corrections landed. id 2 is the one chassis
  // in this family that has printed a job end to end; any diff here
  // means a per-id fix leaked into the reference path.
  it('gap stock bytes are unchanged', () => {
    const out = encodeYxqJob(engine, { bitmap, media: MEDIA.GAP_50X30 });
    expect(Buffer.from(out).toString('hex')).toBe(
      '1f70010a10fff1021f10000600100000000c28915bba94b60000b9f53de11d0c10fff145',
    );
  });

  it('continuous stock bytes are unchanged', () => {
    const out = encodeYxqJob(engine, { bitmap, media: MEDIA.CONTINUOUS_50MM });
    expect(Buffer.from(out).toString('hex')).toBe(
      '1f70010a10fff1021f10000600100000000c28915bba94b60000b9f53de11b4a6410fff145',
    );
  });

  it('composes density → enable → raster → 1D 0C → stop on gap stock', () => {
    const out = encodeYxqJob(engine, { bitmap, media: MEDIA.GAP_50X30 });
    expect(hex(out)).toBe(
      hex(
        flatten(
          [0x1f, 0x70, 0x01, 10], // density, slot 01, normal = 10
          [0x10, 0xff, 0xf1, 0x02], // enable — no wakeup on id 2
          zlibRasterBlock(bitmap),
          [0x1d, 0x0c], // page advance to the next gap
          [0x10, 0xff, 0xf1, 0x45], // stop
        ),
      ),
    );
  });

  it('swaps the page advance for ESC J 100 on continuous stock', () => {
    const out = encodeYxqJob(engine, { bitmap, media: MEDIA.CONTINUOUS_50MM });
    expect(hex(out)).toBe(
      hex(
        flatten(
          [0x1f, 0x70, 0x01, 10],
          [0x10, 0xff, 0xf1, 0x02],
          zlibRasterBlock(bitmap),
          [0x1b, 0x4a, 0x64],
          [0x10, 0xff, 0xf1, 0x45],
        ),
      ),
    );
  });
});

describe('encodeYxqJob (S8 — id 1)', () => {
  const engine = DEVICES.S8.engines[0] as YxqEngine;
  const bitmap = createBitmap(48, 16, 0xaa);

  it('composes density → wakeup → enable → raster → ESC J 70 → stop', () => {
    const out = encodeYxqJob(engine, { bitmap, media: MEDIA.GAP_50X30 });
    expect(hex(out)).toBe(
      hex(
        flatten(
          [0x1f, 0x70, 0x01, 13], // density, slot 01, normal = 13
          NULS(15),
          [0x10, 0xff, 0xf1, 0x03],
          zlibRasterBlock(bitmap),
          [0x1b, 0x4a, 70],
          [0x10, 0xff, 0xf1, 0x45],
        ),
      ),
    );
  });

  it('encodes a payload that decompresses back to the bitmap data', () => {
    const out = encodeYxqJob(engine, { bitmap, media: MEDIA.GAP_50X30 });
    const headerStart = 4 + 15 + 4;
    const payloadLen =
      ((out[headerStart + 6] ?? 0) << 24) |
      ((out[headerStart + 7] ?? 0) << 16) |
      ((out[headerStart + 8] ?? 0) << 8) |
      (out[headerStart + 9] ?? 0);
    const payloadStart = headerStart + 10;
    const payload = out.subarray(payloadStart, payloadStart + payloadLen);
    expect(yxqZlibDecompress(payload)).toEqual(bitmap.data);
  });

  it('runs a 12 / 13 / 14 density scale — 15 is not a level this head produces', () => {
    const level = (options: { density: 'light' | 'normal' | 'dark' }): number | undefined =>
      encodeYxqJob(engine, { bitmap, media: MEDIA.GAP_50X30, options })[3];
    expect(level({ density: 'light' })).toBe(12);
    expect(level({ density: 'normal' })).toBe(13);
    expect(level({ density: 'dark' })).toBe(14);
  });

  it('clamps an explicit densityLevel into 12..14', () => {
    const at = (densityLevel: number): number | undefined =>
      encodeYxqJob(engine, { bitmap, media: MEDIA.GAP_50X30, options: { densityLevel } })[3];
    expect(at(7)).toBe(12);
    expect(at(13)).toBe(13);
    expect(at(15)).toBe(14);
  });
});

describe('encodeYxqJob (P50 — id 3)', () => {
  const engine = DEVICES.P50.engines[0] as YxqEngine;
  const bitmap = createBitmap(384, 8, 0x0f);

  it('composes the gap-stock job: paper type, seek, raster, position, stop, park', () => {
    const out = encodeYxqJob(engine, { bitmap, media: MEDIA.GAP_50X30 });
    expect(hex(out)).toBe(
      hex(
        flatten(
          [0x1f, 0x80, 0x02, 0x20], // paper type — gap
          [0x1f, 0x70, 0x02, 10], // density on slot 02
          NULS(6),
          [0x1f, 0xc0, 0x01, 0x00], // enable
          [0x1f, 0x11, 0x51], // seek to the gap before the raster
          zlibRasterBlock(bitmap),
          [0x1f, 0x12, 0x20, 0x00], // post-raster position
          [0x1f, 0xc0, 0x01, 0x01], // stop
          [0x1f, 0x11, 0x50], // park — after the stop, not before
        ),
      ),
    );
  });

  it('composes the continuous-stock job with the 5-byte feed emitted twice', () => {
    const out = encodeYxqJob(engine, { bitmap, media: MEDIA.CONTINUOUS_50MM });
    expect(hex(out)).toBe(
      hex(
        flatten(
          // no paper-type prelude on continuous stock
          [0x1f, 0x70, 0x02, 10],
          NULS(6),
          [0x1f, 0xc0, 0x01, 0x00],
          [0x1b, 0x4a, 0x64, 0x00, 0x00], // feed before the raster
          zlibRasterBlock(bitmap),
          [0x1b, 0x4a, 0x64, 0x00, 0x00], // and again before the stop
          [0x1f, 0xc0, 0x01, 0x01],
        ),
      ),
    );
  });

  it('never emits 1D 0C or the 3-byte ESC J — neither is in id 3’s vocabulary', () => {
    for (const media of [MEDIA.GAP_50X30, MEDIA.CONTINUOUS_50MM]) {
      const out = hex(encodeYxqJob(engine, { bitmap, media }));
      expect(out).not.toContain('1d 0c');
      expect(out).not.toContain('1b 4a 64 10');
    }
  });

  it('selects the black-mark-2 sensor mode for black-mark-2 stock', () => {
    const out = encodeYxqJob(engine, { bitmap, media: BLACK_MARK_2_MEDIA });
    expect(Array.from(out.subarray(0, 4))).toEqual([0x1f, 0x80, 0x02, 0x40]);
  });
});

describe('encodeYxqJob (D210 — id 5)', () => {
  const engine = DEVICES.D210.engines[0] as YxqEngine;
  const bitmap = createBitmap(832, 8, 0x55);

  it('composes the gap-stock job: paper type 0x30, retract, gear, density, …', () => {
    const out = encodeYxqJob(engine, { bitmap, media: MEDIA.SHIPPING_100X150 });
    expect(hex(out)).toBe(
      hex(
        flatten(
          [0x1f, 0x80, 0x01, 0x30], // gap sensor mode
          [0x1f, 0x11, 0x51, 0x00, 0x00], // retract
          [0x10, 0xff, 0x10, 0x00, 0x02], // density gear
          [0x1f, 0x70, 0x01, 13], // density
          // no wakeup on the gap path
          [0x10, 0xff, 0xf1, 0x03], // enable
          zlibRasterBlock(bitmap),
          [0x1d, 0x0c], // gap advance
          [0x1f, 0x11, 0x50], // park
          [0x10, 0xff, 0xfe, 0x45], // stop
        ),
      ),
    );
  });

  it('composes the continuous-stock job with sensor mode 0x10 and a 60-step feed', () => {
    const out = encodeYxqJob(engine, { bitmap, media: MEDIA.CONTINUOUS_100MM });
    expect(hex(out)).toBe(
      hex(
        flatten(
          [0x1f, 0x80, 0x01, 0x10], // continuous — not 0x40, which hunts for a mark
          [0x1f, 0x11, 0x51, 0x00, 0x00],
          [0x10, 0xff, 0x10, 0x00, 0x02],
          [0x1f, 0x70, 0x01, 13],
          [0x10, 0xff, 0xf1, 0x03],
          zlibRasterBlock(bitmap),
          [0x1b, 0x4a, 0x3c, 0x00, 0x00],
          [0x1f, 0x11, 0x50],
          [0x10, 0xff, 0xfe, 0x45],
        ),
      ),
    );
  });

  it('wakes the head on black-mark stock only', () => {
    const black = encodeYxqJob(engine, { bitmap, media: BLACK_MARK_MEDIA });
    expect(hex(black)).toBe(
      hex(
        flatten(
          [0x1f, 0x80, 0x01, 0x20], // black-mark sensor mode
          [0x1f, 0x11, 0x51, 0x00, 0x00],
          [0x10, 0xff, 0x10, 0x00, 0x02],
          [0x1f, 0x70, 0x01, 13],
          NULS(6), // wakeup — black-mark path only
          [0x10, 0xff, 0xf1, 0x03],
          zlibRasterBlock(bitmap),
          [0x1d, 0x0c],
          [0x1f, 0x11, 0x50],
          [0x10, 0xff, 0xfe, 0x45],
        ),
      ),
    );
  });

  it('keeps the 11 / 13 / 15 density scale', () => {
    const level = (density: 'light' | 'dark'): number | undefined =>
      encodeYxqJob(engine, {
        bitmap,
        media: MEDIA.SHIPPING_100X150,
        options: { density },
      })[4 + 5 + 5 + 3]; // paper type + retract + gear, then the density argument
    expect(level('light')).toBe(11);
    expect(level('dark')).toBe(15);
  });

  it('drops the 3-byte ESC J 70 postlude', () => {
    const out = hex(encodeYxqJob(engine, { bitmap, media: MEDIA.SHIPPING_100X150 }));
    expect(out).not.toContain('1b 4a 46');
  });
});

describe('encodeYxqJob (X2_BLE — id 8)', () => {
  const engine = DEVICES.X2_BLE.engines[0] as YxqEngine;
  const bitmap = createBitmap(384, 8, 0xff);

  it('composes the gap-stock job', () => {
    const out = encodeYxqJob(engine, { bitmap, media: MEDIA.GAP_50X30 });
    expect(hex(out)).toBe(
      hex(
        flatten(
          [0x1f, 0x80, 0x02, 0x20], // paper type — gap
          [0x1f, 0x70, 0x02, 8], // density on slot 02, normal = 8
          NULS(6), // wakeup is correct for id 8
          [0x1f, 0xc0, 0x01, 0x00],
          [0x1f, 0x11, 0x51],
          zlibRasterBlock(bitmap),
          [0x1f, 0x12, 0x20, 0x00],
          [0x1f, 0xc0, 0x01, 0x01],
          [0x1f, 0x11, 0x50],
        ),
      ),
    );
  });

  it('composes the continuous-stock job', () => {
    const out = encodeYxqJob(engine, { bitmap, media: MEDIA.CONTINUOUS_50MM });
    expect(hex(out)).toBe(
      hex(
        flatten(
          [0x1f, 0x70, 0x02, 8],
          NULS(6),
          [0x1f, 0xc0, 0x01, 0x00],
          [0x1b, 0x4a, 0x64, 0x00, 0x00], // 5-byte feed before the raster
          zlibRasterBlock(bitmap),
          [0x1f, 0x12, 0x00, 0x00],
          [0x1f, 0xc0, 0x01, 0x01],
          [0x1f, 0x11, 0x00], // continuous counterpart of the park
        ),
      ),
    );
  });

  it('runs a 3 / 8 / 14 density scale', () => {
    const level = (density: 'light' | 'normal' | 'dark'): number | undefined =>
      encodeYxqJob(engine, { bitmap, media: MEDIA.GAP_50X30, options: { density } })[7];
    expect(level('light')).toBe(3);
    expect(level('normal')).toBe(8);
    expect(level('dark')).toBe(14);
  });
});

describe('encodeYxqJob (X2 — id 9)', () => {
  const engine = DEVICES.X2.engines[0] as YxqEngine;
  const bitmap = createBitmap(384, 8, 0x3c);

  it('composes the gap-stock job with a raw raster and no wakeup', () => {
    const out = encodeYxqJob(engine, { bitmap, media: MEDIA.GAP_50X30 });
    expect(hex(out)).toBe(
      hex(
        flatten(
          [0x1f, 0x80, 0x02, 0x20],
          [0x1f, 0x70, 0x02, 8],
          [0x1f, 0xc0, 0x01, 0x00], // enable — no NUL run before it
          [0x1f, 0x11, 0x51],
          rawRasterBlock(bitmap),
          [0x1f, 0x12, 0x20, 0x00],
          [0x1f, 0xc0, 0x01, 0x01],
          [0x1f, 0x11, 0x50],
        ),
      ),
    );
  });

  it('composes the continuous-stock job', () => {
    const out = encodeYxqJob(engine, { bitmap, media: MEDIA.CONTINUOUS_50MM });
    expect(hex(out)).toBe(
      hex(
        flatten(
          [0x1f, 0x70, 0x02, 8],
          [0x1f, 0xc0, 0x01, 0x00],
          rawRasterBlock(bitmap),
          [0x1f, 0x12, 0x00, 0x00],
          [0x1f, 0xc0, 0x01, 0x01],
          [0x1f, 0x11, 0x00],
        ),
      ),
    );
  });

  it('sends the rows uncompressed — no 1F 10 header, no zlib payload', () => {
    const out = encodeYxqJob(engine, { bitmap, media: MEDIA.GAP_50X30 });
    expect(hex(out)).not.toContain('1f 10');
    expect(hex(out)).toContain(hex(bitmap.data));
    expect(hex(out)).not.toContain(hex(yxqZlibCompress(bitmap.data)));
  });

  it('runs a 2 / 8 / 15 density scale and passes densityLevel through unclamped', () => {
    const level = (options: MarklifePrintOptions): number | undefined =>
      encodeYxqJob(engine, { bitmap, media: MEDIA.GAP_50X30, options })[7];
    expect(level({ density: 'light' })).toBe(2);
    expect(level({ density: 'normal' })).toBe(8);
    expect(level({ density: 'dark' })).toBe(15);
    // The head runs a 5-step scale (2 / 5 / 8 / 11 / 15); the two
    // intermediate steps are only reachable via densityLevel.
    expect(level({ densityLevel: 11 })).toBe(11);
  });
});

describe('encodeYxqJob unsupported protocol id', () => {
  it('throws for protocolId 7 (X4) — reserved for marklife-jbig families anyway', () => {
    const engine: YxqEngine = {
      role: 'primary',
      protocol: 'marklife-yxq',
      dpi: 203,
      headDots: 384,
      capabilities: { protocolId: 7 },
    };
    const bitmap = createBitmap(8, 1);
    expect(() => encodeYxqJob(engine, { bitmap, media: MEDIA.GAP_50X30 })).toThrow(
      UnsupportedOperationError,
    );
  });

  it('throws when the engine carries no protocolId at all', () => {
    const engine: YxqEngine = {
      role: 'primary',
      protocol: 'marklife-yxq',
      dpi: 203,
      headDots: 384,
    };
    const bitmap = createBitmap(8, 1);
    expect(() => encodeYxqJob(engine, { bitmap, media: MEDIA.GAP_50X30 })).toThrow(
      UnsupportedOperationError,
    );
  });
});

describe('encodeYxqJob bitmap buffer guard', () => {
  it('pads a short data buffer to widthBytes × height', () => {
    const engine = DEVICES.S8.engines[0] as YxqEngine;
    const short: LabelBitmap = { widthPx: 16, heightPx: 4, data: new Uint8Array([0xff, 0xff]) };
    const out = encodeYxqJob(engine, { bitmap: short, media: MEDIA.GAP_50X30 });
    const headerStart = 4 + 15 + 4;
    const payloadLen =
      ((out[headerStart + 6] ?? 0) << 24) |
      ((out[headerStart + 7] ?? 0) << 16) |
      ((out[headerStart + 8] ?? 0) << 8) |
      (out[headerStart + 9] ?? 0);
    const payload = out.subarray(headerStart + 10, headerStart + 10 + payloadLen);
    const expanded = new Uint8Array(2 * 4);
    expanded.set([0xff, 0xff]);
    expect(yxqZlibDecompress(payload)).toEqual(expanded);
  });
});
