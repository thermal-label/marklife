import { describe, expect, it } from 'vitest';
import { createPreviewOffline } from '../preview.js';
import { MEDIA } from '../media.js';

function rgba(width: number, height: number): { width: number; height: number; data: Uint8Array } {
  const data = new Uint8Array(width * height * 4);
  data.fill(0xff); // white
  return { width, height, data };
}

describe('createPreviewOffline', () => {
  it('renders a 16×16 white image to a 1-bpp plane', () => {
    const result = createPreviewOffline(rgba(16, 16));
    expect(result.planes).toHaveLength(1);
    expect(result.planes[0]?.bitmap.widthPx).toBe(16);
    expect(result.planes[0]?.bitmap.heightPx).toBe(16);
    expect(result.assumed).toBe(true);
  });

  it('respects an explicit media descriptor', () => {
    const result = createPreviewOffline(rgba(8, 8), { media: MEDIA.GAP_40X30 });
    expect(result.media).toBe(MEDIA.GAP_40X30);
    expect(result.assumed).toBe(false);
  });
});
