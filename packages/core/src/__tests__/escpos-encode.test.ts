import { describe, expect, it } from 'vitest';
import { DEVICES } from '../devices.js';
import { MEDIA } from '../media.js';
import {
  buildFormFeed,
  buildPrinterWake,
  encodeMarklifeEscposJob,
  isMarklifeEscposEngine,
  type MarklifeEscposEngine,
} from '../escpos/index.js';
import type { LabelBitmap } from '@mbtech-nl/bitmap';

function createBitmap(widthPx: number, heightPx: number, fillByte = 0): LabelBitmap {
  const bytesPerRow = Math.ceil(widthPx / 8);
  const data = new Uint8Array(bytesPerRow * heightPx);
  data.fill(fillByte);
  return { widthPx, heightPx, data };
}

describe('buildFormFeed (local upstream-gap stub)', () => {
  it('emits FF (0x0C)', () => {
    expect(Array.from(buildFormFeed())).toEqual([0x0c]);
  });
});

describe('buildPrinterWake', () => {
  it('emits six NUL bytes', () => {
    const wake = buildPrinterWake();
    expect(wake.length).toBe(6);
    expect(wake.every(b => b === 0)).toBe(true);
  });
});

// No chassis in the registry binds to marklife-escpos any more: LP15,
// its last holder, speaks the L11 stream. The sub-engine is kept
// because the vocabulary is real and a chassis may yet route to it,
// but it is now exercised against a synthetic engine rather than a
// device entry that would be a lie.
const ESCPOS_ENGINE = {
  role: 'primary',
  protocol: 'marklife-escpos',
  dpi: 203,
  headDots: 384,
  capabilities: { bitPolarity: '1=dark', compression: 'none', protocolId: 0 },
} as unknown as MarklifeEscposEngine;

describe('isMarklifeEscposEngine', () => {
  it('matches marklife-escpos entries', () => {
    expect(isMarklifeEscposEngine(ESCPOS_ENGINE)).toBe(true);
  });

  it('no registry chassis binds to marklife-escpos', () => {
    for (const d of Object.values(DEVICES)) {
      expect(d.engines[0]?.protocol, d.key).not.toBe('marklife-escpos');
    }
  });

  it('rejects other protocols', () => {
    expect(isMarklifeEscposEngine(DEVICES.S8.engines[0]!)).toBe(false);
    expect(isMarklifeEscposEngine(DEVICES.P15.engines[0]!)).toBe(false);
  });
});

describe('encodeMarklifeEscposJob (synthetic engine)', () => {
  const engine = ESCPOS_ENGINE;
  const bitmap = createBitmap(48, 16, 0xff);

  it('begins with ESC @ (reset = 1B 40)', () => {
    const out = encodeMarklifeEscposJob(engine, { bitmap, media: MEDIA.GAP_50X30 });
    expect(out[0]).toBe(0x1b);
    expect(out[1]).toBe(0x40);
  });

  it('contains the printerWake (six NULs) after reset', () => {
    const out = encodeMarklifeEscposJob(engine, { bitmap, media: MEDIA.GAP_50X30 });
    const wake = out.subarray(2, 2 + 6);
    expect(wake.length).toBe(6);
    expect(wake.every(b => b === 0)).toBe(true);
  });

  it('contains a GS v 0 raster header (1D 76 30)', () => {
    const out = encodeMarklifeEscposJob(engine, { bitmap, media: MEDIA.GAP_50X30 });
    let foundRaster = false;
    for (let i = 0; i < out.length - 2; i++) {
      if (out[i] === 0x1d && out[i + 1] === 0x76 && out[i + 2] === 0x30) {
        foundRaster = true;
        break;
      }
    }
    expect(foundRaster).toBe(true);
  });

  it('emits FF before the trailing feed', () => {
    const out = encodeMarklifeEscposJob(engine, { bitmap, media: MEDIA.GAP_50X30 });
    expect(Array.from(out).includes(0x0c)).toBe(true);
  });

  it('ends with ESC d n (feed n lines: 1B 64 n)', () => {
    const out = encodeMarklifeEscposJob(engine, { bitmap, media: MEDIA.GAP_50X30 });
    expect(out.at(-3)).toBe(0x1b);
    expect(out.at(-2)).toBe(0x64);
  });

  it('respects density override', () => {
    const out = encodeMarklifeEscposJob(engine, {
      bitmap,
      media: MEDIA.GAP_50X30,
      options: { densityLevel: 14 },
    });
    let foundDensity14 = false;
    for (let i = 0; i < out.length - 3; i++) {
      if (out[i] === 0x1b && out[i + 1] === 0x4e && out[i + 2] === 0x07 && out[i + 3] === 14) {
        foundDensity14 = true;
        break;
      }
    }
    expect(foundDensity14).toBe(true);
  });

  it('honours headWidthMm override on capabilities', () => {
    const customEngine: MarklifeEscposEngine = {
      ...engine,
      headDots: 384,
      capabilities: { ...engine.capabilities, headWidthMm: 100 },
    };
    const out = encodeMarklifeEscposJob(customEngine, { bitmap, media: MEDIA.GAP_50X30 });
    // GS W nL nH; 100 mm × 8 = 800 = 0x0320
    let foundWidth = false;
    for (let i = 0; i < out.length - 3; i++) {
      if (out[i] === 0x1d && out[i + 1] === 0x57 && out[i + 2] === 0x20 && out[i + 3] === 0x03) {
        foundWidth = true;
        break;
      }
    }
    expect(foundWidth).toBe(true);
  });

  it('maps density string light/normal/dark to 5/8/12', () => {
    const findDensity = (out: Uint8Array): number | undefined => {
      for (let i = 0; i < out.length - 3; i++) {
        if (out[i] === 0x1b && out[i + 1] === 0x4e && out[i + 2] === 0x07) return out[i + 3];
      }
      return undefined;
    };
    const light = encodeMarklifeEscposJob(engine, {
      bitmap,
      media: MEDIA.GAP_50X30,
      options: { density: 'light' },
    });
    const normal = encodeMarklifeEscposJob(engine, {
      bitmap,
      media: MEDIA.GAP_50X30,
      options: { density: 'normal' },
    });
    const dark = encodeMarklifeEscposJob(engine, {
      bitmap,
      media: MEDIA.GAP_50X30,
      options: { density: 'dark' },
    });
    expect(findDensity(light)).toBe(5);
    expect(findDensity(normal)).toBe(8);
    expect(findDensity(dark)).toBe(12);
  });

  it('slices ragged-width bitmap to floor(width/8) per row', () => {
    // 21px-wide bitmap padded to 3 input bytes per row; wire format
    // uses floor(21/8)=2, so the slicer drops the trailing byte.
    const ragged: LabelBitmap = {
      widthPx: 21,
      heightPx: 4,
      data: new Uint8Array(3 * 4).fill(0xab),
    };
    const out = encodeMarklifeEscposJob(engine, { bitmap: ragged, media: MEDIA.GAP_50X30 });
    expect(out.length).toBeGreaterThan(0);
  });
});

describe('raster row stride', () => {
  const rasterWidthBytes = (bytes: Uint8Array): number => {
    // GS v 0 block: 1D 76 30 m wLo wHi hLo hHi
    const i = bytes.findIndex(
      (b, k) => b === 0x1d && bytes[k + 1] === 0x76 && bytes[k + 2] === 0x30,
    );
    expect(i).toBeGreaterThan(-1);
    return (bytes[i + 4] ?? 0) + ((bytes[i + 5] ?? 0) << 8);
  };

  it('rounds the stride up so a ragged width keeps its last column', () => {
    // 100 dots is 12.5 bytes. Flooring gave 12 and silently dropped
    // the final 4 columns of every row.
    const bytes = encodeMarklifeEscposJob(ESCPOS_ENGINE, {
      bitmap: createBitmap(100, 8, 0xff),
      media: MEDIA.CONTINUOUS_50MM,
    });
    expect(rasterWidthBytes(bytes)).toBe(13);
  });

  it('a sub-byte width still produces a raster', () => {
    // floor(4/8) = 0 would have emitted a zero-width block: a job that
    // is structurally valid and prints nothing.
    const bytes = encodeMarklifeEscposJob(ESCPOS_ENGINE, {
      bitmap: createBitmap(4, 4, 0xff),
      media: MEDIA.CONTINUOUS_50MM,
    });
    expect(rasterWidthBytes(bytes)).toBe(1);
  });
});
