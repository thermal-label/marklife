[**marklife**](../../../README.md)

***

[marklife](../../../README.md) / [core/src](../README.md) / MarklifeEngineCapabilities

# Interface: MarklifeEngineCapabilities

## Indexable

> \[`k`: `string`\]: `unknown`

Open shape — driver-specific extensions land here.

## Properties

### bitPolarity?

> `optional` **bitPolarity?**: [`MarklifeBitPolarity`](../type-aliases/MarklifeBitPolarity.md)

`1=dark` for every marklife sub-engine.

***

### bleProfile?

> `optional` **bleProfile?**: [`MarklifeBleProfile`](../type-aliases/MarklifeBleProfile.md)

Convenience BLE profile cache.

***

### compression?

> `optional` **compression?**: [`MarklifeCompression`](../type-aliases/MarklifeCompression.md)

Compressor used by the bitmap path.

***

### headWidthMm?

> `optional` **headWidthMm?**: `number`

Captured from datasheet or empirical print test (mm).

***

### interChunkDelayMs?

> `optional` **interChunkDelayMs?**: `number`

Pause between packets when feeding a job, in milliseconds. The
family default is 30; see `pacingFor`.

***

### physicalSizeClass?

> `optional` **physicalSizeClass?**: [`MarklifePhysicalSizeClass`](../type-aliases/MarklifePhysicalSizeClass.md)

Physical-size class, in inches.

***

### protocolId?

> `optional` **protocolId?**: `number`

Protocol id, 1..12, selecting the per-id variant inside `marklife-yxq` / `-jbig`. 0 = none.

***

### realSeries?

> `optional` **realSeries?**: `string`

Base chassis this whitelabel maps to (HARDWARE.md, Whitelabels).

***

### redBlackDuplex?

> `optional` **redBlackDuplex?**: `boolean`

X2-family chassis support a red+black duplex; v1 emits monochrome only.
