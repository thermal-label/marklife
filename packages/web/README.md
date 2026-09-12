# @thermal-label/marklife-web

Browser driver for the Marklife / Deli / FeiOou AbleMark family of
thermal label printers and their whitelabels: **Web Bluetooth** with
the family's credit-gated BLE profile, **WebUSB** for the P12 and
P15, and **Web Serial** for OS-paired Bluetooth SPP.

## Install

```bash
pnpm add @thermal-label/marklife-web
```

## Quick start

```ts
import { requestPrinters, MEDIA } from '@thermal-label/marklife-web';

// From a click handler — every browser picker needs a user gesture.
const printers = await requestPrinters({ transport: 'bluetooth-gatt' });
const printer = printers.primary!;
try {
  await printer.print(image, MEDIA.GAP_50X30);
} finally {
  await printer.close();
}
```

`transport` may also be `'usb'`, or `'serial'` / `'bluetooth-spp'`
with a `deviceKey`. BLE and USB identify the chassis themselves;
when the advertised name matches nothing, the call rejects with
`DeviceIdentificationRequiredError` and `continueWith(key)` resumes
with the user's choice.

`print()` needs a media descriptor — no chassis reports its media —
and feeds the job in registry-sized packets with the pause the
firmware needs.

## Browser support

Chrome, Edge and Opera. Web Bluetooth on desktop and Android; WebUSB
and Web Serial on desktop. Not Firefox or Safari.

## Documentation

- [Web guide](https://thermal-label.github.io/marklife/web)
- [Getting started](https://thermal-label.github.io/marklife/getting-started)
- [Hardware](https://thermal-label.github.io/marklife/hardware)

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

## License

MIT
