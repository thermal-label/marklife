[**marklife**](../../../README.md)

***

[marklife](../../../README.md) / [web/src](../README.md) / fromSerialPort

# ~~Function: fromSerialPort()~~

> **fromSerialPort**(`port`, `modelKey`, `baudRate?`): `Promise`\<[`WebMarklifePrinter`](../classes/WebMarklifePrinter.md)\>

Convenience: build a printer from an already-picked Web Serial port.

`port` is typed as `unknown` to avoid a dependency on
`@types/w3c-web-serial`; the underlying
`WebSerialTransport.fromPort` accepts a `SerialPort` from the
browser global namespace.

## Parameters

### port

`unknown`

### modelKey

[`DeviceKey`](../../../node/src/type-aliases/DeviceKey.md)

### baudRate?

`number`

## Returns

`Promise`\<[`WebMarklifePrinter`](../classes/WebMarklifePrinter.md)\>

## Deprecated

Use `requestPrinters({ transport: 'serial', deviceKey })`
  from `./request-printers.ts`. Removed once consumers migrate (plan 11).
