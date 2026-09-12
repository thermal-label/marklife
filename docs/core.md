# Core API

`@thermal-label/marklife-core` is the shared protocol layer under
both runtime packages: six job encoders behind one dispatch, the
device and media registries, the send-pacing table, the offline
preview, and the `@thermal-label/contracts` base types re-exported
for convenience. It has no transport code and no Node builtins, so
it runs in a browser unchanged.

```bash
pnpm add @thermal-label/marklife-core
```

::: tip Looking for byte-level details?
The [protocol reference](./protocol/) documents every opcode and job
stream — [L11](./protocol/l11), [YXQ](./protocol/yxq),
[CPCL](./protocol/cpcl), [JBIG](./protocol/jbig),
[TSPL](./protocol/tspl), [ESC/POS](./protocol/escpos).
:::

## Exports

| Export | Description |
| --- | --- |
| `DEVICES` / `REGISTRY_MARKLIFE` / `findDevice` / `findDeviceByName` / `findDeviceByUsbIds` | Device registry and lookups. `findDeviceByName` matches an advertised or paired name by longest registry prefix (`P12_ZA15B_BLE` → `P12`). |
| `MEDIA` / `ALL_MEDIA` / `DEFAULT_MEDIA` / `findMediaByDimensions` | Media registry and lookups. `DEFAULT_MEDIA` backs the offline preview only; `print()` never assumes it. |
| `encodeJobForEngine(engine, page)` / `isEngineDrivable(engine)` | Dispatch on `engine.protocol`; the guard is false for `marklife-jbig` while its payload encoder is missing. |
| `encodeL11Job` / `encodeYxqJob` / `encodeCpclJob` / `encodeJbigJob` / `encodeMarklifeTsplJob` / `encodeMarklifeEscposJob` | The per-protocol encoders, with their `is*Engine` guards and byte builders. |
| `pacingFor(device)` / `DEFAULT_PACKET_BYTES` / `DEFAULT_PACKET_DELAY_MS` | Packet size and inter-packet pause for a chassis, from its registry entry. |
| `yxqZlibCompress` / `yxqZlibDecompress` / `tsplZlibCompress` | The two deflate paths — 1 KiB window for YXQ and CPCL, default window for TSPL. |
| `parseYxqStatus` / `YXQ_QUERY_OPCODES` | Structural decoder for a status reply no chassis has yet been seen to send. |
| `createPreviewOffline(image, options?)` | `PreviewResult` without a connection. |
| `ROTATE_DIRECTION` / `pickRotation` | The family's rotation direction and the contracts helper that applies it. |
| `renderImage` / `renderText` / `rotateBitmap` / `padBitmap` / `scaleBitmap` | Bitmap helpers re-exported from `@mbtech-nl/bitmap`. |
| `MarklifeDevice`, `MarklifeEngine`, `MarklifeMedia`, `MarklifePrintOptions`, `MarklifeStatus`, `MarklifeProtocol`, … | Driver types. |
| `PrinterAdapter`, `MediaDescriptor`, `Transport`, `MediaNotSpecifiedError`, `UnsupportedOperationError`, … | Re-exported from `@thermal-label/contracts`. |

## Key types

```ts
type MarklifeProtocol =
  | 'marklife-l11' | 'marklife-yxq' | 'marklife-cpcl'
  | 'marklife-jbig' | 'marklife-tspl' | 'marklife-escpos';

interface MarklifeEngineCapabilities {
  protocolId?: number;          // per-id variant inside marklife-yxq / -jbig
  compression?: 'zlib' | 'jbig' | 'lzo-mode-3' | 'none';
  bitPolarity?: '1=dark' | '0=dark';
  physicalSizeClass?: 0.5 | 2.0 | 3.0 | 4.0;
  headWidthMm?: number;
  realSeries?: string;          // base chassis of a whitelabel
  bleProfile?: 'A' | 'B' | 'C' | 'D' | null;
  redBlackDuplex?: boolean;
  interChunkDelayMs?: number;   // pause between packets; family default 30
}

interface MarklifeMedia extends MediaDescriptor {
  targetModels: readonly ('narrow-tape' | 'mobile-2in' | 'desktop-3in' | 'industrial-4in')[];
}

interface MarklifePrintOptions extends PrintOptions {
  densityLevel?: number;                    // wins over `density`
  rotate?: 'auto' | 0 | 90 | 180 | 270;
}

interface MarklifePage {
  bitmap: LabelBitmap;
  media: MarklifeMedia;
  options?: MarklifePrintOptions;
}
```

## Usage

### Encode a job

```ts
import { DEVICES, MEDIA, encodeJobForEngine, renderImage } from '@thermal-label/marklife-core';

const engine = DEVICES.S2.engines[0]!;
const bitmap = renderImage(image, { dither: true, threshold: 128 });
const bytes = encodeJobForEngine(engine, { bitmap, media: MEDIA.GAP_50X30 });
```

`bytes` is the whole job. Feed it to a transport in packets:

```ts
import { pacingFor } from '@thermal-label/marklife-core';

const { packetBytes, delayMs } = pacingFor(DEVICES.S2); // { 95, 30 }
for (let off = 0; off < bytes.length; off += packetBytes) {
  await transport.write(bytes.subarray(off, off + packetBytes));
  if (off + packetBytes < bytes.length) await new Promise(r => setTimeout(r, delayMs));
}
```

The runtime packages do exactly this inside `print()`; the loop is
here for hosts that drive a transport themselves. Skipping it is the
one way to make a chassis accept a job and print nothing.

### Bitmap contract

Every encoder consumes `LabelBitmap.data` verbatim: `ceil(width / 8)`
bytes per row, MSB first, `1 = dark`. That is what `renderImage`
produces, so there is no repacking step and no polarity flag to get
wrong.
