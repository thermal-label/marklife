[**marklife**](../../../README.md)

***

[marklife](../../../README.md) / [core/src](../README.md) / buildYxqPrintLineDots

# Function: buildYxqPrintLineDots()

> **buildYxqPrintLineDots**(`protocolId`, `dots`): `Uint8Array`

Print-line-dots advance — only emitted by ids 1, 4, 11.

Wire: `[0x1B, 0x4A, dots]` (ESC J n). id 5 is in the same command
family but composes its own postlude (`buildYxqFeedSteps`), so it
never routes through here.

## Parameters

### protocolId

`number`

### dots

`number`

## Returns

`Uint8Array`
