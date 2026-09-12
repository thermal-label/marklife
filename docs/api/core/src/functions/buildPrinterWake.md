[**marklife**](../../../README.md)

***

[marklife](../../../README.md) / [core/src](../README.md) / buildPrinterWake

# Function: buildPrinterWake()

> **buildPrinterWake**(): `Uint8Array`

Vendor "printer wake" preamble — six NUL bytes.

Sent on open, before any ESC/POS directives, to wake the printer
from idle. Trivial to
emit; trivial for a non-marklife printer to ignore (NUL is a no-op
in ESC/POS).

## Returns

`Uint8Array`
