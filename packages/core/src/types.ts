import type {
  DeviceEntry,
  MediaDescriptor,
  PrintEngine,
  PrintOptions,
  PrinterError,
  PrinterStatus,
} from '@thermal-label/contracts';

/**
 * Wire-protocol tags for marklife sub-engines.
 *
 * Every tag has an encoder; `marklife-jbig` cannot yet produce the
 * compressed payload its wrapper carries, so its chassis are not
 * drivable (see `isEngineDrivable`).
 */
export type MarklifeProtocol =
  | 'marklife-yxq'
  | 'marklife-jbig'
  | 'marklife-tspl'
  | 'marklife-escpos'
  | 'marklife-cpcl'
  | 'marklife-l11';

/**
 * Bit polarity for the wire format. Marklife packs `1=dark` for every
 * sub-engine — TSPL is inverted-from-spec (matches `tspl-core`'s `D1`
 * decision); JBIG / ESC/POS / YXQ are spec-aligned at `1=dark`.
 */
export type MarklifeBitPolarity = '1=dark' | '0=dark';

/**
 * Compression scheme used by the bitmap raster path.
 */
export type MarklifeCompression = 'zlib' | 'jbig' | 'lzo-mode-3' | 'none';

/**
 * BLE GATT profile in use. Four profiles coexist in the catalogue and
 * a chassis may host several; `marklife-web` resolves the one to use
 * by probing.
 */
export type MarklifeBleProfile = 'A' | 'B' | 'C' | 'D' | null;

/**
 * Physical-size class — drives best-guess head-dot count and media
 * compatibility. Expressed in inches, matching how the family is
 * marketed (0.5" narrow tape, 2" mobile, 3" desktop, 4" industrial).
 */
export type MarklifePhysicalSizeClass = 0.5 | 2.0 | 3.0 | 4.0;

export interface MarklifeEngineCapabilities {
  /** `1=dark` for every marklife sub-engine. */
  bitPolarity?: MarklifeBitPolarity;

  /** Compressor used by the bitmap path. */
  compression?: MarklifeCompression;

  /** Protocol id, 1..12, selecting the per-id variant inside `marklife-yxq` / `-jbig`. 0 = none. */
  protocolId?: number;

  /** Physical-size class, in inches. */
  physicalSizeClass?: MarklifePhysicalSizeClass;

  /** Captured from datasheet or empirical print test (mm). */
  headWidthMm?: number;

  /** Base chassis this whitelabel maps to (HARDWARE.md, Whitelabels). */
  realSeries?: string;

  /** Convenience BLE profile cache. */
  bleProfile?: MarklifeBleProfile;

  /** X2-family chassis support a red+black duplex; v1 emits monochrome only. */
  redBlackDuplex?: boolean;

  /**
   * Pause between packets when feeding a job, in milliseconds. The
   * family default is 30; see `pacingFor`.
   */
  interChunkDelayMs?: number;

  /** Open shape — driver-specific extensions land here. */
  [k: string]: unknown;
}

/**
 * A marklife engine — one printhead with one wire-protocol tag.
 */
/**
 * Marklife engine descriptor — same shape as `PrintEngine` but with
 * the `protocol` field tightened to the marklife enum and
 * `capabilities` (when present) typed as `MarklifeEngineCapabilities`.
 */
export type MarklifeEngine = PrintEngine & {
  protocol: MarklifeProtocol;
  capabilities?: MarklifeEngineCapabilities;
};

export type MarklifeDevice = DeviceEntry & {
  family: 'marklife';
  engines: readonly MarklifeEngine[];
};

/**
 * Marklife internal target-model taxonomy by head-size class.
 */
export type MarklifeTargetModel = 'narrow-tape' | 'mobile-2in' | 'desktop-3in' | 'industrial-4in';

export interface MarklifeMedia extends MediaDescriptor {
  targetModels: readonly MarklifeTargetModel[];
}

export type MarklifeAnyMedia = MarklifeMedia;

export interface MarklifePrintOptions extends PrintOptions {
  /**
   * Per-job density integer override (1..15). Wins over the
   * inherited string `density` ('light' / 'normal' / 'dark') when
   * present — useful when the host has fine-grained UI control.
   */
  densityLevel?: number;

  /**
   * Override the family default-rotation behaviour.
   *
   * - `'auto'` / `undefined` — use `pickRotation(image, media,
   *   ROTATE_DIRECTION)` from contracts.
   * - `0` / `90` / `180` / `270` — explicit rotation in degrees.
   */
  rotate?: 'auto' | 0 | 90 | 180 | 270;
}

export interface MarklifeStatus extends PrinterStatus {
  ready: boolean;
  mediaLoaded: boolean;
  paperOut: boolean;
  batteryLevel?: number;
  firmwareVersion?: string;
  headOverTemp?: boolean;
  errors: PrinterError[];
  rawBytes: Uint8Array;
}
