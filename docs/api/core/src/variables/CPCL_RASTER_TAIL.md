[**marklife**](../../../README.md)

***

[marklife](../../../README.md) / [core/src](../README.md) / CPCL\_RASTER\_TAIL

# Variable: CPCL\_RASTER\_TAIL

> `const` **CPCL\_RASTER\_TAIL**: `Uint8Array`

Closes the `ZG` block: `\r\n\r\n`.

Two terminators, not one — the first ends the binary payload, the
second ends the `ZG` command. A single CRLF leaves the parser inside
the raster and it swallows the next command.
