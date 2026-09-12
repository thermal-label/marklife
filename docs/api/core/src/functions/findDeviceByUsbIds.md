[**marklife**](../../../README.md)

***

[marklife](../../../README.md) / [core/src](../README.md) / findDeviceByUsbIds

# Function: findDeviceByUsbIds()

> **findDeviceByUsbIds**(`vendorId`, `productId`): [`DeviceEntry`](/contracts/api/interfaces/DeviceEntry) \| `undefined`

Find a device by USB vendor / product id.

The registry stores `vid` / `pid` as hex strings (`'0x09c7'`); the
WebUSB and libusb surfaces both hand back numbers, so the compare
happens after `parseInt`. Only a handful of marklife chassis expose
USB at all — the rest are Bluetooth-only and never match.

## Parameters

### vendorId

`number`

### productId

`number`

## Returns

[`DeviceEntry`](/contracts/api/interfaces/DeviceEntry) \| `undefined`
