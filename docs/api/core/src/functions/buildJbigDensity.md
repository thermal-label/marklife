[**marklife**](../../../README.md)

***

[marklife](../../../README.md) / [core/src](../README.md) / buildJbigDensity

# Function: buildJbigDensity()

> **buildJbigDensity**(`level`): `Uint8Array`

Vendor density byte — `[0x12, 0x23, density]`.

Density is mapped from a 1..3 host value to
(4, 9, 13) firmware codes; default 10. Not in any Epson spec —
vendor opcode.

## Parameters

### level

`number`

## Returns

`Uint8Array`
