[**marklife**](../../../README.md)

***

[marklife](../../../README.md) / [core/src](../README.md) / buildGsLeftParenJ

# Function: buildGsLeftParenJ()

> **buildGsLeftParenJ**(`payloadLen`, `widthDots`, `heightDots`): `Uint8Array`

Vendor `1F ( J` wrapper around a JBIG-encoded payload.

Header layout:

  1F 28 4A pL pH wL wH hL

Where:
- `pL pH` — JBIG payload byte-length, little-endian u16. A payload
  over 65535 bytes has no representation here.
- `wL wH` — bitmap width in **dots** (not bytes), little-endian u16.
- `hL` — bitmap height, low byte only. Heights of 256 dots and up
  have no high byte anywhere in this framing; unresolved.

The payload bytes are appended after the 8-byte header.

## Parameters

### payloadLen

`number`

### widthDots

`number`

### heightDots

`number`

## Returns

`Uint8Array`
