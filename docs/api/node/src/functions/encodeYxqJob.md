[**marklife**](../../../README.md)

***

[marklife](../../../README.md) / [node/src](../README.md) / encodeYxqJob

# Function: encodeYxqJob()

> **encodeYxqJob**(`engine`, `page`): `Uint8Array`

Encode a marklife-yxq print job.

The bitmap's row stride must already be a multiple of 8 dots — the
caller pads via `padBitmap({ widthMod: 8 })` from `@mbtech-nl/bitmap`
before invoking. Width-padding is intentional: the wire format
stores `widthBytes = ceil(widthPx / 8)`, and any trailing bits in
the last byte that don't correspond to dots produce horizontal
artefacts at the right edge.

## Parameters

### engine

`YxqEngine`

### page

`YxqPage`

## Returns

`Uint8Array`
