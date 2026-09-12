[**marklife**](../../../README.md)

***

[marklife](../../../README.md) / [core/src](../README.md) / MarklifeEngine

# Type Alias: MarklifeEngine

> **MarklifeEngine** = [`PrintEngine`](/contracts/api/interfaces/PrintEngine) & `object`

Marklife engine descriptor — same shape as `PrintEngine` but with
the `protocol` field tightened to the marklife enum and
`capabilities` (when present) typed as `MarklifeEngineCapabilities`.

## Type Declaration

### capabilities?

> `optional` **capabilities?**: [`MarklifeEngineCapabilities`](../interfaces/MarklifeEngineCapabilities.md)

### protocol

> **protocol**: [`MarklifeProtocol`](MarklifeProtocol.md)
