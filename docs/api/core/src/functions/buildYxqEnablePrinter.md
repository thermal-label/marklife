[**marklife**](../../../README.md)

***

[marklife](../../../README.md) / [core/src](../README.md) / buildYxqEnablePrinter

# Function: buildYxqEnablePrinter()

> **buildYxqEnablePrinter**(`protocolId`): `Uint8Array`

Enable-printer command — protocol-id-dependent.

- id 1, 5 → `10 FF F1 03`
- id 2 → `10 FF F1 02`
- id 3, 4, 8, 9, 11 → `1F C0 01 00`
- others → none

## Parameters

### protocolId

`number`

## Returns

`Uint8Array`
