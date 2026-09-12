# `marklife-jbig` — ESC/POS-shaped framing, JBIG raster

The wire protocol bound to the D100, X4, X8 and their whitelabels
(U210, L100). The framing borrows Epson ESC/POS shapes — `GS L`,
`GS W`, `ESC a` — but the print speed and the raster ride on the
vendor's `0x1F` prefix: `1F ( s` for speed and `1F ( J` wrapping a
JBIG-compressed (ITU-T T.82) bitmap. Two protocol ids share the tag
and differ in more than a constant; a third rejects encoding
outright.

::: warning Unverified — and not drivable
No chassis on this protocol has ever been on the bench and there is
no capture behind these bytes: every value, every branch and both
speed formulas are inference from our own analysis of the family.

The JBIG payload encoder is **not implemented**. `jbigEncode` throws
`UnsupportedOperationError`, so `encodeJbigJob` cannot produce a job
and the five chassis are `unsupported` in the registry. The wrapper
bytes below are what the encoder will emit around a payload once one
exists.
:::

## Chassis by protocol id

| id | Chassis | Print width | Encoder |
| --- | --- | --- | --- |
| 7 | X4, L100 | 800 dots | wrapper implemented, payload pending |
| 12 | D100 | 864 dots | wrapper implemented, payload pending |
| 10 | X8, U210 | — | **rejected** — a different wire protocol carrying the same tag; needs its own encoder |

The D210 is a 4" chassis like the X8 but speaks the
[YXQ stream](./yxq) (id 5), not this one.

## Opcode vocabulary

| Opcode | Bytes | Ids | Description |
| --- | --- | --- | --- |
| Print speed | `1F 28 73 02 00 sL sH` | 7, 12 | Speed word, little-endian; formula per id below. `0x1F`, not `GS`: on `1D` the firmware reads `73` as an Epson function code and eats raster as parameters. |
| Density | `12 23 dd` | 7, 12 | `dd` is 4 light, 9 normal, 13 dark. |
| Left margin | `1D 4C nL nH` | 12 | `GS L`, sent as 0. |
| Print width | `1D 57 nL nH` | 7, 12 | `GS W` — 800 (`20 03`) on id 7, 864 (`60 03`) on id 12. Page width, not head width. |
| Justify | `1B 61 01` | 7, 12 | `ESC a` centre. |
| Paper type | `1F 80 01 pp` | 7 | `10` continuous, `20` gap, `30` black-mark, `40` black-mark 2. Id 12 has no paper-type command. |
| Pre-raster marker | `1A 0C FF` | 7 (always); 12 (gap stock) | Paired with the trailer; without the pair the head buffers the page and idles. |
| Raster | `1F 28 4A pL pH wL wH hL` + JBIG | 7, 12 | Payload length LE16, width in **dots** LE16, height **low byte only**. |
| Trailer | `1A 0C 00` | 7 (all but black-mark 2); 12 (gap) | Post-raster feed marker. |
| Trailer | `1D 0C` | 7 (black-mark 2); 12 (black-mark) | `GS FF`. |

Id 12 sends no trailer at all on continuous and black-mark-2 stock;
those close the page on their own, and an extra feed advances blank
media on every copy.

## Job byte streams

### Id 12 — D100

```
1F 28 73 02 00 sL sH      print speed (first copy only)
12 23 dd                  density (every copy)
1D 4C 00 00               GS L 0
1D 57 60 03               GS W 864
1B 61 01                  ESC a centre
1A 0C FF                  (gap stock)
1F 28 4A pL pH wL wH hL   + JBIG payload
1A 0C 00 | 1D 0C | —      trailer: gap | black-mark | continuous, black-mark 2
```

The speed is a function of the assembled body — density through
trailer, payload included — so the body is built first and the speed
block prepended:

```
len   = bodyLen / 20480
speed = min(150, clamp(round((heightDots / 8) / len), 30, 300))
```

### Id 7 — X4, L100

```
1F 80 01 pp               paper type (first copy only)
12 23 dd                  density (first copy only)
1F 28 73 02 00 sL sH      print speed (every copy)
1D 57 20 03               GS W 800 — no GS L
1B 61 01                  ESC a centre
1A 0C FF                  (always)
1F 28 4A pL pH wL wH hL   + JBIG payload
1A 0C 00 | 1D 0C          trailer: everything else | black-mark 2
```

The speed formula is different, not a variant — payload length only,
no clamp, no cap:

```
speed = trunc((heightDots / 8) / (payloadLen / 262144))
```

## Raster wrapper

```
1F 28 4A  <payloadLen LE16>  <widthDots LE16>  <heightDots low byte>
<JBIG payload>
```

Two limits are in the framing itself: a payload over 65 535 bytes has
no representation, and a height of 256 dots or more has no high byte
anywhere. Neither is resolved.

The payload is a JBIG (T.82) encoding of the 1-bpp bitmap —
`ceil(width / 8)` bytes per row, MSB first, `1 = dark`, which is
`LabelBitmap.data` verbatim. A WASM build of `libjbigkit` is the
intended encoder; see `DECISIONS.md` D4.

## Media

`media.type` maps to the paper kind: `continuous` is continuous,
everything else is gap. The two black-mark kinds are implemented in
the builders because the trailer differs per kind, but no catalogue
media reaches them.
