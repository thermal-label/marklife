[**marklife**](../../../README.md)

***

[marklife](../../../README.md) / [web/src](../README.md) / WebMarklifePrinter

# Class: WebMarklifePrinter

Browser driver for the marklife family.

Takes any `Transport` — `WebUsbTransport` / `WebSerialTransport`
from `@thermal-label/transport/web`, or `MarklifeBleTransport` for
GATT — and a `DeviceEntry` from the registry. The job is encoded by
`encodeJobForEngine` and fed to the transport in registry-sized
packets with a pause between them; see `pacingFor` in core for why
that happens here rather than in the transport.

## Implements

- [`PrinterAdapter`](/contracts/api/interfaces/PrinterAdapter)

## Constructors

### Constructor

> **new WebMarklifePrinter**(`device`, `transport`, `options?`): `WebMarklifePrinter`

#### Parameters

##### device

[`DeviceEntry`](/contracts/api/interfaces/DeviceEntry)

##### transport

[`Transport`](/contracts/api/interfaces/Transport)

##### options?

[`WebMarklifePrinterOptions`](../interfaces/WebMarklifePrinterOptions.md) = `{}`

#### Returns

`WebMarklifePrinter`

## Properties

### device

> `readonly` **device**: [`DeviceEntry`](/contracts/api/interfaces/DeviceEntry)

The device entry for the connected printer.

Useful for logging, diagnostics, and displaying VID/PID. Undefined
if the connection was established without device matching (e.g. a
raw TCP connection to a known IP).

#### Implementation of

`PrinterAdapter.device`

***

### family

> `readonly` **family**: `"marklife"`

Driver family identifier, e.g. `'brother-ql'` or `'labelwriter'`.

#### Implementation of

`PrinterAdapter.family`

## Accessors

### connected

#### Get Signature

> **get** **connected**(): `boolean`

Whether the printer is currently connected.

##### Returns

`boolean`

#### Implementation of

`PrinterAdapter.connected`

***

### model

#### Get Signature

> **get** **model**(): `string`

Human-readable model name from the driver's device registry.

##### Returns

`string`

#### Implementation of

`PrinterAdapter.model`

## Methods

### close()

> **close**(): `Promise`\<`void`\>

Close the connection. Always call in `finally` blocks.

#### Returns

`Promise`\<`void`\>

#### Implementation of

`PrinterAdapter.close`

***

### createPreview()

> **createPreview**(`image`, `options?`): `Promise`\<[`PreviewResult`](/contracts/api/interfaces/PreviewResult)\>

Generate a preview showing how this printer would reproduce the
design on the given media. Returns separated 1bpp planes with
display colours.

The driver uses its own colour-splitting logic (the same code that
`print()` uses internally) to produce the planes. The consuming app
renders whatever planes come back without needing to know the
splitting rules.

For offline preview without a live connection, use the static
`createPreviewOffline()` function exported from the driver's
`*-core` package instead.

#### Parameters

##### image

[`RawImageData`](/contracts/api/interfaces/RawImageData)

— full RGBA, typically from `designer.render()`.

##### options?

[`PreviewOptions`](/contracts/api/interfaces/PreviewOptions)

— optional media override. If media is omitted, uses
  detected media from the last `getStatus()`. If no status is
  available, the driver defaults to single-colour at the printer's
  native head width and sets `PreviewResult.assumed = true`.

#### Returns

`Promise`\<[`PreviewResult`](/contracts/api/interfaces/PreviewResult)\>

#### Implementation of

`PrinterAdapter.createPreview`

***

### getStatus()

> **getStatus**(): `Promise`\<[`MarklifeStatus`](../../../node/src/interfaces/MarklifeStatus.md)\>

No marklife chassis has a status query wired yet, so this reports
link state only and touches no wire. It still runs under the
serializer so a poll can never land inside a job once it does.

#### Returns

`Promise`\<[`MarklifeStatus`](../../../node/src/interfaces/MarklifeStatus.md)\>

#### Implementation of

`PrinterAdapter.getStatus`

***

### onStatus()

> **onStatus**(`cb`): () => `void`

Subscribe to push-based status updates. Drivers whose printers
spontaneously emit status frames (e.g. Brother QL over USB pushes
on lid open/close, media insert, end-of-job, errors) implement
this; consumers that prefer push semantics call this for instant
updates instead of polling `getStatus()` on a timer.

Drivers without push capability leave this undefined; consumers
fall back to periodic `getStatus()` calls.

The driver invokes `cb` for every status frame it receives —
spontaneous ones AND the response to `getStatus()` — so a
subscriber sees both unsolicited events and request-driven
updates. Returns an unsubscribe function.

Implementations are responsible for starting any underlying read
loop on first subscription (or earlier) and stopping it on
`close()`. Errors inside the read loop are reported via the
callback's parent driver layer (e.g. logged); they do not throw
out of `onStatus` after subscription.

#### Parameters

##### cb

(`status`) => `void`

#### Returns

() => `void`

#### Implementation of

`PrinterAdapter.onStatus`

***

### print()

> **print**(`image`, `media?`, `options?`): `Promise`\<`void`\>

Print from a full-colour RGBA image.

The driver converts to its native format internally:

- Single-colour media (`media.palette` undefined) — threshold/dither
  RGBA to a single 1bpp plane via `renderImage`.
- Multi-ink media (`media.palette` defined) — split into planes via
  `renderMultiPlaneImage` using that palette.

**Orientation:** drivers compute the rotation via `pickRotation`
(see `./orientation.ts`) — the input image is treated as the
intended visual; the driver auto-rotates landscape input on media
tagged `defaultOrientation: 'horizontal'`.

**Multi-ink splitting:** the palette on the media descriptor names
every ink the driver should classify pixels into; the contracts
package does not pick "red" or "black" — those facts live with the
media entry.

**Batch printing:** call `print()` once per label. The driver
handles job framing internally (e.g. Brother QL page-break commands
between sequential `print()` calls within the same session).

#### Parameters

##### image

[`RawImageData`](/contracts/api/interfaces/RawImageData)

— full RGBA, typically from `designer.render()`.

##### media?

[`MediaDescriptor`](/contracts/api/interfaces/MediaDescriptor)

— which media to print on. Determines dimensions,
  margins, and colour mode. If omitted, uses detected media from
  the last `getStatus()`.

##### options?

[`MarklifePrintOptions`](../../../node/src/interfaces/MarklifePrintOptions.md)

— per-call options (copies, density, etc.).

#### Returns

`Promise`\<`void`\>

#### Throws

MediaNotSpecifiedError if no media is known.

#### Implementation of

`PrinterAdapter.print`
