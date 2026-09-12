[**marklife**](../../../README.md)

***

[marklife](../../../README.md) / [core/src](../README.md) / lzoDecompress

# Function: lzoDecompress()

> **lzoDecompress**(`input`, `expectedLen`): `Uint8Array`

LZO1X-1 decompressor — sufficient for round-trip testing the
encoder above. Handles only the literal-only streams `lzoCompress`
produces; full match-resolving decoder is unnecessary because the
driver never reads LZO bytes back from a printer.

## Parameters

### input

`Uint8Array`

### expectedLen

`number`

## Returns

`Uint8Array`
