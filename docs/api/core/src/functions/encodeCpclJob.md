[**marklife**](../../../README.md)

***

[marklife](../../../README.md) / [core/src](../README.md) / encodeCpclJob

# Function: encodeCpclJob()

> **encodeCpclJob**(`engine`, `page`): `Uint8Array`

Encode a marklife-cpcl print job.

Width padding to a byte boundary is the bitmap library's job
(`padBitmap({ widthMod: 8 })`); this encoder does not pre-transform.

## Parameters

### engine

[`CpclEngine`](../type-aliases/CpclEngine.md)

### page

[`CpclPage`](../interfaces/CpclPage.md)

## Returns

`Uint8Array`
