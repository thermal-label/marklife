# `marklife-cpcl` — CPCL page inside a binary envelope

The wire protocol bound to the T3. A CPCL page — `! 0 …` header,
`PAGE-WIDTH`, `ZG`, `PRINT` — with two departures from the CPCL the
label industry knows: a `1F 80 01` paper-type byte precedes the page,
and `ZG` carries a zlib-deflated raster behind a 4-byte length rather
than hex-ASCII.

::: warning Unverified
No CPCL chassis has ever reached the bench. Every byte on this page is
inferred from our own analysis of the family; nothing has been
confirmed against a printer and the whole path may be wrong. The T3
was bound here after that analysis showed it does not speak TSPL,
which it was bound to before.
:::

## Command vocabulary

| Command | Bytes | Description |
| --- | --- | --- |
| Paper type | `1F 80 01 cc` | `10` gap, `40` continuous. `20` and `30` exist but no media type maps onto them. |
| Page header | `! 0 200 200 <h> 1\r\n` | Offset 0, 200 dpi on both axes, page height `h` in dots, one label. |
| Page width | `PAGE-WIDTH <w>\r\n` | Print-area width in dots, clamped to the 576-dot head. |
| Raster | `ZG <wBytes> <h> 0 0 ` + `<len BE32>` + zlib + `\r\n\r\n` | Origin `0 0`. The header ends in a **space**, the length counts **compressed** bytes and is **big-endian**, and the block closes with two CRLFs. |
| Gap sense | `GAP-SENSE\r\nFORM\r\n` | Register to the next label edge. Gap stock only. |
| Print | `PRINT\r\n` | Commit the page. |

All CPCL text is plain ASCII with CRLF terminators.

## Job byte stream

```
1F 80 01 cc
! 0 200 200 <heightDots> 1\r\n
PAGE-WIDTH <widthDots>\r\n
ZG <widthBytes> <heightDots> 0 0 <len BE32> <zlib payload> \r\n\r\n
GAP-SENSE\r\nFORM\r\n          (gap stock only)
PRINT\r\n
```

No density command is emitted on this path.

### Raster

The payload is `LabelBitmap.data` — `ceil(width / 8)` bytes per row,
MSB first, `1 = dark` — deflated with the same 1 KiB-window zlib as
the [YXQ raster](./yxq#raster-block) (`yxqZlibCompress`), on the
assumption that the two share an inflate implementation. The length
field counts the compressed bytes.

Three details in the `ZG` header are each fatal on their own: a CRLF
where the trailing space belongs is read as the first two length
bytes; a little-endian length makes the parser wait for a payload
that never arrives; the uncompressed length makes it overrun into the
tail.

## Head geometry

`CPCL_HEAD_DOTS` is 576 (72 mm at 203 dpi) — inferred, unconfirmed.
