import { describe, expect, it } from 'vitest';
import { DEVICES } from '../devices.js';
import { MEDIA } from '../media.js';
import {
  buildSetGap,
  buildSetGapAuto,
  buildSetGapDistances,
  encodeMarklifeTsplJob,
  isMarklifeTsplEngine,
  type MarklifeTsplEngine,
} from '../tspl/index.js';
import { inflateSync } from 'node:zlib';

const tsplZlibDecompressForTest = (b: Uint8Array): Uint8Array =>
  new Uint8Array(inflateSync(Buffer.from(b)));
import type { LabelBitmap } from '@mbtech-nl/bitmap';

function createBitmap(widthPx: number, heightPx: number, fillByte = 0): LabelBitmap {
  const bytesPerRow = Math.ceil(widthPx / 8);
  const data = new Uint8Array(bytesPerRow * heightPx);
  data.fill(fillByte);
  return { widthPx, heightPx, data };
}

const dec = new TextDecoder();

describe('buildSetGap (local upstream-gap stub)', () => {
  it('emits SET GAP ON\\r\\n', () => {
    expect(dec.decode(buildSetGap({ on: true }))).toBe('SET GAP ON\r\n');
  });

  it('emits SET GAP OFF\\r\\n', () => {
    expect(dec.decode(buildSetGap({ on: false }))).toBe('SET GAP OFF\r\n');
  });

  it('emits SET GAP AUTO\\r\\n', () => {
    expect(dec.decode(buildSetGapAuto())).toBe('SET GAP AUTO\r\n');
  });

  it('emits SET GAP <gap> mm,<offset> mm\\r\\n', () => {
    expect(dec.decode(buildSetGapDistances(2, 0))).toBe('SET GAP 2 mm,0 mm\r\n');
  });
});

// No chassis in the registry binds to marklife-tspl any more. A1 and
// P15R turned out to speak the L11 stream, and the T3 a CPCL dialect.
// The sub-engine is kept because the vocabulary is real, but it is
// exercised against a synthetic engine rather than through a device
// entry whose real protocol is something else — casting one of those
// would keep the tests green while testing a fiction.
const TSPL_ENGINE = {
  role: 'primary',
  protocol: 'marklife-tspl',
  dpi: 203,
  headDots: 384,
  capabilities: { bitPolarity: '1=dark', compression: 'zlib', protocolId: 0 },
} as unknown as MarklifeTsplEngine;

describe('isMarklifeTsplEngine', () => {
  it('matches marklife-tspl entries', () => {
    // T3 is the last chassis on this binding — A1 and P15R moved to
    // marklife-l11 once wire analysis showed that is what they speak.
    expect(isMarklifeTsplEngine(TSPL_ENGINE)).toBe(true);
  });

  it('rejects other protocols', () => {
    expect(isMarklifeTsplEngine(DEVICES.S8.engines[0]!)).toBe(false);
    expect(isMarklifeTsplEngine(DEVICES.LP15.engines[0]!)).toBe(false);
    expect(isMarklifeTsplEngine(DEVICES.T3.engines[0]!)).toBe(false); // CPCL now
  });
});

describe('encodeMarklifeTsplJob (synthetic engine)', () => {
  const engine = TSPL_ENGINE;
  const bitmap = createBitmap(48, 16, 0xaa);

  it('begins with CLS', () => {
    const out = encodeMarklifeTsplJob(engine, { bitmap, media: MEDIA.GAP_50X30 });
    expect(dec.decode(out.subarray(0, 5))).toBe('CLS\r\n');
  });

  it('contains SIZE w mm,h mm directive', () => {
    const out = encodeMarklifeTsplJob(engine, { bitmap, media: MEDIA.GAP_50X30 });
    expect(dec.decode(out)).toMatch(/SIZE 50(\.00)? mm,30(\.00)? mm\r\n/);
  });

  it('contains GAP and SET GAP ON for die-cut media', () => {
    const out = encodeMarklifeTsplJob(engine, { bitmap, media: MEDIA.GAP_50X30 });
    const text = dec.decode(out);
    expect(text).toMatch(/GAP 2(\.00)? mm,0(\.00)? mm\r\n/);
    expect(text).toMatch(/SET GAP ON\r\n/);
  });

  it('omits GAP / SET GAP for continuous media', () => {
    const out = encodeMarklifeTsplJob(engine, { bitmap, media: MEDIA.CONTINUOUS_50MM });
    const text = dec.decode(out);
    expect(text).not.toMatch(/SET GAP/);
    // GAP keyword is not used for continuous either.
    expect(text).not.toMatch(/^GAP /);
  });

  it('contains a BITMAP …,3,<lzoLen>, header', () => {
    const out = encodeMarklifeTsplJob(engine, { bitmap, media: MEDIA.GAP_50X30 });
    const text = dec.decode(out);
    expect(text).toMatch(/BITMAP 0,0,6,16,3,\d+,/);
  });

  it('embeds a zlib stream after the BITMAP header, not LZO', () => {
    // Mode 3 is LZO in the published TSPL spec, but this family's
    // path carries plain zlib at defaults (DECISIONS.md D3). A zlib container opens 0x78 at the default
    // 32 KiB window — distinct from the 0x28 the YXQ raster uses.
    const out = encodeMarklifeTsplJob(engine, { bitmap, media: MEDIA.GAP_50X30 });
    // Locate the payload by walking the ASCII header: the raster
    // begins immediately after the sixth comma of
    // `BITMAP x,y,wb,h,3,len,`.
    const marker = 'BITMAP ';
    let i = 0;
    for (; i < out.length; i++) {
      if (String.fromCharCode(...out.subarray(i, i + marker.length)) === marker) break;
    }
    expect(i).toBeLessThan(out.length);
    let commas = 0;
    let declaredLen = 0;
    let digits = '';
    for (; i < out.length; i++) {
      const ch = String.fromCharCode(out[i] ?? 0);
      if (ch === ',') {
        commas += 1;
        if (commas === 5) digits = '';
        if (commas === 6) {
          declaredLen = Number(digits);
          i += 1;
          break;
        }
      } else if (commas === 5) {
        digits += ch;
      }
    }
    expect(declaredLen).toBeGreaterThan(0);
    const start = i;
    expect(out[start]).toBe(0x78);
    expect((out[start] ?? 0) & 0x0f).toBe(8); // deflate method
    expect(((out[start] ?? 0) >> 4) + 8).toBe(15); // 32 KiB window
    expect([...tsplZlibDecompressForTest(out.subarray(start, start + declaredLen))]).toEqual([
      ...bitmap.data,
    ]);
  });

  it('ends with PRINT 1,1\\r\\n (tspl-core: PRINT <sets>,<copies>)', () => {
    const out = encodeMarklifeTsplJob(engine, { bitmap, media: MEDIA.GAP_50X30 });
    expect(dec.decode(out)).toMatch(/PRINT 1,1\r\n$/);
  });

  it('respects copies override', () => {
    const out = encodeMarklifeTsplJob(engine, {
      bitmap,
      media: MEDIA.GAP_50X30,
      options: { copies: 5 },
    });
    expect(dec.decode(out)).toMatch(/PRINT 1,5\r\n$/);
  });

  it('respects density override', () => {
    const out = encodeMarklifeTsplJob(engine, {
      bitmap,
      media: MEDIA.GAP_50X30,
      options: { densityLevel: 12 },
    });
    expect(dec.decode(out)).toMatch(/DENSITY 12\r\n/);
  });

  it('maps density string light/normal/dark to 5/8/12', () => {
    const findDensity = (out: Uint8Array): string | null => {
      const m = /DENSITY (\d+)\r\n/.exec(dec.decode(out));
      return m ? m[1]! : null;
    };
    const light = encodeMarklifeTsplJob(engine, {
      bitmap,
      media: MEDIA.GAP_50X30,
      options: { density: 'light' },
    });
    const normal = encodeMarklifeTsplJob(engine, {
      bitmap,
      media: MEDIA.GAP_50X30,
      options: { density: 'normal' },
    });
    const dark = encodeMarklifeTsplJob(engine, {
      bitmap,
      media: MEDIA.GAP_50X30,
      options: { density: 'dark' },
    });
    expect(findDensity(light)).toBe('5');
    expect(findDensity(normal)).toBe('8');
    expect(findDensity(dark)).toBe('12');
  });
});
