[**marklife**](../../../README.md)

***

[marklife](../../../README.md) / [core/src](../README.md) / buildYxqRasterHeader

# Function: buildYxqRasterHeader()

> **buildYxqRasterHeader**(`widthBytes`, `heightDots`, `payloadLen`): `Uint8Array`

Build the YXQ-stream raster header for a `widthBytes × heightDots`
tile with `payloadLen` zlib-compressed payload bytes.

Wire layout:

  1F 10 widthBytesHi widthBytesLo heightHi heightLo
        payloadLenB3 payloadLenB2 payloadLenB1 payloadLenB0

— 10 bytes total, followed by `payloadLen` payload bytes.

`widthBytes` rounds up: `ceil(widthPx / 8)`.

## Parameters

### widthBytes

`number`

### heightDots

`number`

### payloadLen

`number`

## Returns

`Uint8Array`
