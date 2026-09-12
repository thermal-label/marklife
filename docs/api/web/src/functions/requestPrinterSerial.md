[**marklife**](../../../README.md)

***

[marklife](../../../README.md) / [web/src](../README.md) / requestPrinterSerial

# ~~Function: requestPrinterSerial()~~

> **requestPrinterSerial**(`options`): `Promise`\<[`WebMarklifePrinter`](../classes/WebMarklifePrinter.md)\>

Web Serial factory — for OS-paired Bluetooth-SPP printers.

Web Serial's picker is generic (lists every serial port the page
is permitted to see); the user picks one, and `deviceKey` tells the
runtime which engine to drive.

## Parameters

### options

[`RequestSerialOptions`](../interfaces/RequestSerialOptions.md)

## Returns

`Promise`\<[`WebMarklifePrinter`](../classes/WebMarklifePrinter.md)\>

## Deprecated

Use `requestPrinters({ transport: 'serial', deviceKey })`
  or `requestPrinters({ transport: 'bluetooth-spp', deviceKey })`
  from `./request-printers.ts`. Removed once consumers migrate (plan 11).
