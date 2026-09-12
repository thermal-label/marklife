[**marklife**](../../../README.md)

***

[marklife](../../../README.md) / [core/src](../README.md) / encodeL11Job

# Function: encodeL11Job()

> **encodeL11Job**(`_engine`, `page`): `Uint8Array`

Encode a marklife-l11 print job.

The bitmap is consumed as-is: `LabelBitmap.data` is already packed
to a `ceil(widthPx / 8)`-byte row stride, MSB-first, `1 = dark` —
the L11 raw raster format. Width-padding to a byte boundary is the
bitmap library's job; this encoder does not pre-transform.

## Parameters

### \_engine

[`L11Engine`](../type-aliases/L11Engine.md)

### page

[`L11Page`](../interfaces/L11Page.md)

## Returns

`Uint8Array`
