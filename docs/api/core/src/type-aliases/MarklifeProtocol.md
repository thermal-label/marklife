[**marklife**](../../../README.md)

***

[marklife](../../../README.md) / [core/src](../README.md) / MarklifeProtocol

# Type Alias: MarklifeProtocol

> **MarklifeProtocol** = `"marklife-yxq"` \| `"marklife-jbig"` \| `"marklife-tspl"` \| `"marklife-escpos"` \| `"marklife-cpcl"` \| `"marklife-l11"`

Wire-protocol tags for marklife sub-engines.

Every tag has an encoder; `marklife-jbig` cannot yet produce the
compressed payload its wrapper carries, so its chassis are not
drivable (see `isEngineDrivable`).
