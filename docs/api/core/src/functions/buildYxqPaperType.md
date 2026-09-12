[**marklife**](../../../README.md)

***

[marklife](../../../README.md) / [core/src](../README.md) / buildYxqPaperType

# Function: buildYxqPaperType()

> **buildYxqPaperType**(`protocolId`, `i8`, `paperType`): `Uint8Array`

Paper-type command for ids 5, 7, 12 — `1F 80 i8 <sensorMode>`.

`paperType` is the numeric code, mapped to a sensor-mode byte by
the table below. Pick the code with `yxqPaperTypeCode` rather than
hard-coding one: the codes are not ordered and the sensor modes
they select are easy to pair up backwards.

## Parameters

### protocolId

`number`

### i8

`number`

### paperType

`number`

## Returns

`Uint8Array`
