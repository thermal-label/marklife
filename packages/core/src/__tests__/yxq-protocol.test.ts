import { describe, expect, it } from 'vitest';
import {
  buildEscFeedDots,
  buildYxqDensity,
  buildYxqDensityGear,
  buildYxqEnablePrinter,
  buildYxqFeedSteps,
  buildYxqGapSeek,
  buildYxqHomePosition,
  buildYxqPageAdvance,
  buildYxqPaperType,
  buildYxqPaperTypeSensor,
  buildYxqParkPosition,
  buildYxqPositionToGap,
  buildYxqPostRasterPosition,
  buildYxqPrintLineDots,
  buildYxqRasterHeader,
  buildYxqRawRasterHeader,
  buildYxqRetract,
  buildYxqStop,
  buildYxqWakeup,
  concatBytes,
  yxqDensitySlot,
  yxqPaperTypeCode,
} from '../yxq/protocol.js';

describe('buildYxqWakeup', () => {
  it('emits 15 NUL bytes for ids 1 and 11', () => {
    expect(buildYxqWakeup(1)).toEqual(new Uint8Array(15));
    expect(buildYxqWakeup(11)).toEqual(new Uint8Array(15));
  });

  it('emits 6 NUL bytes for ids 3, 4, 5, 8', () => {
    for (const id of [3, 4, 5, 8]) {
      expect(buildYxqWakeup(id).length).toBe(6);
      expect(buildYxqWakeup(id).every(b => b === 0)).toBe(true);
    }
  });

  it('emits empty for ids without a wakeup — id 9 included', () => {
    for (const id of [2, 6, 7, 9, 10, 12]) {
      expect(buildYxqWakeup(id).length).toBe(0);
    }
  });
});

describe('buildYxqEnablePrinter', () => {
  it('id 1 → 10 FF F1 03', () => {
    expect(Array.from(buildYxqEnablePrinter(1))).toEqual([0x10, 0xff, 0xf1, 0x03]);
  });

  it('id 5 → 10 FF F1 03 (same as id 1)', () => {
    expect(Array.from(buildYxqEnablePrinter(5))).toEqual([0x10, 0xff, 0xf1, 0x03]);
  });

  it('id 2 → 10 FF F1 02', () => {
    expect(Array.from(buildYxqEnablePrinter(2))).toEqual([0x10, 0xff, 0xf1, 0x02]);
  });

  it('id 3 / 4 / 8 / 9 / 11 → 1F C0 01 00', () => {
    for (const id of [3, 4, 8, 9, 11]) {
      expect(Array.from(buildYxqEnablePrinter(id))).toEqual([0x1f, 0xc0, 0x01, 0x00]);
    }
  });

  it('returns empty for ids outside the family', () => {
    expect(buildYxqEnablePrinter(6).length).toBe(0);
  });
});

describe('buildYxqStop', () => {
  it('id 1 / 2 → 10 FF F1 45', () => {
    expect(Array.from(buildYxqStop(1))).toEqual([0x10, 0xff, 0xf1, 0x45]);
    expect(Array.from(buildYxqStop(2))).toEqual([0x10, 0xff, 0xf1, 0x45]);
  });

  it('id 5 → 10 FF FE 45', () => {
    expect(Array.from(buildYxqStop(5))).toEqual([0x10, 0xff, 0xfe, 0x45]);
  });

  it('id 3 / 4 / 8 / 9 / 11 → 1F C0 01 01', () => {
    for (const id of [3, 4, 8, 9, 11]) {
      expect(Array.from(buildYxqStop(id))).toEqual([0x1f, 0xc0, 0x01, 0x01]);
    }
  });

  it('returns empty for ids outside the family', () => {
    expect(buildYxqStop(6).length).toBe(0);
  });
});

describe('buildYxqDensity', () => {
  it('id 1 → 1F 70 01 density', () => {
    expect(Array.from(buildYxqDensity(1, 1, 13))).toEqual([0x1f, 0x70, 0x01, 13]);
  });

  it('id 4 → 10 FF 10 00 density', () => {
    expect(Array.from(buildYxqDensity(4, 1, 13))).toEqual([0x10, 0xff, 0x10, 0x00, 13]);
  });

  it('ids 2, 3, 8, 9 → 1F 70 i8 density (per-roll i8)', () => {
    expect(Array.from(buildYxqDensity(2, 1, 13))).toEqual([0x1f, 0x70, 0x01, 13]);
    expect(Array.from(buildYxqDensity(9, 2, 15))).toEqual([0x1f, 0x70, 0x02, 15]);
  });

  it('returns empty for ids outside the family', () => {
    expect(buildYxqDensity(6, 1, 13).length).toBe(0);
  });
});

describe('yxqDensitySlot', () => {
  it('ids 3, 8, 9 address slot 02', () => {
    for (const id of [3, 8, 9]) {
      expect(yxqDensitySlot(id)).toBe(2);
    }
  });

  it('every other id addresses slot 01 — id 2 is bench-confirmed', () => {
    for (const id of [1, 2, 4, 5, 11]) {
      expect(yxqDensitySlot(id)).toBe(1);
    }
  });
});

describe('buildYxqRasterHeader', () => {
  it('emits exactly 10 bytes', () => {
    expect(buildYxqRasterHeader(48, 240, 100).length).toBe(10);
  });

  it('encodes width / height / payload-len big-endian', () => {
    const header = buildYxqRasterHeader(0x1234, 0x5678, 0x12345678);
    expect(Array.from(header)).toEqual([
      0x1f, 0x10, 0x12, 0x34, 0x56, 0x78, 0x12, 0x34, 0x56, 0x78,
    ]);
  });
});

describe('buildYxqRawRasterHeader (id 9)', () => {
  it('emits 1D 76 30 <mode> with little-endian width / height', () => {
    expect(Array.from(buildYxqRawRasterHeader(0x1234, 0x5678))).toEqual([
      0x1d, 0x76, 0x30, 0x00, 0x34, 0x12, 0x78, 0x56,
    ]);
  });

  it('carries no payload-length field (8 bytes total)', () => {
    expect(buildYxqRawRasterHeader(48, 240).length).toBe(8);
  });

  it('passes the mode byte through', () => {
    expect(buildYxqRawRasterHeader(6, 16, 2)[3]).toBe(2);
  });
});

describe('buildYxqDensityGear', () => {
  it('only emits for id 5', () => {
    expect(Array.from(buildYxqDensityGear(5, 2))).toEqual([0x10, 0xff, 0x10, 0x00, 0x02]);
    expect(buildYxqDensityGear(1, 2).length).toBe(0);
  });
});

describe('buildYxqPaperType', () => {
  it('emits 1F 80 i8 mappedPaperType for id 5 / 7 / 12', () => {
    expect(Array.from(buildYxqPaperType(5, 1, 1))).toEqual([0x1f, 0x80, 0x01, 0x10]);
    expect(Array.from(buildYxqPaperType(7, 1, 10))).toEqual([0x1f, 0x80, 0x01, 0x40]);
    expect(Array.from(buildYxqPaperType(12, 1, 2))).toEqual([0x1f, 0x80, 0x01, 0x20]);
  });

  it('returns empty for ids that don’t use paper-type', () => {
    expect(buildYxqPaperType(1, 1, 1).length).toBe(0);
  });

  it('returns empty for an unknown paper-type code', () => {
    expect(buildYxqPaperType(5, 1, 99).length).toBe(0);
  });
});

describe('yxqPaperTypeCode', () => {
  it('maps continuous → 1 (sensor mode 0x10) and gap → 20 (0x30)', () => {
    expect(Array.from(buildYxqPaperType(5, 1, yxqPaperTypeCode('continuous')))).toEqual([
      0x1f, 0x80, 0x01, 0x10,
    ]);
    expect(Array.from(buildYxqPaperType(5, 1, yxqPaperTypeCode('gap')))).toEqual([
      0x1f, 0x80, 0x01, 0x30,
    ]);
  });

  it('maps the two black-mark modes to 0x20 / 0x40', () => {
    expect(Array.from(buildYxqPaperType(5, 1, yxqPaperTypeCode('black-mark')))).toEqual([
      0x1f, 0x80, 0x01, 0x20,
    ]);
    expect(Array.from(buildYxqPaperType(5, 1, yxqPaperTypeCode('black-mark-2')))).toEqual([
      0x1f, 0x80, 0x01, 0x40,
    ]);
  });
});

describe('buildYxqPaperTypeSensor', () => {
  it('ids 3 / 8 / 9 → 1F 80 02 <20|30|40>', () => {
    for (const id of [3, 8, 9]) {
      expect(Array.from(buildYxqPaperTypeSensor(id, 'gap'))).toEqual([0x1f, 0x80, 0x02, 0x20]);
      expect(Array.from(buildYxqPaperTypeSensor(id, 'black-mark'))).toEqual([
        0x1f, 0x80, 0x02, 0x30,
      ]);
      expect(Array.from(buildYxqPaperTypeSensor(id, 'black-mark-2'))).toEqual([
        0x1f, 0x80, 0x02, 0x40,
      ]);
    }
  });

  it('emits nothing on continuous stock', () => {
    expect(buildYxqPaperTypeSensor(3, 'continuous').length).toBe(0);
  });

  it('is a different table from the slot-1 paper-type command', () => {
    // gap is 0x20 here and 0x30 on the slot-1 table — swapping the
    // two selects a black-mark sensor on gap stock.
    expect(buildYxqPaperTypeSensor(3, 'gap')[3]).toBe(0x20);
    expect(buildYxqPaperType(5, 1, yxqPaperTypeCode('gap'))[3]).toBe(0x30);
  });

  it('returns empty for ids that don’t send it', () => {
    for (const id of [1, 2, 4, 5, 11]) {
      expect(buildYxqPaperTypeSensor(id, 'gap').length).toBe(0);
    }
  });
});

describe('position commands', () => {
  it('buildYxqGapSeek → 1F 11 51 (3-byte form)', () => {
    expect(Array.from(buildYxqGapSeek())).toEqual([0x1f, 0x11, 0x51]);
  });

  it('buildYxqRetract → 1F 11 51 00 00 (5-byte form, step 0)', () => {
    expect(Array.from(buildYxqRetract())).toEqual([0x1f, 0x11, 0x51, 0x00, 0x00]);
  });

  it('buildYxqRetract encodes its step little-endian', () => {
    expect(Array.from(buildYxqRetract(0x0102))).toEqual([0x1f, 0x11, 0x51, 0x02, 0x01]);
  });

  it('buildYxqParkPosition → 1F 11 50', () => {
    expect(Array.from(buildYxqParkPosition())).toEqual([0x1f, 0x11, 0x50]);
  });

  it('buildYxqHomePosition → 1F 11 00', () => {
    expect(Array.from(buildYxqHomePosition())).toEqual([0x1f, 0x11, 0x00]);
  });

  it('buildYxqPositionToGap → 1D 0C', () => {
    expect(Array.from(buildYxqPositionToGap())).toEqual([0x1d, 0x0c]);
  });
});

describe('buildYxqPostRasterPosition', () => {
  it('gap stock → 1F 12 20 00 for ids 3, 8, 9', () => {
    for (const id of [3, 8, 9]) {
      expect(Array.from(buildYxqPostRasterPosition(id, 'gap'))).toEqual([0x1f, 0x12, 0x20, 0x00]);
    }
  });

  it('continuous stock → 1F 12 00 00 for ids 8 and 9, nothing for id 3', () => {
    expect(Array.from(buildYxqPostRasterPosition(8, 'continuous'))).toEqual([
      0x1f, 0x12, 0x00, 0x00,
    ]);
    expect(Array.from(buildYxqPostRasterPosition(9, 'continuous'))).toEqual([
      0x1f, 0x12, 0x00, 0x00,
    ]);
    expect(buildYxqPostRasterPosition(3, 'continuous').length).toBe(0);
  });

  it('black-mark stock follows the gap branch', () => {
    expect(Array.from(buildYxqPostRasterPosition(8, 'black-mark'))).toEqual([
      0x1f, 0x12, 0x20, 0x00,
    ]);
  });

  it('returns empty for ids that don’t send it', () => {
    for (const id of [1, 2, 4, 5, 11]) {
      expect(buildYxqPostRasterPosition(id, 'gap').length).toBe(0);
    }
  });
});

describe('buildYxqFeedSteps', () => {
  it('emits the 5-byte form 1B 4A <lo> <hi> 00', () => {
    expect(Array.from(buildYxqFeedSteps(100))).toEqual([0x1b, 0x4a, 0x64, 0x00, 0x00]);
    expect(Array.from(buildYxqFeedSteps(60))).toEqual([0x1b, 0x4a, 0x3c, 0x00, 0x00]);
  });

  it('encodes the step little-endian across the byte boundary', () => {
    expect(Array.from(buildYxqFeedSteps(300))).toEqual([0x1b, 0x4a, 0x2c, 0x01, 0x00]);
  });

  it('is a different command from the 3-byte ESC J form', () => {
    expect(Array.from(buildEscFeedDots(100))).toEqual([0x1b, 0x4a, 0x64]);
    expect(buildYxqFeedSteps(100).length).toBe(5);
  });
});

describe('buildYxqPrintLineDots', () => {
  it('emits ESC J n for ids 1, 4, 11', () => {
    for (const id of [1, 4, 11]) {
      expect(Array.from(buildYxqPrintLineDots(id, 70))).toEqual([0x1b, 0x4a, 70]);
    }
  });

  it('returns empty for ids that don’t emit it — id 5 composes its own postlude', () => {
    for (const id of [2, 3, 5, 8, 9]) {
      expect(buildYxqPrintLineDots(id, 70).length).toBe(0);
    }
  });
});

describe('buildYxqPageAdvance', () => {
  it('id 2 gap stock → 1D 0C', () => {
    expect(Array.from(buildYxqPageAdvance(2, 'gap', true))).toEqual([0x1d, 0x0c]);
  });

  it('id 2 continuous stock → 1B 4A 64 on the final copy only', () => {
    expect(Array.from(buildYxqPageAdvance(2, 'continuous', true))).toEqual([0x1b, 0x4a, 0x64]);
    expect(buildYxqPageAdvance(2, 'continuous', false).length).toBe(0);
  });

  it('emits nothing for any other id — 1D 0C is not in id 3’s vocabulary', () => {
    for (const id of [1, 3, 4, 5, 8, 9, 11]) {
      expect(buildYxqPageAdvance(id, 'gap', true).length).toBe(0);
      expect(buildYxqPageAdvance(id, 'continuous', true).length).toBe(0);
    }
  });
});

describe('concatBytes', () => {
  it('concatenates correctly', () => {
    const a = new Uint8Array([1, 2]);
    const b = new Uint8Array([3, 4, 5]);
    expect(Array.from(concatBytes(a, b))).toEqual([1, 2, 3, 4, 5]);
  });

  it('handles empty input', () => {
    expect(concatBytes().length).toBe(0);
  });
});
