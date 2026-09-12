# `marklife-tspl` — TSPL II with a zlib `BITMAP`

A TSC TSPL II job — `CLS`, `SIZE`, `GAP`, `DENSITY`, `SPEED`,
`BITMAP`, `PRINT` — with one departure from the specification: the
`BITMAP` command uses mode 3 and carries a zlib-deflated raster where
the TSPL II manual defines mode 3 as LZO. The spec-aligned directives
come from [`@thermal-label/tspl-core`](https://thermal-label.github.io/tspl-core/);
this page documents only the departures.

::: warning No chassis bound
No registry entry binds to `marklife-tspl`. The T3 did until our own
analysis showed it speaks [CPCL](./cpcl); the P15, P15R, A1 and LP15
did until the same analysis showed they speak [L11](./l11). The
encoder is retained because a TSPL job shape exists for the family
and a chassis may yet route here, but nothing on this page has been
driven against hardware and every byte is inference.
:::

## Job byte stream

```
CLS\r\n
SIZE <w> mm,<h> mm\r\n
GAP 2 mm,0 mm\r\n                       (die-cut only)
SET GAP ON\r\n                          (die-cut only)
DENSITY <d>\r\n
SPEED 4\r\n
BITMAP 0,0,<wBytes>,<h>,3,<len>,<zlib payload>\r\n
PRINT <copies>\r\n
```

Continuous stock sends neither `GAP` nor `SET GAP`; the firmware
feeds the length `SIZE` declares.

## Departures from TSPL II

**`BITMAP` mode 3 is zlib, not LZO.** The payload is
`LabelBitmap.data` — `ceil(width / 8)` bytes per row, `1 = dark` —
deflated with stock zlib (level 6, 32 KiB window) by
`tsplZlibCompress`. This is *not* the 1 KiB window the
[YXQ raster](./yxq#raster-block) needs; the two compressors are kept
apart on purpose. A sixth field, the compressed length, precedes the
payload.

**Bit polarity is `1 = dark`**, inverted from the TSPL II
specification's `0 = dark`, and the same choice `tspl-core` makes.

**`SET GAP ON|OFF`** is a TSPL II directive not yet in `tspl-core`;
`buildSetGap` in `marklife-core/src/tspl/protocol.ts` hosts it until
the upstream builder lands.

## Density

`'light' | 'normal' | 'dark'` map to `DENSITY 5 | 8 | 12`;
`densityLevel` is sent through unchanged.
