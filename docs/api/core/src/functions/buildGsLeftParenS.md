[**marklife**](../../../README.md)

***

[marklife](../../../README.md) / [core/src](../README.md) / buildGsLeftParenS

# Function: buildGsLeftParenS()

> **buildGsLeftParenS**(`printSpeed`): `Uint8Array`

Print speed — `1F 28 73 02 00 spdL spdH`.

The parameter word is the speed from `computeJbigPrintSpeedId7` /
`computeJbigPrintSpeedId12`, little-endian. Position is
load-bearing: this block must precede the raster (see `encode.ts`),
because a speed set after the page is committed does nothing and
the trailing bytes land in undefined parser state.

## Parameters

### printSpeed

`number`

## Returns

`Uint8Array`
