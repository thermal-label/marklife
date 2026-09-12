import { describe, expect, it } from 'vitest';
import { UnsupportedOperationError } from '@thermal-label/contracts';
import { encodeJobForEngine, isEngineDrivable } from '../encode.js';
import { DEVICES } from '../devices.js';
import { MEDIA } from '../media.js';
import type { MarklifeEngine } from '../types.js';

describe('encodeJobForEngine', () => {
  it('drives S8 (marklife-yxq)', () => {
    const engine = DEVICES.S8.engines[0] as MarklifeEngine;
    expect(isEngineDrivable(engine)).toBe(true);
    const out = encodeJobForEngine(engine, {
      bitmap: { widthPx: 8, heightPx: 1, data: new Uint8Array([0xff]) },
      media: MEDIA.GAP_50X30,
    });
    expect(out.length).toBeGreaterThan(0);
  });

  it('throws for marklife-jbig (encoder deferred)', () => {
    const engine = DEVICES.D100.engines[0] as MarklifeEngine;
    expect(isEngineDrivable(engine)).toBe(false);
    expect(() =>
      encodeJobForEngine(engine, {
        bitmap: { widthPx: 8, heightPx: 1, data: new Uint8Array([0xff]) },
        media: MEDIA.GAP_50X30,
      }),
    ).toThrow(UnsupportedOperationError);
  });

  it('drives P12 (marklife-l11)', () => {
    const engine = DEVICES.P12.engines[0] as MarklifeEngine;
    expect(isEngineDrivable(engine)).toBe(true);
    const out = encodeJobForEngine(engine, {
      bitmap: { widthPx: 16, heightPx: 8, data: new Uint8Array(2 * 8) },
      media: MEDIA.CONTINUOUS_15MM,
    });
    expect(out.length).toBeGreaterThan(0);
  });

  it('drives A1 (marklife-tspl)', () => {
    const engine = DEVICES.A1.engines[0] as MarklifeEngine;
    expect(isEngineDrivable(engine)).toBe(true);
    const out = encodeJobForEngine(engine, {
      bitmap: { widthPx: 16, heightPx: 8, data: new Uint8Array(2 * 8) },
      media: MEDIA.GAP_50X30,
    });
    expect(out.length).toBeGreaterThan(0);
  });

  it('drives LP15 (marklife-escpos)', () => {
    const engine = DEVICES.LP15.engines[0] as MarklifeEngine;
    expect(isEngineDrivable(engine)).toBe(true);
    const out = encodeJobForEngine(engine, {
      bitmap: { widthPx: 16, heightPx: 8, data: new Uint8Array(2 * 8) },
      media: MEDIA.GAP_50X30,
    });
    expect(out.length).toBeGreaterThan(0);
  });

  it('throws for an unrecognised protocol', () => {
    // Was marklife-cpcl, which is implemented now — use a protocol
    // that genuinely has no encoder.
    const fakeEngine = {
      role: 'primary',
      protocol: 'marklife-not-a-protocol',
      dpi: 203,
      headDots: 384,
    } as unknown as MarklifeEngine;
    expect(isEngineDrivable(fakeEngine)).toBe(false);
    expect(() =>
      encodeJobForEngine(fakeEngine, {
        bitmap: { widthPx: 8, heightPx: 1, data: new Uint8Array(1) },
        media: MEDIA.GAP_50X30,
      }),
    ).toThrow(/no encoder/);
  });
});
