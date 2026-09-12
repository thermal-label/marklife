[**marklife**](../../../README.md)

***

[marklife](../../../README.md) / [core/src](../README.md) / jbigEncode

# Function: jbigEncode()

> **jbigEncode**(`_plane`, `_width`, `_height`): `Uint8Array`

JBIG-encode a packed 1-bpp bitplane to a JBIG byte stream.

Input contract — this is what an implementation must accept:

- `plane` — `ceil(width / 8) * height` bytes, row-major, MSB-first,
  **bit set = dark pixel**. Not 8-bit greyscale, and not inverted:
  it is `LabelBitmap.data` verbatim, so callers pass the bitmap
  through untouched.
- `width` / `height` — pixel dimensions. `width` need not be a
  multiple of 8; the row stride rounds up and the spare low bits of
  the last byte in each row are undefined.

## Parameters

### \_plane

`Uint8Array`

### \_width

`number`

### \_height

`number`

## Returns

`Uint8Array`

## Throws

always — encoder is deferred
  in v1. See DECISIONS.md § D4.
