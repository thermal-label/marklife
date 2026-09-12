# `marklife-escpos` — ESC/POS raster subset

An Epson ESC/POS job reduced to what a label needs: reset, margin,
print width, line spacing, density, a `GS v 0` raster, a form feed.
The spec-aligned directives come from
[`@thermal-label/escpos-core`](https://thermal-label.github.io/escpos-core/);
this page documents the job the encoder composes and the two
additions to the core.

::: warning No chassis bound
No registry entry binds to `marklife-escpos`. The LP15 did until our
own analysis showed it speaks [L11](./l11): the ESC/POS envelope has
no enable and no stop command, so an LP15 job was buffered and never
committed. The encoder is retained because the vocabulary is real,
but it is exercised only against a synthetic engine in the test
suite and nothing on this page has been driven against hardware.
:::

## Job byte stream

```
1B 40                          ESC @        reset
00 00 00 00 00 00                           wake — six NULs
1D 4C 00 00                    GS L 0       left margin
1D 57 wL wH                    GS W         print width in dots
1B 33 00                       ESC 3 0      line spacing
1B 4E 07 dd                    ESC N 7      density
1D 76 30 00 wL wH hL hH        GS v 0       raster header: width in bytes, height in dots, LE16
<wBytes × h rows>
0C                             FF           form feed
1B 64 04                       ESC d 4      feed four lines
```

The raster is `LabelBitmap.data` — `ceil(width / 8)` bytes per row,
MSB first, `1 = dark`, which is the ESC/POS convention — with no
repacking. The row stride rounds **up**; flooring it drops the last
one to seven columns of any width that is not a multiple of 8 and
produces a zero-width raster below 8 dots.

## Additions to `escpos-core`

**Wake.** Six NULs after the reset. Not in any specification; a NUL
is a no-op in ESC/POS, so a printer that does not want them ignores
them.

**`FF`.** `buildFormFeed` in `marklife-core/src/escpos/protocol.ts`
hosts the form feed until `escpos-core` carries one.

## Print width

`GS W` takes `capabilities.headWidthMm × 8` when the engine declares a
head width in millimetres, else `engine.headDots`, else 384. The
dots-per-millimetre factor is fixed at 8 (203 dpi), which every
chassis in the catalogue shares.

## Density

`'light' | 'normal' | 'dark'` map to `ESC N 7` values `5 | 8 | 12`;
`densityLevel` is sent through unchanged.
