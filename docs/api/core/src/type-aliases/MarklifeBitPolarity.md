[**marklife**](../../../README.md)

***

[marklife](../../../README.md) / [core/src](../README.md) / MarklifeBitPolarity

# Type Alias: MarklifeBitPolarity

> **MarklifeBitPolarity** = `"1=dark"` \| `"0=dark"`

Bit polarity for the wire format. Marklife packs `1=dark` for every
sub-engine — TSPL is inverted-from-spec (matches `tspl-core`'s `D1`
decision); JBIG / ESC/POS / YXQ are spec-aligned at `1=dark`.
