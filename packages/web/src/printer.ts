import {
  ROTATE_DIRECTION,
  createPreviewOffline,
  encodeJobForEngine,
  isEngineDrivable,
  pacingFor,
  pickRotation,
  renderImage,
  type DeviceEntry,
  type MarklifeEngine,
  type MarklifeMedia,
  type MarklifePrintOptions,
  type MarklifeStatus,
  type MediaDescriptor,
  type PreviewOptions,
  type PreviewResult,
  type PrintEngine,
  type PrinterAdapter,
  type PrinterStatus,
  type RawImageData,
  type SendPacing,
  type Transport,
} from '@thermal-label/marklife-core';
import {
  MediaNotSpecifiedError,
  UnsupportedOperationError,
  WriteSerializer,
  pollingOnStatus,
} from '@thermal-label/contracts';

export interface WebMarklifePrinterOptions {
  /** Override threshold for the dither path (0..255). */
  threshold?: number;
  /**
   * Override the pause between packets (ms). Defaults to the registry
   * entry's `interChunkDelayMs`, else the family-wide 30.
   */
  interChunkDelayMs?: number;
}

/**
 * Browser driver for the marklife family.
 *
 * Takes any `Transport` — `WebUsbTransport` / `WebSerialTransport`
 * from `@thermal-label/transport/web`, or `MarklifeBleTransport` for
 * GATT — and a `DeviceEntry` from the registry. The job is encoded by
 * `encodeJobForEngine` and fed to the transport in registry-sized
 * packets with a pause between them; see `pacingFor` in core for why
 * that happens here rather than in the transport.
 */
export class WebMarklifePrinter implements PrinterAdapter {
  readonly family = 'marklife' as const;
  readonly device: DeviceEntry;

  private readonly transport: Transport;
  private readonly options: WebMarklifePrinterOptions;
  private readonly pacing: SendPacing;
  /** Serialises every transport-touching method, per the adapter contract. */
  private readonly serializer = new WriteSerializer();
  private lastStatus: PrinterStatus | undefined;

  constructor(device: DeviceEntry, transport: Transport, options: WebMarklifePrinterOptions = {}) {
    this.device = device;
    this.transport = transport;
    this.options = options;
    const registry = pacingFor(device);
    this.pacing = {
      packetBytes: registry.packetBytes,
      delayMs: options.interChunkDelayMs ?? registry.delayMs,
    };
  }

  get model(): string {
    return this.device.name;
  }

  get connected(): boolean {
    return this.transport.connected;
  }

  async print(
    image: RawImageData,
    media?: MediaDescriptor,
    options?: MarklifePrintOptions,
  ): Promise<void> {
    const engine = this.requireEngine();
    const resolvedMedia = (media ?? this.lastStatus?.detectedMedia) as MarklifeMedia | undefined;
    if (!resolvedMedia) throw new MediaNotSpecifiedError();

    const rotate = pickRotation(image, resolvedMedia, ROTATE_DIRECTION, options?.rotate);
    const threshold = this.options.threshold ?? thresholdForEngine(engine);
    const bitmap = renderImage(image, { dither: true, threshold, rotate });

    const wireBytes = encodeJobForEngine(engine as MarklifeEngine, {
      bitmap,
      media: resolvedMedia,
      ...(options !== undefined ? { options } : {}),
    });

    await this.serializer.run(() => this.writePaced(wireBytes));
  }

  async createPreview(image: RawImageData, options?: PreviewOptions): Promise<PreviewResult> {
    return Promise.resolve(createPreviewOffline(image, options));
  }

  /**
   * No marklife chassis has a status query wired yet, so this reports
   * link state only and touches no wire. It still runs under the
   * serializer so a poll can never land inside a job once it does.
   */
  getStatus(): Promise<MarklifeStatus> {
    return this.serializer.run(() => {
      const status: MarklifeStatus = {
        ready: this.transport.connected,
        mediaLoaded: this.lastStatus?.mediaLoaded ?? true,
        paperOut: false,
        errors: [],
        rawBytes: new Uint8Array(0),
      };
      this.lastStatus = status;
      return Promise.resolve(status);
    });
  }

  onStatus(cb: (status: PrinterStatus) => void): () => void {
    return pollingOnStatus(this, cb);
  }

  async close(): Promise<void> {
    await this.transport.close();
  }

  private async writePaced(bytes: Uint8Array): Promise<void> {
    const { packetBytes, delayMs } = this.pacing;
    for (let off = 0; off < bytes.length; off += packetBytes) {
      const end = Math.min(off + packetBytes, bytes.length);
      await this.transport.write(bytes.subarray(off, end));
      if (end < bytes.length && delayMs > 0) {
        await new Promise<void>(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  private requireEngine(): PrintEngine {
    const engine = this.device.engines[0];
    if (!engine || !isEngineDrivable(engine as MarklifeEngine)) {
      const reason = engine
        ? `protocol "${engine.protocol}" has no encoder in this build.`
        : 'no engines declared on this entry.';
      throw new UnsupportedOperationError(
        'print',
        `device ${this.device.key} has no drivable engine: ${reason}`,
      );
    }
    return engine;
  }
}

/**
 * Per-engine dither threshold default: 128 for the binary streams,
 * 135 for the JBIG path, and the TSPL II midpoint of 175 that
 * produces good monochrome output on label stock.
 */
function thresholdForEngine(engine: PrintEngine): number {
  switch (engine.protocol) {
    case 'marklife-tspl':
      return 175;
    case 'marklife-jbig':
      return 135;
    case 'marklife-escpos':
    case 'marklife-yxq':
    default:
      return 128;
  }
}
