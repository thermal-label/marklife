[**marklife**](../../../README.md)

***

[marklife](../../../README.md) / [core/src](../README.md) / buildL11BitmapHeader

# Function: buildL11BitmapHeader()

> **buildL11BitmapHeader**(`bytesPerRow`, `height`, `quality?`): `Uint8Array`

`GS v 0` raster header — `1D 76 30 quality wL wH hL hH`.

`bytesPerRow` and `height` are little-endian 16-bit fields.
`quality` is 0..3 (0 is the standard value). The raw 1-bpp bitmap
(`bytesPerRow * height` bytes, MSB-first, `1 = black`) follows the
header immediately — no compression, no length field.

## Parameters

### bytesPerRow

`number`

### height

`number`

### quality?

`number` = `0`

## Returns

`Uint8Array`
