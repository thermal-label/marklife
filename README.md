# @thermal-label/marklife

> TypeScript driver for the **Marklife / Deli / FeiOou AbleMark**
> family of thermal label printers and their whitelabels (Silvertec,
> BARABOGO, CLABEL, iSPACE, Jammuk, ewtto, M50 / M57 / M60 / U210 /
> L100) — over USB, Bluetooth SPP and BLE, from Node.js or the browser.

[![CI](https://github.com/thermal-label/marklife/actions/workflows/ci.yml/badge.svg)](https://github.com/thermal-label/marklife/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/thermal-label/marklife/branch/main/graph/badge.svg)](https://codecov.io/gh/thermal-label/marklife)
[![npm core](https://img.shields.io/npm/v/@thermal-label/marklife-core.svg?label=core)](https://npmjs.com/package/@thermal-label/marklife-core)
[![npm node](https://img.shields.io/npm/v/@thermal-label/marklife-node.svg?label=node)](https://npmjs.com/package/@thermal-label/marklife-node)
[![npm web](https://img.shields.io/npm/v/@thermal-label/marklife-web.svg?label=web)](https://npmjs.com/package/@thermal-label/marklife-web)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Six wire protocols share the catalogue; every registry entry binds
to one:

- **L11** (`marklife-l11`) — the narrow-tape P12 / P15 family. `10 FF` session frame, uncompressed raster. **Bench-confirmed.**
- **YXQ** (`marklife-yxq`) — S2, S8, P50, D210, X2. `1F`-prefixed commands, zlib raster with a 1 KiB window, per-id job shapes. **Bench-confirmed on the S2.**
- **CPCL** (`marklife-cpcl`) — T3. A CPCL page inside a binary envelope. Inferred.
- **JBIG** (`marklife-jbig`) — D100, X4, X8. ESC/POS-shaped framing around a JBIG raster; the payload encoder is not implemented.
- **TSPL** and **ESC/POS** — encoders retained, no chassis bound.

The driver is transport-unaware: bring any `Transport` from
[`@thermal-label/transport`](https://github.com/thermal-label/transport)
and the printer classes chunk and pace the job the way the firmware
needs.

## Install

```bash
pnpm add @thermal-label/marklife-node    # Node.js
pnpm add @thermal-label/marklife-web     # browser
```

## Quick example (browser)

```ts
import { requestPrinters, MEDIA } from '@thermal-label/marklife-web';

// From a click handler. BLE: the picker lists every registry name
// prefix and the chassis is identified from its advertised name.
const printers = await requestPrinters({ transport: 'bluetooth-gatt' });
const printer = printers.primary!;
try {
  await printer.print(image, MEDIA.GAP_50X30);
} finally {
  await printer.close();
}
```

`transport` may also be `'usb'` (P12, P15) or `'serial'` /
`'bluetooth-spp'` with a `deviceKey`.

## Quick example (Node.js)

Pair the printer at the OS level; the SPP channel surfaces as a
serial port (`/dev/rfcomm0`, `/dev/tty.<Name>-SPPDev`, `COMx`):

```ts
import { MarklifeDiscovery, MEDIA } from '@thermal-label/marklife-node';

const printer = await new MarklifeDiscovery().openBluetoothSpp({
  serialPath: '/dev/rfcomm0',
  deviceKey: 'S8',
});
try {
  await printer.print(image, MEDIA.GAP_50X30);
} finally {
  await printer.close();
}
```

No chassis reports its media, so `print()` needs a media descriptor
and throws `MediaNotSpecifiedError` without one.

## Supported hardware

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

## Documentation

Full docs at **<https://thermal-label.github.io/marklife/>**.

- [Getting started](https://thermal-label.github.io/marklife/getting-started)
- [Hardware](https://thermal-label.github.io/marklife/hardware) — transports, BLE profiles, packet pacing, whitelabel map
- [Wire protocols](https://thermal-label.github.io/marklife/protocol/) — [L11](https://thermal-label.github.io/marklife/protocol/l11) · [YXQ](https://thermal-label.github.io/marklife/protocol/yxq) · [CPCL](https://thermal-label.github.io/marklife/protocol/cpcl) · [JBIG](https://thermal-label.github.io/marklife/protocol/jbig) · [TSPL](https://thermal-label.github.io/marklife/protocol/tspl) · [ESC/POS](https://thermal-label.github.io/marklife/protocol/escpos)
- [Node.js guide](https://thermal-label.github.io/marklife/node) · [Web guide](https://thermal-label.github.io/marklife/web) · [Core API](https://thermal-label.github.io/marklife/core)
- [Verification checklist](https://thermal-label.github.io/marklife/verification-checklist) · [Harness](https://thermal-label.github.io/harness/marklife/)
- [API reference](https://thermal-label.github.io/marklife/api/)

## License

MIT — see [`LICENSE`](LICENSE).
