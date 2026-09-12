# marklife — Hardware reference

The consumer-facing hardware page is
[`docs/hardware.md`](./docs/hardware.md); the generated device table
lives there and in the README. This file holds the facts a maintainer
reaches for when a new unit arrives.

## Family in one paragraph

203 dpi, 1 bpp, direct thermal, everywhere. Six wire protocols share
the catalogue (`engines[].protocol`); the chassis speak Bluetooth
Classic SPP and BLE, and the P12 and P15 also USB Printer-class. No
TCP. Twenty-eight registry entries cover roughly fifty name strings
through the `<NAME>_BY_<BASE>` whitelabel convention.

## What a real unit has confirmed

| Unit | Protocol | Transports printed | Date |
| --- | --- | --- | --- |
| P12 | `marklife-l11` | USB, SPP, BLE | via harness 2026-09-13 |
| P15 | `marklife-l11` | USB, SPP, BLE | via harness 2026-09-13 |
| S2 | `marklife-yxq` id 2 | SPP, BLE | via harness 2026-09-13; USB port is charge-only |

Everything else in the registry is inference. The
[protocol pages](./docs/protocol/index.md) say per protocol — and for
YXQ per protocol id — what that inference rests on.

## Link facts that cost bench time

- **Packet ceiling.** The S2 accepts 95-byte BLE packets and silently
  drops 176-byte ones, MTU negotiation notwithstanding. Registry:
  `transports['bluetooth-gatt'].mtu`.
- **Pacing.** 30 ms between packets family-wide; the X2 drains at
  1 ms. Registry: `engines[].capabilities.interChunkDelayMs`. Credits
  report buffer space, not link drain, so a full credit window fired
  back to back still loses raster.
- **Profile A credit gate** on `ff03`: `02 lo hi` MTU announce,
  `01 n` grant, opening grant `01 04`. Whether the gate is
  load-bearing on its own — every successful print so far had both
  the gate and the pacing — is untested.
- **Deflate window.** YXQ and CPCL rasters must be deflated with
  `windowBits: 10`. A default-window stream is accepted and
  discarded.
- **Advertising.** The chassis advertise
  `e7810a71-73ae-499d-8c15-faa9aef0c3f2`, not the service they host,
  and one unit hosts several profiles. Filter the picker on the name,
  probe the profile after connect.
- **Names.** BLE name = SPP name + `_BLE`. The Classic address is
  not the LE one (the chassis advertise a random LE address).
- **Classic pairing PIN.** `1234` on the P12 and P15; the S2 pairs
  without one. SPP is channel 1.
- **Classic and LE do not coexist well on Linux.** With BR/EDR
  enabled BlueZ prefers it for these dual-mode chassis and
  `gatt.connect()` fails (`br-connection-profile-unavailable`); the
  bench toggles `btmgmt bredr off` for BLE work and back on for SPP.

## BLE profiles

| Profile | Service | TX / RX | Flow control | Seen on |
| --- | --- | --- | --- | --- |
| A | `0000ff00-…` | `ff02` / `ff01` | credit gate on `ff03` | P12, P15, S2 |
| B — Microchip transparent UART | `49535343-fe7d-4ae5-8fa9-9fafd205e455` | `…-8841-43f4-…` / `…-1e4d-4bd9-…` | none | P12 (hosted alongside A) |
| C | `0000fd00-…` | `fd01` / `fd02` | none | declared on the X2 BLE entry; not probed |
| D — generic printer service | `000018f0-…` | `2af1` / `2af0` | none | P12 (hosted), S2 (advertised) |

## USB

| Unit | VID:PID | Class | Status |
| --- | --- | --- | --- |
| P12 | `09c7:0011` | Printer, bulk OUT `0x01` | prints |
| P15 | `5958:0015` | Printer | prints |
| S2 | — | — | charge-only port, nothing enumerates |

On Linux the device node needs a udev rule (`MODE="0666"`, `TAG+="uaccess"`)
and `usblp` must be unbound from the interface before WebUSB can
claim it; an `ACTION=="bind", DRIVER=="usblp"` unbind rule per VID
does both, as the Brother and Dymo rules do.

## Whitelabels

| Registry key | Base chassis | Protocol |
| --- | --- | --- |
| `M50_BY_S2` | S2 (id 2) | `marklife-yxq` |
| `M57_BY_P50` | P50 (id 3) | `marklife-yxq` |
| `M60_BY_X2` | X2 (id 9) | `marklife-yxq` |
| `U210_BY_D210` | X8 (id 10) — despite the name | `marklife-jbig` |
| `L100_BY_X4` | X4 (id 7) | `marklife-jbig` |
| `LP25_BY_P12`, `BARABOGOP12` | P12 | `marklife-l11` |

Not registered but named by thermoprint's device table (§ 5): the
P80 family (CPCL), LuckP D1, HM-24-28, A31, P7, P11, P1s.

## Open questions

- Head widths outside the P12 and S2 are the size class's usual
  value. The D210, U210 and X8 may be 210 mm heads; the X4, D100 and
  L100 sell 100 mm stock that a 384-dot head cannot print. The
  taxonomy has no A4 class.
- The P15 family's `10 FF 10 00 tt` density form is unimplemented.
- Protocol id 10 (X8, U210) has no encoder at all.
- `CONTINUOUS_50MM` and `CONTINUOUS_100MM` have no purchasable stock
  behind them.
