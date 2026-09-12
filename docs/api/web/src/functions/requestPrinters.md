[**marklife**](../../../README.md)

***

[marklife](../../../README.md) / [web/src](../README.md) / requestPrinters

# Function: requestPrinters()

> **requestPrinters**(`opts`): `Promise`\<`Readonly`\<`Record`\<`string`, [`PrinterAdapter`](/contracts/api/interfaces/PrinterAdapter)\>\>\>

Unified browser-picker factory for the marklife driver family.

Marklife chassis reach the browser over USB, BLE and Serial.
Dispatches on `opts.transport`:

- `'usb'` — WebUSB. The picker is filtered to the registry's
  USB-capable chassis; the picked device auto-identifies by
  vid/pid, falling back to an operator choice.
- `'bluetooth-gatt'` — name-filtered picker, runtime profile
  probe, and identification from the advertised name; the operator
  is only asked when the name matches no registry entry.
- `'serial'` / `'bluetooth-spp'` — always-ask. `deviceKey`
  required; throws immediately on omission.

## Parameters

### opts

[`ConnectOptions`](/contracts/api/type-aliases/ConnectOptions)

## Returns

`Promise`\<`Readonly`\<`Record`\<`string`, [`PrinterAdapter`](/contracts/api/interfaces/PrinterAdapter)\>\>\>
