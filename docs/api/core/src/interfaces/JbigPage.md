[**marklife**](../../../README.md)

***

[marklife](../../../README.md) / [core/src](../README.md) / JbigPage

# Interface: JbigPage

## Properties

### bitmap

> **bitmap**: [`LabelBitmap`](/contracts/api/interfaces/LabelBitmap)

***

### copyIndex?

> `optional` **copyIndex?**: `number`

0-based copy index, default 0.

Both ids gate blocks on "first copy", and they gate different
ones: id 7 sends its paper-type prelude and density once, id 12
repeats density per copy but sends print speed once. A
multi-copy caller concatenates one `encodeJbigJob` per copy with
this incremented; a single-copy caller ignores it.

***

### media

> **media**: [`MarklifeMedia`](MarklifeMedia.md)

***

### options?

> `optional` **options?**: [`MarklifePrintOptions`](MarklifePrintOptions.md)
