[**marklife**](../../../README.md)

***

[marklife](../../../README.md) / [node/src](../README.md) / encodeMarklifeTsplJob

# Function: encodeMarklifeTsplJob()

> **encodeMarklifeTsplJob**(`_engine`, `page`): `Uint8Array`

Encode a marklife-tspl print job.

Bitmap padding to a multiple of 8 dots is the caller's
responsibility (`padBitmap({ widthMod: 8 })` from
`@mbtech-nl/bitmap`). The wire format expects `widthBytes =
ceil(widthPx / 8)`.

## Parameters

### \_engine

`MarklifeTsplEngine`

### page

`MarklifeTsplPage`

## Returns

`Uint8Array`
