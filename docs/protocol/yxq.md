# `marklife-yxq` — command stream with zlib raster

The wire protocol of the 2" mobile and 4" desktop chassis: S2, S8,
P50, D210, X2 and their rebrands. Commands are opcode-prefixed byte
strings, most of them on a `0x1F` lead byte, and the raster travels
as a zlib stream behind a `1F 10` header. It is a vendor format with
no published specification and no Epson or TSC equivalent — the
`1D`-prefixed commands it borrows (`1D 0C`, `1D 76 30`) are the only
overlap.

The chassis differ in more than a constant. Each registry entry
carries a **protocol id** (`engines[].capabilities.protocolId`), and
the id selects the opcode bytes, the job shape and the density scale.
Eight ids share this tag; they are documented per id below.

::: info Provenance
**Bench-confirmed on protocol id 2 (S2):** the `1F` command prefix,
the raster header layout, the 1 KiB deflate window, `headDots: 384`,
the density scale, the `1D 0C` page advance on gap stock, the
95-byte packet ceiling and the 30 ms pacing. Two captured S2 jobs and
multi-packet prints over BLE and SPP (through the harness,
2026-09-13) agree on all of it.

**Every other id is inference** from our own analysis of the family
and has never been driven. Treat the per-id tables as a starting
point for a bench session, not as fact.
:::

## Chassis by protocol id

| id | Chassis | Job shape | Raster |
| --- | --- | --- | --- |
| 1 | S8 | simple | `1F 10` + zlib |
| **2** | **S2**, Jammuk S2, ewtto ET-Z0535, M50 | simple | `1F 10` + zlib |
| 3 | P50, M57, T2, LPW40 | positioned | `1F 10` + zlib |
| 5 | D210 | positioned, with retract | `1F 10` + zlib |
| 8 | X2 over BLE | positioned | `1F 10` + zlib |
| 9 | X2, M60 over SPP | positioned, no wakeup | `1D 76 30` + raw rows |
| 4, 11 | — | simple | `1F 10` + zlib |

Ids 4 and 11 are retained in the encoder but bind no chassis: the
units that once carried them (P12, R15) speak
[L11](./l11) and were rebound. Ids 7, 10 and 12 use the
[JBIG](./jbig) wrapper and never reach this encoder.

## Opcode vocabulary

| Opcode | Bytes | Ids | Description |
| --- | --- | --- | --- |
| Density | `1F 70 01 dd` | 1, 2, 5 | Set density `dd` on register slot 1. |
| Density | `1F 70 02 dd` | 3, 8, 9 | Same command, register slot 2. Addressing the wrong slot leaves the stored density in force. |
| Density | `10 FF 10 00 dd` | 4 | Density in the `10 FF` command family. |
| Density gear | `10 FF 10 00 gg` | 5 | Emitted with `gg = 2` before the density proper. |
| Wakeup | `00 × 15` | 1, 11 | Run of NULs before the enable. |
| Wakeup | `00 × 6` | 3, 4, 8; 5 on black-mark stock only | Shorter run. On id 5 the six NULs are read as job bytes on gap and continuous stock. |
| Enable | `10 FF F1 02` | 2 | Open the print session. |
| Enable | `10 FF F1 03` | 1, 5 | Open the print session. |
| Enable | `1F C0 01 00` | 3, 4, 8, 9, 11 | Open the print session. |
| Stop | `10 FF F1 45` | 1, 2 | Close the print session. |
| Stop | `10 FF FE 45` | 5 | Close the print session. |
| Stop | `1F C0 01 01` | 3, 4, 8, 9, 11 | Close the print session. |
| Paper type | `1F 80 01 mm` | 5 | Sensor mode: `10` continuous, `30` gap, `20` black-mark, `40` black-mark 2. |
| Paper type | `1F 80 02 mm` | 3, 8, 9 | Sensor mode on slot 2: `20` gap, `30` black-mark, `40` black-mark 2. **No command on continuous stock.** The two tables are not interchangeable — slot 1's gap code is slot 2's black-mark code. |
| Gap seek | `1F 11 51` | 3, 8, 9 | Advance to the next label edge before the raster (gap stock). |
| Retract | `1F 11 51 ll hh` | 5 | The same seek with an explicit LE16 step; sent with step 0 to retract to the sensor. |
| Park | `1F 11 50` | 3, 8, 9 (after stop); 5 (before stop) | Park the media at the tear-off edge. Gap stock. |
| Home | `1F 11 00` | 8, 9 | Continuous-stock counterpart of park, after the stop. |
| Post-raster position | `1F 12 20 00` / `1F 12 00 00` | 3 (gap only); 8, 9 | Gap / continuous. Without it the label stays under the head. |
| Feed (short) | `1B 4A nn` | 1, 4, 11 (`nn` = 70 after the raster); 2 (`nn` = 100, continuous stock) | `ESC J` — feed `nn` dots. |
| Feed (wide) | `1B 4A ll hh 00` | 3, 5, 8 | LE16 step plus a trailing NUL. A different command from the 3-byte form; sending one where the other is expected leaves argument bytes to be parsed as opcodes. |
| Page advance | `1D 0C` | 2 (gap stock); 5 (non-continuous) | Run the stock forward to the next gap. Not in the vocabulary of ids 3, 8, 9. |
| Raster | `1F 10 wH wL hH hL l3 l2 l1 l0` | all but 9 | Header: width in **bytes** and height in dots, big-endian 16; zlib payload length, big-endian 32. Payload follows. |
| Raster (raw) | `1D 76 30 00 wL wH hL hH` | 9 | Little-endian width in bytes and height; uncompressed rows follow with no length field. |

All multi-byte integers are big-endian in the `1F 10` header and
little-endian everywhere else.

## Raster block

```
1F 10  <widthBytes BE16>  <heightDots BE16>  <payloadLen BE32>
<payload: zlib, windowBits 10, level 6>
```

`widthBytes = ceil(widthPx / 8)`. The payload inflates to exactly
`widthBytes × heightDots` bytes of 1-bpp rows, `1 = dark`. The zlib
CMF byte is `0x28` — a 1 KiB window — and that is not a detail: the
S2 accepts a default-window stream (`0x78`) and discards the raster.
See [Two compressors](./#two-compressors).

Id 9 sends the same rows uncompressed behind a little-endian
`1D 76 30` header, which is the [L11](./l11) raster header.

## Job byte streams

One raster block per job. The order and presence of the other
elements is per id.

### Ids 1, 2, 4, 11 — simple

```
[density]              1F 70 01 dd          (id 4: 10 FF 10 00 dd)
[wakeup]               00 × 15              (ids 1, 11; none on 2, 4)
[enable]
[raster]               1F 10 … + zlib
[advance]              1B 4A 46             (ids 1, 4, 11: ESC J 70)
                       1D 0C                (id 2, gap stock)
                       1B 4A 64             (id 2, continuous, final copy only)
[stop]
```

A captured S2 job on 50 × 30 mm gap stock is, in order:
`1F 70 01 0A · 10 FF F1 02 · 1F 10 00 30 00 F0 … · <zlib> · 1D 0C ·
10 FF F1 45`. Without the `1D 0C` the S2 composes a valid job that
never advances, and the label stays under the head.

### Id 3 — positioned

```
[paper type]           1F 80 02 mm          (not on continuous)
[density]              1F 70 02 dd
[wakeup]               00 × 6
[enable]               1F C0 01 00
[pre-raster]           1F 11 51             (gap)  /  1B 4A 64 00 00  (continuous)
[raster]               1F 10 … + zlib
[post-raster]          1F 12 20 00          (gap only)
[feed]                 1B 4A 64 00 00       (continuous only — the feed is sent twice)
[stop]                 1F C0 01 01
[park]                 1F 11 50             (gap only, after the stop)
```

### Id 5 — positioned, with retract

```
[paper type]           1F 80 01 mm
[retract]              1F 11 51 00 00
[density gear]         10 FF 10 00 02
[density]              1F 70 01 dd
[wakeup]               00 × 6               (black-mark stock only)
[enable]               10 FF F1 03
[raster]               1F 10 … + zlib
[advance]              1D 0C                (gap)  /  1B 4A 3C 00 00  (continuous)
[park]                 1F 11 50
[stop]                 10 FF FE 45
```

### Ids 8 and 9 — positioned

```
[paper type]           1F 80 02 mm          (not on continuous)
[density]              1F 70 02 dd
[wakeup]               00 × 6               (id 8 only)
[enable]               1F C0 01 00
[pre-raster]           1F 11 51             (gap)
                       1B 4A 64 00 00       (id 8 continuous; id 9 sends nothing)
[raster]               1F 10 … + zlib       (id 8)  /  1D 76 30 … + raw rows  (id 9)
[post-raster]          1F 12 20 00          (gap)  /  1F 12 00 00  (continuous)
[stop]                 1F C0 01 01
[position]             1F 11 50             (gap)  /  1F 11 00  (continuous)
```

## Density

`print()` maps `'light' | 'normal' | 'dark'` onto a per-id scale;
`densityLevel` sends a value through directly, clamped on ids that
have a known window.

| id | light | normal | dark | clamp |
| --- | --- | --- | --- | --- |
| 1 | 12 | 13 | 14 | 12..14 |
| **2** | 3 | **10** | 14 | — |
| 3 | 3 | 10 | 14 | — |
| 8 | 3 | 8 | 14 | — |
| 9 | 2 | 8 | 15 | — (a 5-step scale; 5 and 11 are reachable through `densityLevel`) |
| 4, 5, 11 | 11 | 13 | 15 | — |

Id 2's `0A` for normal is what every captured S2 job carries.

## Media

`media.type` selects the paper kind the position and paper-type
commands are keyed on: `continuous` is continuous, everything else
(`die-cut`, gap, tape) is gap. The two black-mark sensor modes are
implemented in the builders but no catalogue media reaches them.

## Status

No status query is on any print path. The commands `1F 20 00`
(status), `1F 80 00` (paper type) and the `10 FF 20 Fx` family are
believed to be queries and `parseYxqStatus` decodes a reply shaped
`<opcode> <payload…>` structurally, but no such reply has ever been
captured. The one observed reply is a single `0xAA` after the S2
accepts a job.

## X2 red + black

The X2 chassis can print a second (red) plane; the registry records
it as `capabilities.redBlackDuplex: true`. The encoder emits the
black plane only, so a two-colour job prints in black rather than
failing.
