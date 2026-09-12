# Hardware support

Per-device support for `@thermal-label/marklife-*`. The device table
is generated from the registry (`pnpm docs:hardware`); the rest of
the page is hand-authored. For the byte streams, see the
[protocol pages](./protocol/).

## Sub-engines

Every registry entry binds to exactly one wire protocol through
`engines[].protocol`:

| `protocol` | Wire format | Chassis | Hardware status |
| --- | --- | --- | --- |
| [`marklife-l11`](./protocol/l11) | `10 FF` session frame, uncompressed `GS v 0` raster | P12, P15, P15R, A1, R15, LP15, LP90, LP25, BARABOGO P12 | **bench-confirmed** — P12 and P15 print over USB, SPP and BLE |
| [`marklife-yxq`](./protocol/yxq) | `1F`-prefixed commands, zlib raster, per-id job shapes | S2, S8, P50, D210, X2, X2 BLE and rebrands | **bench-confirmed** on the S2 (id 2) over SPP and BLE; ids 1, 3, 5, 8, 9 inferred |
| [`marklife-cpcl`](./protocol/cpcl) | CPCL page in a `1F 80` envelope | T3 | inferred, never driven |
| [`marklife-jbig`](./protocol/jbig) | ESC/POS-shaped framing, JBIG raster | D100, X4, X8, U210, L100 | payload encoder not implemented — `unsupported` |
| [`marklife-tspl`](./protocol/tspl) | TSPL II, zlib `BITMAP` mode 3 | — | encoder retained, no chassis |
| [`marklife-escpos`](./protocol/escpos) | ESC/POS `GS v 0` subset | — | encoder retained, no chassis |

## Transports

| Transport | Chassis | Notes |
| --- | --- | --- |
| Bluetooth Classic SPP | every registered chassis except the X2 BLE entry | Standard SPP channel 1; pair at the OS, open the RFCOMM port as a serial device. Web Serial in the browser, `SerialTransport` on Node. Pairing PIN: `1234` on the P12 and P15, none on the S2. |
| BLE GATT | every registered chassis | The advertised name is the SPP name plus `_BLE`. The chassis advertise a vendor UUID, not the service they host; the profile is resolved by probing after connect (below). |
| USB | P12 (`09c7:0011`), P15 (`5958:0015`) | USB Printer-class, bulk endpoint; prints the same byte stream — both bench-confirmed. The S2's USB port is charge-only. Other chassis unaudited. |
| TCP | — | No chassis exposes one. |

### Packet size and pacing

Every chassis takes its job as fixed-size packets with a pause
between them, on every transport. The S2 accepts a 176-byte BLE
packet and prints nothing; 95-byte packets print. The registry
declares the ceiling on `transports['bluetooth-gatt'].mtu` (95 on
the S2 and its siblings, 90 on the P12; 237 where an entry declares
none) and, where a chassis drains faster
than the family's 30 ms, `engines[].capabilities.interChunkDelayMs`
(1 ms on the X2 family). Both printer classes apply them.

### BLE profiles

A GATT probe of the P12 (2026-09-10) found it hosting Profile A, the
Microchip transparent UART and the generic printer service at once,
so the profile is not a per-model fact. `marklife-web` probes in this
order and uses the first whose TX and RX characteristics resolve:

| Profile | Service | TX / RX | Flow control |
| --- | --- | --- | --- |
| **A** | `0000ff00-…` | `ff02` / `ff01` | credit gate on `ff03` — see [Link layer](./protocol/#link-layer) |
| **B** — Microchip transparent UART | `49535343-fe7d-4ae5-8fa9-9fafd205e455` | `…-8841-43f4-…` / `…-1e4d-4bd9-…` | none |
| **C** | `0000fd00-…` | `fd01` / `fd02` | none |
| **D** — generic printer service | `000018f0-…` | `2af1` / `2af0` | none |

The advertisement carries `e7810a71-73ae-499d-8c15-faa9aef0c3f2`
and nothing else, so a Web Bluetooth picker filtered on a service
UUID matches no chassis; `requestPrinters` filters on the registry's
name prefixes and lists every profile in `optionalServices`.

## Hardware families

The vendor sells the same chassis under many names. The registry key
`<NAME>_BY_<BASE>` records a whitelabel of a base chassis; the
families below group the registered keys by the hardware behind them.

| Family | Head | Protocol | Registered keys |
| --- | --- | --- | --- |
| P12 — narrow tape | 96 dots (12 mm) | L11 | `P12`, `BARABOGOP12`, `LP25_BY_P12` |
| P15 — narrow tape | 96 dots, assumed from the P12 | L11 | `P15`, `P15R`, `A1`, `LP15` |
| R15, LP90 — narrow tape | unknown (registry carries a class guess) | L11 | `R15`, `LP90` |
| S2 — 2" mobile | 384 dots | YXQ id 2 | `S2`, `JAMMUK_S2`, `ETZ0535`, `M50_BY_S2` |
| P50 — 2" mobile | 384 dots, assumed | YXQ id 3 | `P50`, `M57_BY_P50`, `T2`, `LPW40` |
| X2 — 2" mobile | 384 dots, assumed | YXQ id 9 (SPP), id 8 (BLE) | `X2`, `X2_BLE`, `M60_BY_X2` |
| S8 | 384 dots, assumed | YXQ id 1 | `S8` |
| D210 — 4" desktop | 832 dots, assumed | YXQ id 5 | `D210` |
| X8 / U210 — 4" desktop | unknown | JBIG id 10 (no encoder) | `X8`, `U210_BY_D210` |
| D100 | unknown | JBIG id 12 | `D100` |
| X4 / L100 | unknown | JBIG id 7 | `X4`, `L100_BY_X4` |
| T3 | 576 dots, assumed | CPCL | `T3` |

Not registered but named by [thermoprint](https://github.com/tomLadder/thermoprint)'s
device table: the P80 family (CPCL), LuckP D1, HM-24-28, A31, P7,
P11, P1s. A unit whose name starts with a registered prefix resolves
to that entry; anything else is offered the list.

Only the P12 head width is measured (a BLE HCI capture carries
12-byte rows) and only the S2's is confirmed by a print (48-byte
rows in every captured job). The other widths are the size class's
usual value and carry a `TODO` in the registry; the D210 and X8 may
well be 210 mm heads rather than 4", which the taxonomy cannot yet
express.

## Device support table

Generated by `pnpm docs:hardware` from the registry. `verified` is a
maintainer or community print on that chassis; `expected` is lifted
from a verified sibling on the same protocol and has not itself been
driven — for `marklife-yxq` that lift crosses protocol ids, so an
`expected` D210 or X2 rests on the S2 alone.

<!-- HARDWARE_TABLE:START -->
**28 devices** — 3 verified · 0 partial · 19 expected · 5 unsupported · 1 unverified

| Model | Key | Protocol | Transports | Status |
| --- | --- | --- | --- | --- |
| [A1](https://thermal-label.github.io/hardware/marklife/a1) | `A1` | L11 | BT SPP, BT LE | 🔄 expected |
| [BARABOGOP12](https://thermal-label.github.io/hardware/marklife/barabogop12) | `BARABOGOP12` | L11 | BT SPP, BT LE | 🔄 expected |
| [D100](https://thermal-label.github.io/hardware/marklife/d100) | `D100` | JBIG | BT SPP, BT LE | ❌ unsupported |
| [D210](https://thermal-label.github.io/hardware/marklife/d210) | `D210` | YXQ | BT SPP, BT LE | 🔄 expected |
| [ewtto ET-Z0535](https://thermal-label.github.io/hardware/marklife/etz0535) | `ETZ0535` | YXQ | BT SPP, BT LE | 🔄 expected |
| [Jammuk S2](https://thermal-label.github.io/hardware/marklife/jammuk-s2) | `JAMMUK_S2` | YXQ | BT SPP, BT LE | 🔄 expected |
| [L100](https://thermal-label.github.io/hardware/marklife/l100-by-x4) | `L100_BY_X4` | JBIG | BT SPP, BT LE | ❌ unsupported |
| [LP15](https://thermal-label.github.io/hardware/marklife/lp15) | `LP15` | L11 | BT SPP, BT LE | 🔄 expected |
| [LP25](https://thermal-label.github.io/hardware/marklife/lp25-by-p12) | `LP25_BY_P12` | L11 | BT SPP, BT LE | 🔄 expected |
| [LP90](https://thermal-label.github.io/hardware/marklife/lp90) | `LP90` | L11 | BT SPP, BT LE | 🔄 expected |
| [LPW40](https://thermal-label.github.io/hardware/marklife/lpw40) | `LPW40` | YXQ | BT SPP, BT LE | 🔄 expected |
| [M50](https://thermal-label.github.io/hardware/marklife/m50-by-s2) | `M50_BY_S2` | YXQ | BT SPP, BT LE | 🔄 expected |
| [M57](https://thermal-label.github.io/hardware/marklife/m57-by-p50) | `M57_BY_P50` | YXQ | BT SPP, BT LE | 🔄 expected |
| [M60](https://thermal-label.github.io/hardware/marklife/m60-by-x2) | `M60_BY_X2` | YXQ | BT SPP, BT LE | 🔄 expected |
| [P12](https://thermal-label.github.io/hardware/marklife/p12) | `P12` | L11 | USB, BT SPP, BT LE | ✅ verified |
| [P15](https://thermal-label.github.io/hardware/marklife/p15) | `P15` | L11 | USB, BT SPP, BT LE | ✅ verified |
| [P15R](https://thermal-label.github.io/hardware/marklife/p15r) | `P15R` | L11 | BT SPP, BT LE | 🔄 expected |
| [P50](https://thermal-label.github.io/hardware/marklife/p50) | `P50` | YXQ | BT SPP, BT LE | 🔄 expected |
| [R15](https://thermal-label.github.io/hardware/marklife/r15) | `R15` | L11 | BT SPP, BT LE | 🔄 expected |
| [S2](https://thermal-label.github.io/hardware/marklife/s2) | `S2` | YXQ | BT SPP, BT LE | ✅ verified |
| [S8](https://thermal-label.github.io/hardware/marklife/s8) | `S8` | YXQ | BT SPP, BT LE | 🔄 expected |
| [T2](https://thermal-label.github.io/hardware/marklife/t2) | `T2` | YXQ | BT SPP, BT LE | 🔄 expected |
| [T3](https://thermal-label.github.io/hardware/marklife/t3) | `T3` | CPCL | BT SPP, BT LE | ⏳ unverified |
| [U210](https://thermal-label.github.io/hardware/marklife/u210-by-d210) | `U210_BY_D210` | JBIG | BT SPP, BT LE | ❌ unsupported |
| [X2](https://thermal-label.github.io/hardware/marklife/x2) | `X2` | YXQ | BT SPP, BT LE | 🔄 expected |
| [X2 (BLE)](https://thermal-label.github.io/hardware/marklife/x2-ble) | `X2_BLE` | YXQ | BT LE | 🔄 expected |
| [X4](https://thermal-label.github.io/hardware/marklife/x4) | `X4` | JBIG | BT SPP, BT LE | ❌ unsupported |
| [X8](https://thermal-label.github.io/hardware/marklife/x8) | `X8` | JBIG | BT SPP, BT LE | ❌ unsupported |

Click any model to open its detail page on the docs site, where engines, supported media, and verification reports live. The same data backs the [interactive cross-driver table](https://thermal-label.github.io/hardware/).
<!-- HARDWARE_TABLE:END -->

## Verification

Hardware verification runs through the
[harness app](https://thermal-label.github.io/harness/marklife/):
pair a chassis in the browser, print the diagnostic, submit the
report. See the [verification checklist](./verification-checklist).
