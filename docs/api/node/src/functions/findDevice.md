[**marklife**](../../../README.md)

***

[marklife](../../../README.md) / [node/src](../README.md) / findDevice

# Function: findDevice()

> **findDevice**(`key`): [`DeviceEntry`](/contracts/api/interfaces/DeviceEntry) \| `undefined`

Find a device by registry key (string lookup, case-sensitive). A
thin wrapper around the typed `DEVICES` map for runtime callers
that don't have the literal key type at hand.

## Parameters

### key

`string`

## Returns

[`DeviceEntry`](/contracts/api/interfaces/DeviceEntry) \| `undefined`
