[**marklife**](../../../README.md)

***

[marklife](../../../README.md) / [core/src](../README.md) / buildYxqDensity

# Function: buildYxqDensity()

> **buildYxqDensity**(`protocolId`, `i8`, `density`): `Uint8Array`

Density command — protocol-id-dependent.

- id 1 → `1F 70 01 density`
- id 4 → `10 FF 10 00 density`
- id 5 → `1F 70 01 density`
- id 2, 3, 8, 9 → `1F 70 i8 density`

`i8` is the register slot — see `yxqDensitySlot`.

## Parameters

### protocolId

`number`

### i8

`number`

### density

`number`

## Returns

`Uint8Array`
