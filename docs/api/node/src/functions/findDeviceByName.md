[**marklife**](../../../README.md)

***

[marklife](../../../README.md) / [node/src](../README.md) / findDeviceByName

# Function: findDeviceByName()

> **findDeviceByName**(`name`): [`DeviceEntry`](/contracts/api/interfaces/DeviceEntry) \| `undefined`

Find a device by Bluetooth advertised name.

Longest registry prefix wins, so a name that extends another
entry's prefix resolves to the more specific entry. BLE names carry
the SPP name plus `_BLE` (`P12_ZA15B_BLE` → `P12`), so one prefix
serves both transports.

Returns `undefined` when no entry's `namePrefix` matches.

## Parameters

### name

`string`

## Returns

[`DeviceEntry`](/contracts/api/interfaces/DeviceEntry) \| `undefined`
