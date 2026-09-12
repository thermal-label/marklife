import { describe, expect, it } from 'vitest';
import { ALL_MEDIA, DEFAULT_MEDIA, MEDIA, findMediaByDimensions } from '../media.js';

describe('MEDIA registry', () => {
  it('exports key→entry map', () => {
    expect(MEDIA.GAP_50X30).toBeDefined();
    expect(MEDIA.GAP_50X30.widthMm).toBe(50);
    expect(MEDIA.GAP_50X30.heightMm).toBe(30);
  });

  it('default media is 50×30 gap', () => {
    expect(DEFAULT_MEDIA).toBe(MEDIA.GAP_50X30);
  });

  it('ALL_MEDIA has at least 6 entries', () => {
    expect(ALL_MEDIA.length).toBeGreaterThanOrEqual(6);
  });
});

describe('findMediaByDimensions', () => {
  it('finds 50×30 die-cut by exact dimensions', () => {
    expect(findMediaByDimensions(50, 30)?.id).toBe('gap-50x30');
  });

  it('finds 100mm continuous by width-only', () => {
    expect(findMediaByDimensions(100)?.id).toBeDefined();
  });

  it('returns undefined for unknown size', () => {
    expect(findMediaByDimensions(999, 999)).toBeUndefined();
  });
});
