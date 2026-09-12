[**marklife**](../../../README.md)

***

[marklife](../../../README.md) / [core/src](../README.md) / buildYxqWakeup

# Function: buildYxqWakeup()

> **buildYxqWakeup**(`protocolId`): `Uint8Array`

Wakeup sequence — protocol-id-dependent run of NUL bytes.

- id 1, 11 → 15 NUL bytes
- id 3, 4, 5, 8 → 6 NUL bytes
- others → none

id 5 only wakes on black-mark stock; the caller gates it (see
`encode.ts`). id 9 has no wakeup at all — its first bytes on the
wire are the paper-type / density prelude.

## Parameters

### protocolId

`number`

## Returns

`Uint8Array`
