import type { MediaDescriptor } from '@thermal-label/contracts';
import { MEDIA, type MediaKey } from './media.generated.js';
import type { MarklifeAnyMedia } from './types.js';

/**
 * The marklife media registry — keyed by stable `key` for
 * `MEDIA.GAP_50X30`-style access. Aggregated and validated by
 * `scripts/compile-data.mjs` from `data/media.json5`.
 */
export { MEDIA, type MediaKey };

/**
 * Default media when the caller does not specify. 50 × 30 mm gap
 * stock is the most common 2"-class consumable.
 */
export const DEFAULT_MEDIA: MarklifeAnyMedia = MEDIA.GAP_50X30;

/**
 * Find a media entry by physical dimensions.
 */
export function findMediaByDimensions(
  widthMm: number,
  heightMm?: number,
): MarklifeAnyMedia | undefined {
  for (const entry of Object.values(MEDIA) as MarklifeAnyMedia[]) {
    if (entry.widthMm !== widthMm) continue;
    if (heightMm === undefined) return entry;
    if (entry.type === 'die-cut' && entry.heightMm === heightMm) return entry;
  }
  return undefined;
}

export const ALL_MEDIA: readonly MediaDescriptor[] = Object.values(MEDIA);
