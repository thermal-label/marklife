[**marklife**](../../../README.md)

***

[marklife](../../../README.md) / [core/src](../README.md) / buildCpclRasterHeader

# Function: buildCpclRasterHeader()

> **buildCpclRasterHeader**(`widthBytes`, `heightDots`, `compressedLength`): `Uint8Array`

`ZG <widthBytes> <heightDots> 0 0 ` + 4-byte big-endian length.

`0 0` is the raster origin. Two details are easy to get wrong and
both are fatal:

  - The header ends with a **space**, not a newline — the length
    bytes butt straight up against it. A CRLF here would be read as
    the first two length bytes.
  - The length is **big-endian** and counts *compressed* bytes. Wrong
    endianness makes the parser wait for a payload that never
    arrives; the uncompressed length makes it overrun into the tail.

## Parameters

### widthBytes

`number`

### heightDots

`number`

### compressedLength

`number`

## Returns

`Uint8Array`
