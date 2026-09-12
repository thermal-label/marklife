[**marklife**](../../../README.md)

***

[marklife](../../../README.md) / [node/src](../README.md) / parseYxqStatus

# Function: parseYxqStatus()

> **parseYxqStatus**(`bytes`): [`MarklifeStatus`](../interfaces/MarklifeStatus.md)

Parse a YXQ-stream reply.

The vendor framing is opcode + length + payload + tail. Without a
hardware capture to anchor the byte layout, this returns a
structural status with `rawBytes` filled and `errors` listing the
unrecognised opcode.

## Parameters

### bytes

`Uint8Array`

## Returns

[`MarklifeStatus`](../interfaces/MarklifeStatus.md)
