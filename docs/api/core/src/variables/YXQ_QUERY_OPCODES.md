[**marklife**](../../../README.md)

***

[marklife](../../../README.md) / [core/src](../README.md) / YXQ\_QUERY\_OPCODES

# Variable: YXQ\_QUERY\_OPCODES

> `const` **YXQ\_QUERY\_OPCODES**: `object`

YXQ-stream status reply opcodes.

Best-effort: each query claims its own leading byte rather than
sharing a documented enum, so this table is inferred and awaits
capture against hardware. The query commands themselves are
`1F 20 00` (status), `1F 80 00` (paper type) and the `10 FF 20 Fx`
info family.

## Type Declaration

### battery

> `readonly` **battery**: `16` = `0x10`

### firmware

> `readonly` **firmware**: `17` = `0x11`

### printerPrepare

> `readonly` **printerPrepare**: `19` = `0x13`

### printerStatus

> `readonly` **printerStatus**: `18` = `0x12`
