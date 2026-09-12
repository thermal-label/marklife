[**marklife**](../../../README.md)

***

[marklife](../../../README.md) / [core/src](../README.md) / CPCL\_PAPER\_TYPE\_GAP

# Variable: CPCL\_PAPER\_TYPE\_GAP

> `const` **CPCL\_PAPER\_TYPE\_GAP**: `16` = `0x10`

Paper-type codes for `1F 80 01 <code>`.

Four codes — `0x10`, `0x20`, `0x30`, `0x40` — with gap stock at the
low end and continuous stock at the high end (inferred).
Our media vocabulary has only `die-cut` and `continuous`, so only
these two are reachable; `0x20` and `0x30` are unreachable until the
catalogue grows a third and fourth stock kind. Sending the wrong
code puts the firmware on the wrong feed strategy — gap-sensing on
continuous stock feeds forever looking for an edge.
