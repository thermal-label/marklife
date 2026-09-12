# Interoperability statement

This project documents the wire protocols of the Deli / FeiOou
"AbleMark" / "YXQ" family of thermal label printers — and the
whitelabel rebrands shipped on the same hardware (M50, M57, M60,
U210, L100, S15, S12) — and provides a TypeScript driver that
produces those bytes.

## Scope

The driver targets **interoperability with the printers**, not with
any mobile app that ships alongside them. The protocol pages under
[`docs/protocol/`](./docs/protocol/) describe:

- The **L11 stream** the narrow-tape chassis accept — a `10 FF`
  session frame around an uncompressed `GS v 0` raster.
- The **YXQ command stream** the 2" and 4" chassis accept over
  Bluetooth SPP and BLE. Commands carry a `0x1F` prefix; the raster
  is a `1F 10 …` header followed by a zlib payload deflated with a
  1 KiB window. Per-model variations are selected by a protocol id.
- The **CPCL page** the T3 accepts, inside a `1F 80` envelope with a
  zlib `ZG` raster.
- The **JBIG-in-ESC/POS-shaped** stream the D100 / X4 / X8 chassis
  accept: `GS L` / `GS W` / `ESC a` framing, then JBIG-compressed
  image data in a vendor `1F ( J` opcode. The Epson-spec subset
  lives in
  [`@thermal-label/escpos-core`](https://www.npmjs.com/package/@thermal-label/escpos-core);
  this driver adds the wrapper.
- A **TSPL II** job with a zlib `BITMAP` mode 3, and an **ESC/POS**
  `GS v 0` raster subset. The spec-aligned encoders live in
  [`@thermal-label/tspl-core`](https://www.npmjs.com/package/@thermal-label/tspl-core)
  and `escpos-core`; no chassis currently binds to either.

## Sources

The byte-level claims on the protocol pages are anchored on, in order
of weight:

- **Our own measurements of the hardware.** BLE and USB captures,
  GATT service probes of real units, captured job byte streams, and
  bench prints. Where a page marks a fact *bench-confirmed*, this is
  what confirms it. This is the strongest evidence in the project and
  the only kind that has ever corrected an error.
- **Published specifications**, where a sub-engine follows one: TSC's
  *TSPL II Programming Manual*, Epson's *ESC/POS Application
  Programming Guide*, the CPCL programming manual, and ITU-T Rec.
  T.82 (JBIG).
- **Public prior art**, notably
  [tomLadder/thermoprint](https://github.com/tomLadder/thermoprint),
  which independently documents the L11 family.

Claims that no unit has yet confirmed are marked as inference on the
protocol pages and stay marked until one does.

The driver does **not** redistribute the printers' firmware, any
mobile app, or any vendor binary. It contains no keys, credentials,
or circumvention of technological protection measures.

## Legal posture

Documenting and re-implementing a wire protocol for the purpose of
interoperability is recognised as a legitimate use:

- **United States**: under *Sega Enterprises v. Accolade*
  (9th Cir. 1992) and *Sony Computer Entertainment v. Connectix*
  (9th Cir. 2000), intermediate copying for the purpose of
  understanding an unprotectable interface and producing an
  interoperable program is fair use.
- **European Union**: Directive 2009/24/EC (Software Directive),
  Article 6, expressly authorises the steps necessary to obtain the
  information required to achieve interoperability of an
  independently-created program. The interface specifications so
  obtained may be used for that purpose without further
  authorisation from the rightsholder.
- The wire-format facts themselves — the byte sequences a printer
  consumes, the codes it returns — are interoperability information,
  not copyrightable expression.

No vendor source code is reproduced in this repository, and none of
its structure, naming or organisation is carried into this driver's
design.

## What this project is not

- It is not a replacement for or a port of the Deli / FeiOou /
  AbleMark mobile apps.
- It is not a redistribution of any vendor's firmware, driver
  binary, or proprietary source code.
- It does not bypass technical protection measures.
- It is not affiliated with, endorsed by, or sponsored by Deli,
  FeiOou, AbleMark, Silvertec, BARABOGO, CLABEL, iSPACE, Jammuk,
  ewtto, or any other rightsholder named in the supported-device
  list. Trademarks are used only to identify supported hardware.

## Reporting concerns

If you are a rightsholder and believe a specific passage in these
docs goes beyond interoperability documentation into protected
expression, please open an issue at
<https://github.com/thermal-label/marklife/issues> and we will
re-examine the passage in question.
