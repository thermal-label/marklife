import { describe, expect, it } from 'vitest';
import type { LabelBitmap } from '@mbtech-nl/bitmap';
import { DEVICES } from '../devices.js';
import { MEDIA } from '../media.js';
import { yxqZlibDecompress } from '../zlib.js';
import {
  CPCL_DPI,
  CPCL_HEAD_DOTS,
  CPCL_PAPER_TYPE_CONTINUOUS,
  CPCL_PAPER_TYPE_GAP,
  CPCL_PAPER_TYPE_RESERVED_20,
  CPCL_PAPER_TYPE_RESERVED_30,
  CPCL_RASTER_TAIL,
  buildCpclGapSense,
  buildCpclPageHeader,
  buildCpclPageWidth,
  buildCpclPaperType,
  buildCpclPrint,
  buildCpclRasterHeader,
  concatBytes,
  encodeCpclJob,
  isCpclEngine,
  type CpclEngine,
} from '../cpcl/index.js';

function createBitmap(widthPx: number, heightPx: number, fillByte = 0): LabelBitmap {
  const bytesPerRow = Math.ceil(widthPx / 8);
  const data = new Uint8Array(bytesPerRow * heightPx);
  data.fill(fillByte);
  return { widthPx, heightPx, data };
}

const dec = new TextDecoder();
const engine = DEVICES.T3.engines[0] as CpclEngine;

/** Locate the first occurrence of `needle` in `hay`, or -1. */
function indexOfBytes(hay: Uint8Array, needle: Uint8Array): number {
  outer: for (let i = 0; i + needle.length <= hay.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (hay[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

describe('isCpclEngine', () => {
  it('matches engines bound to marklife-cpcl (T3)', () => {
    expect(isCpclEngine(engine)).toBe(true);
  });

  it('rejects engines bound to other protocols', () => {
    expect(isCpclEngine(DEVICES.S8.engines[0]!)).toBe(false);
    expect(isCpclEngine(DEVICES.P12.engines[0]!)).toBe(false);
    expect(isCpclEngine(DEVICES.D100.engines[0]!)).toBe(false);
  });
});

describe('T3 registry binding', () => {
  it('declares the CPCL head geometry', () => {
    expect(engine.protocol).toBe('marklife-cpcl');
    expect(engine.dpi).toBe(CPCL_DPI);
    expect(engine.headDots).toBe(CPCL_HEAD_DOTS);
    expect(engine.capabilities?.compression).toBe('zlib');
  });
});

describe('buildCpclPaperType', () => {
  it('emits 1F 80 01 10 for gap stock', () => {
    expect(Array.from(buildCpclPaperType(CPCL_PAPER_TYPE_GAP))).toEqual([0x1f, 0x80, 0x01, 0x10]);
  });

  it('emits 1F 80 01 40 for continuous stock', () => {
    expect(Array.from(buildCpclPaperType(CPCL_PAPER_TYPE_CONTINUOUS))).toEqual([
      0x1f, 0x80, 0x01, 0x40,
    ]);
  });

  it('carries the two middle codes no media type reaches yet', () => {
    expect(Array.from(buildCpclPaperType(CPCL_PAPER_TYPE_RESERVED_20))).toEqual([
      0x1f, 0x80, 0x01, 0x20,
    ]);
    expect(Array.from(buildCpclPaperType(CPCL_PAPER_TYPE_RESERVED_30))).toEqual([
      0x1f, 0x80, 0x01, 0x30,
    ]);
  });

  it('masks the code to one byte', () => {
    expect(Array.from(buildCpclPaperType(0x140))).toEqual([0x1f, 0x80, 0x01, 0x40]);
  });
});

describe('buildCpclPageHeader', () => {
  it('emits ! 0 200 200 <height> 1 with a CRLF', () => {
    expect(dec.decode(buildCpclPageHeader(240))).toBe('! 0 200 200 240 1\r\n');
  });

  it('declares 200 dpi on both axes, not the family 203', () => {
    expect(dec.decode(buildCpclPageHeader(1))).not.toMatch(/203/);
  });
});

describe('buildCpclPageWidth', () => {
  it('emits PAGE-WIDTH <dots> with a CRLF', () => {
    expect(dec.decode(buildCpclPageWidth(576))).toBe('PAGE-WIDTH 576\r\n');
  });
});

describe('buildCpclRasterHeader', () => {
  it('ends the ASCII header with a space, not a newline', () => {
    const out = buildCpclRasterHeader(72, 240, 0);
    const ascii = dec.decode(out.subarray(0, out.length - 4));
    expect(ascii).toBe('ZG 72 240 0 0 ');
    // A CRLF here would be parsed as the first two length bytes.
    expect(ascii.endsWith(' ')).toBe(true);
    expect(ascii).not.toMatch(/[\r\n]/);
  });

  it('writes the compressed length as 4 bytes big-endian', () => {
    const out = buildCpclRasterHeader(72, 240, 0x01020304);
    expect(Array.from(out.subarray(out.length - 4))).toEqual([0x01, 0x02, 0x03, 0x04]);
  });

  it('zero-pads short lengths to the full 4 bytes', () => {
    // 300 → 00 00 01 2C. Little-endian would be 2C 01 00 00.
    const out = buildCpclRasterHeader(6, 16, 300);
    expect(Array.from(out.subarray(out.length - 4))).toEqual([0x00, 0x00, 0x01, 0x2c]);
  });

  it('emits header + 4 length bytes and nothing else', () => {
    const out = buildCpclRasterHeader(6, 16, 1);
    expect(out.length).toBe('ZG 6 16 0 0 '.length + 4);
  });
});

describe('buildCpclGapSense / buildCpclPrint / CPCL_RASTER_TAIL', () => {
  it('emits GAP-SENSE then FORM, both CRLF-terminated', () => {
    expect(dec.decode(buildCpclGapSense())).toBe('GAP-SENSE\r\nFORM\r\n');
  });

  it('emits PRINT with a CRLF', () => {
    expect(dec.decode(buildCpclPrint())).toBe('PRINT\r\n');
  });

  it('closes the ZG block with two CRLFs', () => {
    expect(Array.from(CPCL_RASTER_TAIL)).toEqual([0x0d, 0x0a, 0x0d, 0x0a]);
  });
});

describe('concatBytes', () => {
  it('joins parts in order', () => {
    expect(Array.from(concatBytes(new Uint8Array([1, 2]), new Uint8Array([3])))).toEqual([1, 2, 3]);
  });

  it('returns an empty array for no parts', () => {
    expect(concatBytes().length).toBe(0);
  });
});

describe('encodeCpclJob — gap media', () => {
  const bitmap = createBitmap(48, 16, 0xaa); // 6 bytes/row, 96 raster bytes
  const out = encodeCpclJob(engine, { bitmap, media: MEDIA.GAP_50X30 });

  it('opens with the gap paper-type command', () => {
    expect(Array.from(out.subarray(0, 4))).toEqual([0x1f, 0x80, 0x01, 0x10]);
  });

  it('composes paper type / page header / page width / ZG in order', () => {
    // The whole prefix up to the length bytes is deterministic ASCII.
    const prefix = dec.decode(
      out.subarray(4, 4 + '! 0 200 200 16 1\r\nPAGE-WIDTH 48\r\nZG 6 16 0 0 '.length),
    );
    expect(prefix).toBe('! 0 200 200 16 1\r\nPAGE-WIDTH 48\r\nZG 6 16 0 0 ');
  });

  it('emits no density command anywhere in the ASCII envelope', () => {
    // Our analysis shows a density value computed and then dropped
    // before the job is written. The envelope before the payload is
    // fully deterministic, so an exact-prefix match plus a keyword
    // sweep is enough to pin that down.
    const text = dec.decode(out);
    expect(text).not.toMatch(/DENSITY|TONE|SETSP|CONTRAST/);
    // 0x1F only ever appears as the paper-type opcode at offset 0 in
    // the uncompressed regions.
    const headerEnd = 4 + '! 0 200 200 16 1\r\nPAGE-WIDTH 48\r\nZG 6 16 0 0 '.length;
    expect(out.subarray(4, headerEnd).includes(0x1f)).toBe(false);
  });

  it('declares the compressed length big-endian and it matches the payload', () => {
    const headerEnd = 4 + '! 0 200 200 16 1\r\nPAGE-WIDTH 48\r\nZG 6 16 0 0 '.length;
    const lenBytes = out.subarray(headerEnd, headerEnd + 4);
    const declared =
      ((lenBytes[0] ?? 0) << 24) |
      ((lenBytes[1] ?? 0) << 16) |
      ((lenBytes[2] ?? 0) << 8) |
      (lenBytes[3] ?? 0);
    // Payload runs from after the length field to the `\r\n\r\n` tail,
    // which is followed by GAP-SENSE…PRINT.
    const trailer = 'GAP-SENSE\r\nFORM\r\nPRINT\r\n'.length;
    const payload = out.subarray(headerEnd + 4, out.length - trailer - CPCL_RASTER_TAIL.length);
    expect(declared).toBe(payload.length);
    // Two leading zero bytes prove it is not little-endian for a
    // payload this small.
    expect(lenBytes[0]).toBe(0);
    expect(lenBytes[1]).toBe(0);
  });

  it('compresses with the 1 KiB-window deflate, round-tripping the bitmap verbatim', () => {
    const headerEnd = 4 + '! 0 200 200 16 1\r\nPAGE-WIDTH 48\r\nZG 6 16 0 0 '.length;
    const trailer = 'GAP-SENSE\r\nFORM\r\nPRINT\r\n'.length;
    const payload = out.subarray(headerEnd + 4, out.length - trailer - CPCL_RASTER_TAIL.length);
    // 0x28 is the zlib CMF for a 1 KiB window (windowBits 10); the
    // 32 KiB-window compressor used by the TSPL path opens 0x78.
    expect(payload[0]).toBe(0x28);
    expect(Array.from(yxqZlibDecompress(payload))).toEqual(Array.from(bitmap.data));
  });

  it('closes the raster with two CRLFs before GAP-SENSE', () => {
    const marker = new TextEncoder().encode('\r\n\r\nGAP-SENSE\r\nFORM\r\n');
    expect(indexOfBytes(out, marker)).toBeGreaterThan(0);
  });

  it('ends with PRINT', () => {
    expect(dec.decode(out.subarray(out.length - 7))).toBe('PRINT\r\n');
  });
});

describe('encodeCpclJob — continuous media', () => {
  const bitmap = createBitmap(48, 16, 0x0f);
  const out = encodeCpclJob(engine, { bitmap, media: MEDIA.CONTINUOUS_50MM });

  it('opens with the continuous paper-type command', () => {
    expect(Array.from(out.subarray(0, 4))).toEqual([0x1f, 0x80, 0x01, 0x40]);
  });

  it('omits GAP-SENSE / FORM — there is no edge to register to', () => {
    const text = dec.decode(out);
    expect(text).not.toMatch(/GAP-SENSE/);
    expect(text).not.toMatch(/FORM/);
  });

  it('still ends with the raster tail then PRINT', () => {
    expect(dec.decode(out.subarray(out.length - 11))).toBe('\r\n\r\nPRINT\r\n');
  });

  it('carries the same page header and ZG shape as gap stock', () => {
    const prefix = dec.decode(
      out.subarray(4, 4 + '! 0 200 200 16 1\r\nPAGE-WIDTH 48\r\nZG 6 16 0 0 '.length),
    );
    expect(prefix).toBe('! 0 200 200 16 1\r\nPAGE-WIDTH 48\r\nZG 6 16 0 0 ');
  });
});

describe('encodeCpclJob — geometry edges', () => {
  it('clamps PAGE-WIDTH to the head but keeps the raster stride', () => {
    // 640 dots is wider than the 576-dot head. PAGE-WIDTH clamps;
    // the ZG row stride still describes the buffer we actually send.
    const bitmap = createBitmap(640, 4, 0x01);
    const out = encodeCpclJob(engine, { bitmap, media: MEDIA.CONTINUOUS_50MM });
    const text = dec.decode(out.subarray(0, 64));
    expect(text).toMatch(/PAGE-WIDTH 576\r\n/);
    expect(text).toMatch(/ZG 80 4 0 0 /);
  });

  it('leaves PAGE-WIDTH alone for a bitmap narrower than the head', () => {
    const bitmap = createBitmap(200, 4, 0x01);
    const out = encodeCpclJob(engine, { bitmap, media: MEDIA.CONTINUOUS_50MM });
    expect(dec.decode(out.subarray(0, 64))).toMatch(/PAGE-WIDTH 200\r\n/);
  });

  it('pads a short data buffer up to widthBytes * height', () => {
    // A hand-built bitmap whose buffer does not match its declared
    // stride would otherwise ship a truncated raster.
    const bitmap: LabelBitmap = { widthPx: 48, heightPx: 16, data: new Uint8Array(10) };
    const out = encodeCpclJob(engine, { bitmap, media: MEDIA.CONTINUOUS_50MM });
    const headerEnd = 4 + '! 0 200 200 16 1\r\nPAGE-WIDTH 48\r\nZG 6 16 0 0 '.length;
    const payload = out.subarray(headerEnd + 4, out.length - 'PRINT\r\n'.length - 4);
    expect(yxqZlibDecompress(payload).length).toBe(6 * 16);
  });

  it('truncates an over-long data buffer to widthBytes * height', () => {
    const bitmap: LabelBitmap = { widthPx: 48, heightPx: 16, data: new Uint8Array(500).fill(0x5a) };
    const out = encodeCpclJob(engine, { bitmap, media: MEDIA.CONTINUOUS_50MM });
    const headerEnd = 4 + '! 0 200 200 16 1\r\nPAGE-WIDTH 48\r\nZG 6 16 0 0 '.length;
    const payload = out.subarray(headerEnd + 4, out.length - 'PRINT\r\n'.length - 4);
    const raster = yxqZlibDecompress(payload);
    expect(raster.length).toBe(6 * 16);
    expect(raster.every(b => b === 0x5a)).toBe(true);
  });
});
