import { describe, expect, it } from 'vitest';
import {
  buildEscJustify,
  buildFormFeed,
  buildGsFormFeed,
  buildGsLeftMargin,
  buildGsLeftParenJ,
  buildGsLeftParenS,
  buildGsPrintWidth,
  buildJbigDensity,
  buildJbigPaperType,
  buildJbigPreRasterMarker,
  buildJbigTrailer,
  computeJbigPrintSpeedId7,
  computeJbigPrintSpeedId12,
  jbigPrintWidthDots,
  type JbigPaperType,
} from '../jbig/index.js';

const PAPER_TYPES: readonly JbigPaperType[] = ['continuous', 'gap', 'black-mark', 'black-mark-2'];

describe('buildGsLeftParenS', () => {
  it('emits 1F 28 73 02 00 spdL spdH', () => {
    expect(Array.from(buildGsLeftParenS(150))).toEqual([0x1f, 0x28, 0x73, 0x02, 0x00, 150, 0]);
  });

  it('handles 16-bit overflow correctly', () => {
    expect(Array.from(buildGsLeftParenS(0x1234))).toEqual([
      0x1f, 0x28, 0x73, 0x02, 0x00, 0x34, 0x12,
    ]);
  });

  it('truncates a speed above 0xFFFF to 16 bits', () => {
    // id 7 applies no cap, so out-of-range speeds are reachable.
    expect(Array.from(buildGsLeftParenS(0x1_0320))).toEqual([
      0x1f, 0x28, 0x73, 0x02, 0x00, 0x20, 0x03,
    ]);
  });
});

describe('buildGsLeftMargin / buildGsPrintWidth', () => {
  it('GS L emits 1D 4C nL nH', () => {
    expect(Array.from(buildGsLeftMargin(0))).toEqual([0x1d, 0x4c, 0, 0]);
    expect(Array.from(buildGsLeftMargin(0x0100))).toEqual([0x1d, 0x4c, 0x00, 0x01]);
  });

  it('GS W emits 1D 57 nL nH', () => {
    expect(Array.from(buildGsPrintWidth(0x0360))).toEqual([0x1d, 0x57, 0x60, 0x03]);
  });
});

describe('jbigPrintWidthDots', () => {
  it('is 800 dots on id 7 and 864 dots on id 12', () => {
    expect(jbigPrintWidthDots(7)).toBe(800);
    expect(jbigPrintWidthDots(7)).toBe(0x0320);
    expect(jbigPrintWidthDots(12)).toBe(864);
    expect(jbigPrintWidthDots(12)).toBe(0x0360);
  });
});

describe('buildEscJustify', () => {
  it('emits ESC a n', () => {
    expect(Array.from(buildEscJustify(0))).toEqual([0x1b, 0x61, 0]);
    expect(Array.from(buildEscJustify(1))).toEqual([0x1b, 0x61, 1]);
    expect(Array.from(buildEscJustify(2))).toEqual([0x1b, 0x61, 2]);
  });
});

describe('buildFormFeed / buildGsFormFeed', () => {
  it('emits FF (0x0C)', () => {
    expect(Array.from(buildFormFeed())).toEqual([0x0c]);
  });

  it('emits GS FF (0x1D 0x0C)', () => {
    expect(Array.from(buildGsFormFeed())).toEqual([0x1d, 0x0c]);
  });
});

describe('buildJbigDensity', () => {
  it('maps 1 → 4 (light), 2 → 9, 3 → 13 (dark)', () => {
    expect(Array.from(buildJbigDensity(1))).toEqual([0x12, 0x23, 4]);
    expect(Array.from(buildJbigDensity(2))).toEqual([0x12, 0x23, 9]);
    expect(Array.from(buildJbigDensity(3))).toEqual([0x12, 0x23, 13]);
  });

  it('falls back to 10 for unknown values', () => {
    expect(Array.from(buildJbigDensity(0))).toEqual([0x12, 0x23, 10]);
    expect(Array.from(buildJbigDensity(99))).toEqual([0x12, 0x23, 10]);
  });
});

describe('buildJbigPaperType', () => {
  it('emits 1F 80 01 n on id 7, one code per paper type', () => {
    expect(Array.from(buildJbigPaperType(7, 'continuous'))).toEqual([0x1f, 0x80, 0x01, 0x10]);
    expect(Array.from(buildJbigPaperType(7, 'gap'))).toEqual([0x1f, 0x80, 0x01, 0x20]);
    expect(Array.from(buildJbigPaperType(7, 'black-mark'))).toEqual([0x1f, 0x80, 0x01, 0x30]);
    expect(Array.from(buildJbigPaperType(7, 'black-mark-2'))).toEqual([0x1f, 0x80, 0x01, 0x40]);
  });

  it('emits nothing on id 12 or any other id', () => {
    for (const paperType of PAPER_TYPES) {
      expect(buildJbigPaperType(12, paperType).length).toBe(0);
      expect(buildJbigPaperType(10, paperType).length).toBe(0);
      expect(buildJbigPaperType(0, paperType).length).toBe(0);
    }
  });
});

describe('buildJbigPreRasterMarker', () => {
  it('is unconditional on id 7', () => {
    for (const paperType of PAPER_TYPES) {
      expect(Array.from(buildJbigPreRasterMarker(7, paperType))).toEqual([0x1a, 0x0c, 0xff]);
    }
  });

  it('is gap-only on id 12', () => {
    expect(Array.from(buildJbigPreRasterMarker(12, 'gap'))).toEqual([0x1a, 0x0c, 0xff]);
    expect(buildJbigPreRasterMarker(12, 'continuous').length).toBe(0);
    expect(buildJbigPreRasterMarker(12, 'black-mark').length).toBe(0);
    expect(buildJbigPreRasterMarker(12, 'black-mark-2').length).toBe(0);
  });

  it('emits nothing for other ids', () => {
    expect(buildJbigPreRasterMarker(10, 'gap').length).toBe(0);
    expect(buildJbigPreRasterMarker(0, 'gap').length).toBe(0);
  });
});

describe('buildJbigTrailer', () => {
  it('id 7 — GS FF on black-mark-2, 1A 0C 00 otherwise', () => {
    expect(Array.from(buildJbigTrailer(7, 'black-mark-2'))).toEqual([0x1d, 0x0c]);
    expect(Array.from(buildJbigTrailer(7, 'continuous'))).toEqual([0x1a, 0x0c, 0x00]);
    expect(Array.from(buildJbigTrailer(7, 'gap'))).toEqual([0x1a, 0x0c, 0x00]);
    expect(Array.from(buildJbigTrailer(7, 'black-mark'))).toEqual([0x1a, 0x0c, 0x00]);
  });

  it('id 12 — 1A 0C 00 on gap, GS FF on black-mark, nothing otherwise', () => {
    expect(Array.from(buildJbigTrailer(12, 'gap'))).toEqual([0x1a, 0x0c, 0x00]);
    expect(Array.from(buildJbigTrailer(12, 'black-mark'))).toEqual([0x1d, 0x0c]);
    expect(buildJbigTrailer(12, 'continuous').length).toBe(0);
    expect(buildJbigTrailer(12, 'black-mark-2').length).toBe(0);
  });

  it('emits nothing for other ids', () => {
    expect(buildJbigTrailer(10, 'gap').length).toBe(0);
    expect(buildJbigTrailer(0, 'gap').length).toBe(0);
  });
});

describe('computeJbigPrintSpeedId12', () => {
  it('divides by 20480 and uses the whole job body', () => {
    // len = 20480/20480 = 1; round((800/8) / 1) = 100.
    expect(computeJbigPrintSpeedId12(800, 20480)).toBe(100);
    // len = 81920/20480 = 4; round((1600/8) / 4) = 50.
    expect(computeJbigPrintSpeedId12(1600, 81920)).toBe(50);
  });

  it('caps at 150 and clamps the pre-cap value to 30..300', () => {
    // Unclamped 16000 → clamped 300 → capped 150.
    expect(computeJbigPrintSpeedId12(4000, 2048)).toBe(150);
    // Unclamped 12.5 → clamped up to 30.
    expect(computeJbigPrintSpeedId12(200, 40960)).toBe(30);
  });

  it('guards a zero-length body', () => {
    expect(computeJbigPrintSpeedId12(800, 0)).toBe(150);
  });

  it('is not the id-7 formula — a 1 MiB divisor would pin every job at 150', () => {
    // 20480-byte body, 800-dot height: 100 here, 150 under payload/1048576.
    expect(computeJbigPrintSpeedId12(800, 20480)).not.toBe(150);
  });
});

describe('computeJbigPrintSpeedId7', () => {
  it('divides by 262144 and uses the payload length only', () => {
    expect(computeJbigPrintSpeedId7(1200, 262144)).toBe(150);
    expect(computeJbigPrintSpeedId7(100, 1024)).toBe(3200);
  });

  it('truncates rather than rounding', () => {
    // 101/8 = 12.625 → 12, not 13.
    expect(computeJbigPrintSpeedId7(101, 262144)).toBe(12);
  });

  it('applies no clamp and no 150 cap', () => {
    expect(computeJbigPrintSpeedId7(8000, 262144)).toBe(1000);
    expect(computeJbigPrintSpeedId7(8, 262144)).toBe(1);
  });

  it('guards a zero-length payload', () => {
    expect(computeJbigPrintSpeedId7(800, 0)).toBe(0);
  });
});

describe('buildGsLeftParenJ', () => {
  it('emits 1F 28 4A pL pH wL wH hL (8 bytes)', () => {
    const out = buildGsLeftParenJ(0x1234, 0x0200, 0x80);
    expect(out.length).toBe(8);
    expect(Array.from(out)).toEqual([0x1f, 0x28, 0x4a, 0x34, 0x12, 0x00, 0x02, 0x80]);
  });

  it('carries width in dots and height mod 256', () => {
    // 384 dots wide, 300 dots tall: width is a full u16, height keeps
    // its low byte only.
    expect(Array.from(buildGsLeftParenJ(4, 384, 300))).toEqual([
      0x1f, 0x28, 0x4a, 0x04, 0x00, 0x80, 0x01, 0x2c,
    ]);
  });
});
