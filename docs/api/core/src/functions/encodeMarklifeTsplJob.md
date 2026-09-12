[**marklife**](../../../README.md)

***

[marklife](../../../README.md) / [core/src](../README.md) / encodeMarklifeTsplJob

# Function: encodeMarklifeTsplJob()

> **encodeMarklifeTsplJob**(`_engine`, `page`): `Uint8Array`

Encode a marklife-tspl print job.

Bitmap padding to a multiple of 8 dots is the caller's
responsibility (`padBitmap({ widthMod: 8 })` from
`@mbtech-nl/bitmap`). The wire format expects `widthBytes =
ceil(widthPx / 8)`.

## Parameters

### \_engine

[`MarklifeTsplEngine`](../type-aliases/MarklifeTsplEngine.md)

### page

[`MarklifeTsplPage`](../interfaces/MarklifeTsplPage.md)

## Returns

`Uint8Array`
