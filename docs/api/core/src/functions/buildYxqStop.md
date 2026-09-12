[**marklife**](../../../README.md)

***

[marklife](../../../README.md) / [core/src](../README.md) / buildYxqStop

# Function: buildYxqStop()

> **buildYxqStop**(`protocolId`): `Uint8Array`

Stop command — protocol-id-dependent.

- id 1, 2 → `10 FF F1 45`
- id 3, 4, 8, 9, 11 → `1F C0 01 01`
- id 5 → `10 FF FE 45`
- others → none

## Parameters

### protocolId

`number`

## Returns

`Uint8Array`
