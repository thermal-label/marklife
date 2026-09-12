[**marklife**](../../../README.md)

***

[marklife](../../../README.md) / [core/src](../README.md) / yxqZlibDecompress

# Function: yxqZlibDecompress()

> **yxqZlibDecompress**(`input`): `Uint8Array`

Decompress vendor-zlib bytes. Used by tests for round-trip
verification and by the status parser when receiving vendor
replies that include zlib-compressed payloads (rare).

Deliberately left at the default window: inflate must accept the
printer's own streams as well as ours, and a large window reads
everything a small one can.

## Parameters

### input

`Uint8Array`

## Returns

`Uint8Array`
