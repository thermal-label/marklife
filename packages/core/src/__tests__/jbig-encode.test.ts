import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnsupportedOperationError } from '@thermal-label/contracts';
import type { LabelBitmap } from '@mbtech-nl/bitmap';
import { DEVICES } from '../devices.js';
import { MEDIA } from '../media.js';
import { jbigEncode } from '../jbig.js';
import type * as JbigModule from '../jbig.js';
import { encodeJbigJob, isJbigEngine, type JbigEngine } from '../jbig/index.js';

// The JBIG payload encoder is deferred (DECISIONS.md § D4), so the
// wrapper can only be tested against a stand-in payload. Every
// composition test below asserts wrapper bytes, never payload bytes.
vi.mock('../jbig.js', () => ({ jbigEncode: vi.fn() }));

/**
 * 632 bytes — sized so both speed formulas land on a value that is
 * neither clamped nor capped, which is what makes the expected speed
 * words below meaningful.
 */
const PAYLOAD = Uint8Array.from({ length: 632 }, (_, i) => (i * 31) & 0xff);

/** Payload length as the `1F 28 4A` header carries it: 632 = 0x0278. */
const PAYLOAD_LEN_LE = [0x78, 0x02];

function createBitmap(widthPx: number, heightPx: number, fillByte = 0): LabelBitmap {
  const bytesPerRow = Math.ceil(widthPx / 8);
  const data = new Uint8Array(bytesPerRow * heightPx);
  data.fill(fillByte);
  return { widthPx, heightPx, data };
}

/** Assert a job is exactly these segments, in this order, and nothing more. */
function expectStream(
  job: Uint8Array,
  segments: readonly (readonly [string, readonly number[] | Uint8Array])[],
): void {
  let offset = 0;
  for (const [label, expected] of segments) {
    expect(Array.from(job.subarray(offset, offset + expected.length)), label).toEqual(
      Array.from(expected),
    );
    offset += expected.length;
  }
  expect(job.length, 'no trailing bytes').toBe(offset);
}

/** First index of `needle` in `haystack`, or -1. */
function indexOfSeq(haystack: Uint8Array, needle: readonly number[]): number {
  for (let i = 0; i + needle.length <= haystack.length; i++) {
    let match = true;
    for (let j = 0; j < needle.length && match; j++) {
      if (haystack[i + j] !== needle[j]) match = false;
    }
    if (match) return i;
  }
  return -1;
}

const d100 = (): JbigEngine => DEVICES.D100.engines[0] as JbigEngine;
const x4 = (): JbigEngine => DEVICES.X4.engines[0] as JbigEngine;

beforeEach(() => {
  vi.mocked(jbigEncode).mockReset();
  vi.mocked(jbigEncode).mockImplementation(() => PAYLOAD);
});

describe('isJbigEngine', () => {
  it('matches engines bound to marklife-jbig', () => {
    expect(isJbigEngine(DEVICES.D100.engines[0]!)).toBe(true);
    expect(isJbigEngine(DEVICES.X4.engines[0]!)).toBe(true);
    expect(isJbigEngine(DEVICES.X8.engines[0]!)).toBe(true);
  });

  it('rejects engines bound to other protocols', () => {
    expect(isJbigEngine(DEVICES.S8.engines[0]!)).toBe(false);
    expect(isJbigEngine(DEVICES.P15.engines[0]!)).toBe(false);
  });
});

describe('encodeJbigJob — payload input contract', () => {
  it('hands the packed 1-bpp plane straight through, no expansion', () => {
    const bitmap = createBitmap(384, 16, 0b1010_1010);
    encodeJbigJob(d100(), { bitmap, media: MEDIA.GAP_50X30 });
    expect(vi.mocked(jbigEncode)).toHaveBeenCalledWith(bitmap.data, 384, 16);
    // ceil(384/8) * 16, not 384 * 16.
    expect(vi.mocked(jbigEncode).mock.calls[0]![0].length).toBe(48 * 16);
  });

  it('propagates the deferred-encoder error instead of swallowing it', () => {
    vi.mocked(jbigEncode).mockImplementation(() => {
      throw new UnsupportedOperationError('jbigEncode', 'deferred in v1 — see DECISIONS.md § D4');
    });
    expect(() =>
      encodeJbigJob(d100(), { bitmap: createBitmap(384, 16), media: MEDIA.GAP_50X30 }),
    ).toThrow(UnsupportedOperationError);
  });

  it('the real payload encoder is still deferred', async () => {
    const actual = await vi.importActual<typeof JbigModule>('../jbig.js');
    expect(() => actual.jbigEncode(new Uint8Array(2), 8, 2)).toThrow(/D4/);
  });
});

describe('encodeJbigJob — id 12 (D100)', () => {
  it('emits speed first, then the page header, raster and trailer', () => {
    const job = encodeJbigJob(d100(), {
      bitmap: createBitmap(384, 16),
      media: MEDIA.GAP_50X30,
    });

    // body = 3 + 4 + 4 + 3 + 3 + 8 + 632 + 3 = 660 bytes.
    // len = 660 / 20480; round((16/8) / len) = 62, under both the
    // 30..300 clamp and the 150 cap.
    expectStream(job, [
      ['print speed (first)', [0x1f, 0x28, 0x73, 0x02, 0x00, 62, 0x00]],
      ['density', [0x12, 0x23, 9]],
      ['GS L 0', [0x1d, 0x4c, 0x00, 0x00]],
      ['GS W 864', [0x1d, 0x57, 0x60, 0x03]],
      ['ESC a 1', [0x1b, 0x61, 0x01]],
      ['pre-raster marker', [0x1a, 0x0c, 0xff]],
      ['raster header', [0x1f, 0x28, 0x4a, ...PAYLOAD_LEN_LE, 0x80, 0x01, 0x10]],
      ['payload', PAYLOAD],
      ['trailer', [0x1a, 0x0c, 0x00]],
    ]);
  });

  it('emits no feed markers on continuous stock', () => {
    const job = encodeJbigJob(d100(), {
      bitmap: createBitmap(384, 16),
      media: MEDIA.CONTINUOUS_50MM,
    });

    // Speed tracks the assembled body, so dropping the two 3-byte
    // markers moves it: body 654 instead of 660 → 63, not 62.
    expectStream(job, [
      ['print speed (first)', [0x1f, 0x28, 0x73, 0x02, 0x00, 63, 0x00]],
      ['density', [0x12, 0x23, 9]],
      ['GS L 0', [0x1d, 0x4c, 0x00, 0x00]],
      ['GS W 864', [0x1d, 0x57, 0x60, 0x03]],
      ['ESC a 1', [0x1b, 0x61, 0x01]],
      ['raster header', [0x1f, 0x28, 0x4a, ...PAYLOAD_LEN_LE, 0x80, 0x01, 0x10]],
      ['payload', PAYLOAD],
    ]);
  });

  it('repeats density but not speed on a later copy', () => {
    const job = encodeJbigJob(d100(), {
      bitmap: createBitmap(384, 16),
      media: MEDIA.GAP_50X30,
      copyIndex: 1,
    });

    expectStream(job, [
      ['density', [0x12, 0x23, 9]],
      ['GS L 0', [0x1d, 0x4c, 0x00, 0x00]],
      ['GS W 864', [0x1d, 0x57, 0x60, 0x03]],
      ['ESC a 1', [0x1b, 0x61, 0x01]],
      ['pre-raster marker', [0x1a, 0x0c, 0xff]],
      ['raster header', [0x1f, 0x28, 0x4a, ...PAYLOAD_LEN_LE, 0x80, 0x01, 0x10]],
      ['payload', PAYLOAD],
      ['trailer', [0x1a, 0x0c, 0x00]],
    ]);
  });

  it('honours the density option', () => {
    const light = encodeJbigJob(d100(), {
      bitmap: createBitmap(384, 16),
      media: MEDIA.GAP_50X30,
      options: { density: 'light' },
    });
    expect(Array.from(light.subarray(7, 10))).toEqual([0x12, 0x23, 4]);
  });
});

describe('encodeJbigJob — id 7 (X4)', () => {
  it('emits the paper-type prelude, then speed, and no GS L', () => {
    const job = encodeJbigJob(x4(), {
      bitmap: createBitmap(384, 16),
      media: MEDIA.GAP_50X30,
    });

    // trunc((16/8) / (632/262144)) = trunc(829.57) = 829 = 0x033D.
    expectStream(job, [
      ['paper type (gap)', [0x1f, 0x80, 0x01, 0x20]],
      ['density (first copy)', [0x12, 0x23, 9]],
      ['print speed', [0x1f, 0x28, 0x73, 0x02, 0x00, 0x3d, 0x03]],
      ['GS W 800', [0x1d, 0x57, 0x20, 0x03]],
      ['ESC a 1', [0x1b, 0x61, 0x01]],
      ['pre-raster marker', [0x1a, 0x0c, 0xff]],
      ['raster header', [0x1f, 0x28, 0x4a, ...PAYLOAD_LEN_LE, 0x80, 0x01, 0x10]],
      ['payload', PAYLOAD],
      ['trailer', [0x1a, 0x0c, 0x00]],
    ]);
  });

  it('keeps the pre-raster marker on continuous stock and switches the paper-type byte', () => {
    const job = encodeJbigJob(x4(), {
      bitmap: createBitmap(384, 16),
      media: MEDIA.CONTINUOUS_50MM,
    });

    expect(Array.from(job.subarray(0, 4))).toEqual([0x1f, 0x80, 0x01, 0x10]);
    // Marker is unconditional on this id, unlike id 12.
    expect(Array.from(job.subarray(21, 24))).toEqual([0x1a, 0x0c, 0xff]);
    expect(Array.from(job.subarray(job.length - 3))).toEqual([0x1a, 0x0c, 0x00]);
  });

  it('drops the paper-type prelude and density on a later copy', () => {
    const job = encodeJbigJob(x4(), {
      bitmap: createBitmap(384, 16),
      media: MEDIA.GAP_50X30,
      copyIndex: 1,
    });

    expectStream(job, [
      ['print speed', [0x1f, 0x28, 0x73, 0x02, 0x00, 0x3d, 0x03]],
      ['GS W 800', [0x1d, 0x57, 0x20, 0x03]],
      ['ESC a 1', [0x1b, 0x61, 0x01]],
      ['pre-raster marker', [0x1a, 0x0c, 0xff]],
      ['raster header', [0x1f, 0x28, 0x4a, ...PAYLOAD_LEN_LE, 0x80, 0x01, 0x10]],
      ['payload', PAYLOAD],
      ['trailer', [0x1a, 0x0c, 0x00]],
    ]);
  });

  it('differs from id 12 in width, GS L, prelude and speed', () => {
    const page = { bitmap: createBitmap(384, 16), media: MEDIA.GAP_50X30 };
    const id7 = encodeJbigJob(x4(), page);
    const id12 = encodeJbigJob(d100(), page);

    expect(Array.from(id7)).not.toEqual(Array.from(id12));
    // GS L is id-12 only.
    expect(indexOfSeq(id12, [0x1d, 0x4c])).toBeGreaterThan(-1);
    expect(indexOfSeq(id7, [0x1d, 0x4c])).toBe(-1);
    // Print width differs.
    expect(indexOfSeq(id7, [0x1d, 0x57, 0x20, 0x03])).toBeGreaterThan(-1);
    expect(indexOfSeq(id12, [0x1d, 0x57, 0x60, 0x03])).toBeGreaterThan(-1);
    // Paper-type prelude is id-7 only.
    expect(indexOfSeq(id12, [0x1f, 0x80, 0x01])).toBe(-1);
  });
});

describe('encodeJbigJob — rejected ids', () => {
  it('rejects id 10 (X8) rather than emitting an id-12-shaped job', () => {
    const bitmap = createBitmap(832, 16);
    expect(() =>
      encodeJbigJob(DEVICES.X8.engines[0] as JbigEngine, { bitmap, media: MEDIA.GAP_50X30 }),
    ).toThrow(UnsupportedOperationError);
    expect(() =>
      encodeJbigJob(DEVICES.U210_BY_D210.engines[0] as JbigEngine, {
        bitmap,
        media: MEDIA.GAP_50X30,
      }),
    ).toThrow(UnsupportedOperationError);
  });

  it('explains the id-10 job shape in the rejection', () => {
    try {
      encodeJbigJob(DEVICES.X8.engines[0] as JbigEngine, {
        bitmap: createBitmap(832, 16),
        media: MEDIA.GAP_50X30,
      });
      throw new Error('expected throw');
    } catch (e) {
      const message = (e as Error).message;
      expect(message).toMatch(/1F FD 01 A5/);
      expect(message).toMatch(/1F 01 05 A5/);
      expect(message).toMatch(/1F 01 06 A5/);
      expect(message).toMatch(/512-byte/);
    }
  });

  it('never reaches the payload encoder for id 10', () => {
    expect(() =>
      encodeJbigJob(DEVICES.X8.engines[0] as JbigEngine, {
        bitmap: createBitmap(832, 16),
        media: MEDIA.GAP_50X30,
      }),
    ).toThrow();
    expect(vi.mocked(jbigEncode)).not.toHaveBeenCalled();
  });

  it('rejects an engine with no protocolId', () => {
    const engine = {
      role: 'primary',
      protocol: 'marklife-jbig',
      dpi: 203,
      headDots: 384,
    } as unknown as JbigEngine;
    expect(() =>
      encodeJbigJob(engine, { bitmap: createBitmap(384, 16), media: MEDIA.GAP_50X30 }),
    ).toThrow(UnsupportedOperationError);
  });
});

describe('JBIG-bound device entries', () => {
  it('D100 / X4 / X8 / U210 / L100 all roll up to supportStatus: unsupported', () => {
    for (const key of ['D100', 'X4', 'X8', 'U210_BY_D210', 'L100_BY_X4'] as const) {
      expect(DEVICES[key].supportStatus).toBe('unsupported');
    }
  });

  it('L100 shares the id-7 job shape with X4', () => {
    const page = { bitmap: createBitmap(384, 16), media: MEDIA.GAP_50X30 };
    const l100 = encodeJbigJob(DEVICES.L100_BY_X4.engines[0] as JbigEngine, page);
    expect(Array.from(l100)).toEqual(Array.from(encodeJbigJob(x4(), page)));
  });
});
