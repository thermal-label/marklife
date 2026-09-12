[**marklife**](../../../README.md)

***

[marklife](../../../README.md) / [core/src](../README.md) / MarklifeStatus

# Interface: MarklifeStatus

## Extends

- [`PrinterStatus`](/contracts/api/interfaces/PrinterStatus)

## Properties

### batteryLevel?

> `optional` **batteryLevel?**: `number`

***

### errors

> **errors**: [`PrinterError`](/contracts/api/interfaces/PrinterError)[]

Structured error list. Empty array = no errors.

Use `PrinterError.code` for programmatic branching and
`PrinterError.message` for display.

#### Overrides

`PrinterStatus.errors`

***

### firmwareVersion?

> `optional` **firmwareVersion?**: `string`

***

### headOverTemp?

> `optional` **headOverTemp?**: `boolean`

***

### mediaLoaded

> **mediaLoaded**: `boolean`

Media is loaded (only meaningful if the printer supports detection).

#### Overrides

`PrinterStatus.mediaLoaded`

***

### paperOut

> **paperOut**: `boolean`

***

### rawBytes

> **rawBytes**: `Uint8Array`

Raw status bytes from the printer.

Exposed for diagnostics and debugging — higher-level fields on this
interface should be preferred for normal use.

#### Overrides

`PrinterStatus.rawBytes`

***

### ready

> **ready**: `boolean`

Printer is ready to accept a print job.

#### Overrides

`PrinterStatus.ready`
