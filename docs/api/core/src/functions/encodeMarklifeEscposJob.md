[**marklife**](../../../README.md)

***

[marklife](../../../README.md) / [core/src](../README.md) / encodeMarklifeEscposJob

# Function: encodeMarklifeEscposJob()

> **encodeMarklifeEscposJob**(`engine`, `page`): `Uint8Array`

Encode a marklife-escpos print job.

The bitmap row-stride must be a multiple of 8 dots (caller-padded).
Wire-format width = `widthPx / 8` truncating; pixels past the last
8-dot boundary are silently dropped if not pre-padded.

## Parameters

### engine

[`MarklifeEscposEngine`](../type-aliases/MarklifeEscposEngine.md)

### page

[`MarklifeEscposPage`](../interfaces/MarklifeEscposPage.md)

## Returns

`Uint8Array`
