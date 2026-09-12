# Marklife wire protocols

Every chassis in the marklife catalogue binds to exactly one wire
protocol through `engines[].protocol`. Six tags exist; each has its
own page with the byte-level reference.

| `protocol` | Wire format | Chassis bound | Hardware status |
| --- | --- | --- | --- |
| [`marklife-l11`](./l11) | `10 FF` session frame, uncompressed `GS v 0` raster | 9 (P12, P15, P15R, A1, R15, LP15, LP90, LP25, BARABOGO P12) | **bench-confirmed** on the P12 and P15 over USB, SPP and BLE |
| [`marklife-yxq`](./yxq) | `1F`-prefixed command stream, zlib raster, per-id variants | 13 (S2, S8, P50, D210, X2 and their rebrands) | **bench-confirmed** on the S2 (protocol id 2) over SPP and BLE; other ids inferred |
| [`marklife-cpcl`](./cpcl) | CPCL text inside a `1F 80` envelope, zlib `ZG` raster | 1 (T3) | inferred, never driven |
| [`marklife-jbig`](./jbig) | ESC/POS-shaped framing, JBIG raster in a `1F ( J` wrapper | 5 (D100, X4, X8, U210, L100) | inferred; payload encoder not implemented |
| [`marklife-tspl`](./tspl) | TSC TSPL II, `BITMAP` mode 3 with a zlib payload | 0 | inferred, never driven |
| [`marklife-escpos`](./escpos) | Epson ESC/POS `GS v 0` raster subset | 0 | inferred, never driven |

::: info Provenance
The byte sequences on these pages come from our own on-the-wire
analysis — BLE HCI and USB captures, GATT probes of real units, job
dumps, and bench prints — plus published specifications where a
sub-engine follows one (Epson *ESC/POS*, TSC *TSPL II*, ITU-T T.82 for
JBIG, CPCL) and the public prior art at
[tomLadder/thermoprint](https://github.com/tomLadder/thermoprint) for
the L11 family.

Each page opens by stating which of its claims a real unit has
confirmed. Everything else is inference and is labelled as such; a
green test suite confirms only that the encoder is self-consistent.
:::

## Common ground

- **203 dpi, 1 bpp, direct thermal** across the whole catalogue.
- **Bit polarity `1 = dark`, MSB first, row-major, `ceil(width / 8)`
  bytes per row** on every sub-engine. This is the natural output of
  `renderImage` from `@mbtech-nl/bitmap`, so no encoder repacks or
  inverts the bitmap.
- **One job per `print()` call.** Copies are the caller's loop.
- **No status query is wired.** The only reply observed from any
  chassis is a single `0xAA` byte after it accepts a job (S2 and P12,
  2026-09-11). `getStatus()` reports link state only.

## Link layer

The wire bytes are transport-independent, but two link-level facts
apply to every sub-engine and are easy to lose:

**Packet size and pacing.** A chassis takes its job as a stream of
fixed-size packets with a pause between them. The S2 accepts a
176-byte BLE packet, acks it, and prints nothing; the same job in
95-byte packets prints. Firing a full window of packets back to back
loses raster the same way. The registry carries the packet ceiling
(`transports['bluetooth-gatt'].mtu`) and, where a chassis differs
from the family's 30 ms, the pause
(`engines[].capabilities.interChunkDelayMs`); the printer classes
apply both on every transport.

**BLE credit gate (Profile A).** On the `ff00` service the chassis
publishes flow control on a third characteristic, `ff03`:

```
02 lo hi    MTU announcement — payload per packet is MTU − 3
01 n        credit grant — n more packets may be written
```

The opening grant is `01 04`. Every packet costs one credit and the
chassis tops the window up as it drains. `MarklifeBleTransport` in
the web package implements the gate; the other GATT profiles a
chassis may host (Microchip transparent UART `49535343-…`, `fd00`,
`18f0`) carry no flow control. Which profile a unit exposes is
resolved by probing after connect — see the
[hardware page](../hardware#ble-profiles).

## Two compressors

Two sub-engines deflate their raster and they do **not** share
parameters:

| Path | Container | Window | Confirmed |
| --- | --- | --- | --- |
| `marklife-yxq` raster, `marklife-cpcl` `ZG` | zlib | **1 KiB** (`windowBits` 10, CMF byte `0x28`) | S2 bench print + captured S2 jobs |
| `marklife-tspl` `BITMAP` mode 3 | zlib | 32 KiB (default) | no |

The 1 KiB window is load-bearing: a decoder with a small inflate
window cannot read a stream written with a larger one, so a
default-window deflate is accepted by the S2 and silently discarded.
`yxqZlibCompress` in core produces the 1 KiB-window stream in both
runtimes.
