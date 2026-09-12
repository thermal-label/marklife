/**
 * YXQ-stream job encoder — composes a full print job for one of the
 * protocol-id-bound chassis (ids 1, 2, 3, 4, 5, 8, 9, 11).
 *
 * The ids share an opcode vocabulary but not a job shape, so
 * composition is per-id. Only id 2 is bench-confirmed; the rest is
 * inference from our own wire analysis of the family.
 *
 *   ids 1 / 2 / 4 / 11  density → wakeup → enable → raster →
 *                       trailing advance → stop
 *   id 3                paper-type → density → wakeup → enable →
 *                       pre-raster advance → raster → post-raster
 *                       advance → stop → park
 *   id 5                paper-type → retract → density-gear →
 *                       density → (wakeup on black-mark only) →
 *                       enable → raster → advance → park → stop
 *   ids 8 / 9           paper-type → density → (wakeup, id 8 only) →
 *                       enable → pre-raster advance → raster →
 *                       post-raster position → stop → position
 *
 * Ids 1..8 and 11 raster with `1F 10 …` + a zlib payload; id 9 sends
 * `1D 76 30 …` + raw rows instead. Per-id byte tables live in
 * `protocol.ts`. zlib parameters: DECISIONS.md § D2.
 *
 * Bitmap polarity: marklife packs `1=dark`, matching the wire format
 * (bit set when luma < 128, MSB-first). `LabelBitmap.data` from
 * `@mbtech-nl/bitmap` is already `1=dark` MSB-first row-major, so
 * we use it directly. See DECISIONS.md § D8.
 */

import type { LabelBitmap } from '@mbtech-nl/bitmap';
import { UnsupportedOperationError } from '@thermal-label/contracts';
import type { MarklifeEngine, MarklifeMedia, MarklifePrintOptions } from '../types.js';
import { yxqZlibCompress } from '../zlib.js';
import {
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
  type YxqPaperKind,
} from './protocol.js';

const SUPPORTED_PROTOCOL_IDS = new Set([1, 2, 3, 4, 5, 8, 9, 11]);

/** Nothing to emit for this element on this path. */
const NONE = new Uint8Array(0);

/** Trailing `ESC J` advance for the ids that close a page that way. */
const TRAILING_FEED_DOTS = 70;

/** Continuous-stock feed step for ids 3 and 8. */
const CONTINUOUS_FEED_STEPS = 100;

/** Continuous-stock feed step for id 5 — a shorter run than the 2" ids. */
const D210_CONTINUOUS_FEED_STEPS = 60;

/** id 5's density gear. */
const D210_DENSITY_GEAR = 2;

export interface YxqPage {
  bitmap: LabelBitmap;
  media: MarklifeMedia;
  options?: MarklifePrintOptions;
}

export type YxqEngine = MarklifeEngine & {
  protocol: 'marklife-yxq';
};

/**
 * Type guard — true when the engine binds to the YXQ-stream protocol.
 *
 * Accepts any `PrintEngine` so it can be used to refine entries
 * straight from `DEVICES[…].engines`.
 */
export function isYxqEngine(engine: { protocol: string }): engine is YxqEngine {
  return engine.protocol === 'marklife-yxq';
}

/**
 * Encode a marklife-yxq print job.
 *
 * The bitmap's row stride must already be a multiple of 8 dots — the
 * caller pads via `padBitmap({ widthMod: 8 })` from `@mbtech-nl/bitmap`
 * before invoking. Width-padding is intentional: the wire format
 * stores `widthBytes = ceil(widthPx / 8)`, and any trailing bits in
 * the last byte that don't correspond to dots produce horizontal
 * artefacts at the right edge.
 */
export function encodeYxqJob(engine: YxqEngine, page: YxqPage): Uint8Array {
  const rawProtocolId = engine.capabilities?.protocolId;
  const protocolId = typeof rawProtocolId === 'number' ? rawProtocolId : 0;

  if (!SUPPORTED_PROTOCOL_IDS.has(protocolId)) {
    throw new UnsupportedOperationError(
      'encodeYxqJob',
      `protocolId=${String(protocolId)} not supported in v1. Supported: ${[...SUPPORTED_PROTOCOL_IDS].join(', ')}.`,
    );
  }

  const kind = resolvePaperKind(page.media);
  const density = resolveDensity(protocolId, page.options);
  const raster = buildRasterBlock(protocolId, page.bitmap);

  switch (protocolId) {
    case 3:
      return encodeId3Job(kind, density, raster);
    case 5:
      return encodeId5Job(kind, density, raster);
    case 8:
      return encodeId8Job(kind, density, raster);
    case 9:
      return encodeId9Job(kind, density, raster);
    default:
      return encodeSimpleJob(protocolId, kind, density, raster);
  }
}

/**
 * Ids 1, 2, 4 and 11 — the plain shape. id 2 is the bench-confirmed
 * reference job; do not reshape this path without a print test.
 */
function encodeSimpleJob(
  protocolId: number,
  kind: YxqPaperKind,
  density: number,
  raster: Uint8Array,
): Uint8Array {
  return concatBytes(
    buildYxqDensity(protocolId, yxqDensitySlot(protocolId), density),
    buildYxqWakeup(protocolId),
    buildYxqEnablePrinter(protocolId),
    raster,
    // Exactly one of these is non-empty: ids 1 / 4 / 11 close a page
    // with ESC J, id 2 closes it on the media type.
    buildYxqPrintLineDots(protocolId, TRAILING_FEED_DOTS),
    buildYxqPageAdvance(protocolId, kind, true),
    buildYxqStop(protocolId),
  );
}

/**
 * id 3 (P50 class). Two details are easy to get wrong: the
 * continuous feed is emitted **twice** (once before the raster, once
 * before the stop), and the gap tail comes **after** the stop, not
 * before it.
 */
function encodeId3Job(kind: YxqPaperKind, density: number, raster: Uint8Array): Uint8Array {
  const continuous = kind === 'continuous';
  const feed = buildYxqFeedSteps(CONTINUOUS_FEED_STEPS);
  return concatBytes(
    // Paper type is a first-copy prelude; we emit a single copy per
    // job, so it is unconditional here.
    buildYxqPaperTypeSensor(3, kind),
    buildYxqDensity(3, yxqDensitySlot(3), density),
    buildYxqWakeup(3),
    buildYxqEnablePrinter(3),
    continuous ? feed : buildYxqGapSeek(),
    raster,
    buildYxqPostRasterPosition(3, kind),
    continuous ? feed : NONE,
    buildYxqStop(3),
    continuous ? NONE : buildYxqParkPosition(),
  );
}

/**
 * id 5 (D210 class). The wakeup belongs to the black-mark path only —
 * on gap and continuous stock those six NULs are read as job bytes.
 */
function encodeId5Job(kind: YxqPaperKind, density: number, raster: Uint8Array): Uint8Array {
  const continuous = kind === 'continuous';
  const blackMark = kind === 'black-mark' || kind === 'black-mark-2';
  return concatBytes(
    buildYxqPaperType(5, 1, yxqPaperTypeCode(kind)),
    buildYxqRetract(),
    buildYxqDensityGear(5, D210_DENSITY_GEAR),
    buildYxqDensity(5, yxqDensitySlot(5), density),
    blackMark ? buildYxqWakeup(5) : NONE,
    buildYxqEnablePrinter(5),
    raster,
    continuous ? buildYxqFeedSteps(D210_CONTINUOUS_FEED_STEPS) : buildYxqPositionToGap(),
    buildYxqParkPosition(),
    buildYxqStop(5),
  );
}

/** id 8 (X2 over BLE). */
function encodeId8Job(kind: YxqPaperKind, density: number, raster: Uint8Array): Uint8Array {
  const continuous = kind === 'continuous';
  return concatBytes(
    buildYxqPaperTypeSensor(8, kind),
    buildYxqDensity(8, yxqDensitySlot(8), density),
    buildYxqWakeup(8),
    buildYxqEnablePrinter(8),
    continuous ? buildYxqFeedSteps(CONTINUOUS_FEED_STEPS) : buildYxqGapSeek(),
    raster,
    buildYxqPostRasterPosition(8, kind),
    buildYxqStop(8),
    continuous ? buildYxqHomePosition() : buildYxqParkPosition(),
  );
}

/**
 * id 9 (X2 over SPP). Same positioning as id 8, but no wakeup, no
 * pre-raster feed on continuous stock, and a raw raster.
 *
 * The paper-type prelude is per-copy here rather than per-job; with a
 * single copy per job the two are the same stream.
 */
function encodeId9Job(kind: YxqPaperKind, density: number, raster: Uint8Array): Uint8Array {
  const continuous = kind === 'continuous';
  return concatBytes(
    buildYxqPaperTypeSensor(9, kind),
    buildYxqDensity(9, yxqDensitySlot(9), density),
    buildYxqEnablePrinter(9),
    continuous ? NONE : buildYxqGapSeek(),
    raster,
    buildYxqPostRasterPosition(9, kind),
    buildYxqStop(9),
    continuous ? buildYxqHomePosition() : buildYxqParkPosition(),
  );
}

/**
 * Raster block — header plus payload.
 *
 * id 9 sends raw rows behind a little-endian `1D 76 30` header;
 * every other id sends a zlib payload behind the big-endian `1F 10`
 * header, which also carries the compressed length.
 */
function buildRasterBlock(protocolId: number, bitmap: LabelBitmap): Uint8Array {
  const widthBytes = Math.ceil(bitmap.widthPx / 8);
  const heightDots = bitmap.heightPx;

  // 1-bpp packed payload — bitmap.data is already row-major MSB-first
  // 1=dark, matching the wire format. See DECISIONS.md § D8.
  const packed = ensurePackedExpectedSize(bitmap, widthBytes, heightDots);

  if (protocolId === 9) {
    return concatBytes(buildYxqRawRasterHeader(widthBytes, heightDots), packed);
  }
  const compressed = yxqZlibCompress(packed);
  return concatBytes(buildYxqRasterHeader(widthBytes, heightDots, compressed.length), compressed);
}

/**
 * Media type → the paper kind the paper-type and position commands
 * are keyed on. The catalogue ships continuous and die-cut stock
 * only; the black-mark kinds are here so a future black-mark media
 * entry reaches the right sensor mode instead of falling into the
 * gap branch.
 */
function resolvePaperKind(media: MarklifeMedia): YxqPaperKind {
  switch (media.type) {
    case 'continuous':
      return 'continuous';
    case 'black-mark':
      return 'black-mark';
    case 'black-mark-2':
      return 'black-mark-2';
    default:
      return 'gap'; // die-cut / gap / tape
  }
}

/**
 * Per-id density scale as `[light, normal, dark]`.
 *
 * Each chassis exposes its own window onto the head's 1..15 range and
 * a value outside it is not a shade the operator can ask for — id 1's
 * range tops out at 14, so the old "dark" of 15 was a level that
 * chassis cannot produce.
 *
 * id 2's 3 / 10 / 14 is bench-confirmed (a captured S2 job carries
 * `1F 70 01 0A` for a normal print). The rest is inference.
 *
 * id 9 runs a 5-step scale, 2 / 5 / 8 / 11 / 15; the three-way
 * light / normal / dark control maps onto its ends and middle, and a
 * caller who wants 5 or 11 passes `densityLevel`.
 */
const DENSITY_SCALES: Record<number, readonly [number, number, number]> = {
  1: [12, 13, 14],
  2: [3, 10, 14],
  3: [3, 10, 14],
  8: [3, 8, 14],
  9: [2, 8, 15],
};

/** Ids 4, 5 and 11. */
const DEFAULT_DENSITY_SCALE: readonly [number, number, number] = [11, 13, 15];

/**
 * Ids whose head rejects (or clamps oddly) a density outside a known
 * window — an explicit `densityLevel` is clamped into it rather than
 * sent through.
 */
const DENSITY_CLAMPS: Record<number, readonly [number, number]> = {
  1: [12, 14],
};

/**
 * Density byte, which is scaled per protocol id. An explicit
 * `densityLevel` wins over the light/normal/dark string, subject to
 * the per-id clamp.
 */
function resolveDensity(protocolId: number, options: MarklifePrintOptions | undefined): number {
  const scale = DENSITY_SCALES[protocolId] ?? DEFAULT_DENSITY_SCALE;
  if (options?.densityLevel !== undefined) {
    return clampDensity(protocolId, options.densityLevel);
  }
  switch (options?.density) {
    case 'light':
      return scale[0];
    case 'dark':
      return scale[2];
    default:
      return scale[1]; // 'normal' and unset
  }
}

function clampDensity(protocolId: number, level: number): number {
  const clamp = DENSITY_CLAMPS[protocolId];
  if (clamp === undefined) return level;
  return Math.min(Math.max(level, clamp[0]), clamp[1]);
}

function ensurePackedExpectedSize(
  bitmap: LabelBitmap,
  widthBytes: number,
  heightDots: number,
): Uint8Array {
  const expected = widthBytes * heightDots;
  if (bitmap.data.length === expected) {
    return bitmap.data;
  }
  // The bitmap library always packs to a multiple of 8 dots wide. If
  // the bitmap declares a non-multiple-of-8 width, the data buffer is
  // still ceil(widthPx/8) wide per row — so this should not normally
  // trip. Fall back to a conservative copy if it does.
  const out = new Uint8Array(expected);
  out.set(bitmap.data.subarray(0, Math.min(bitmap.data.length, expected)));
  return out;
}
