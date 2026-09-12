# Getting started

`marklife` is a TypeScript driver for the Marklife / Deli / FeiOou
AbleMark family of thermal label printers and their whitelabels. The
runtime ships in three packages:

| Package | When to use |
| --- | --- |
| `@thermal-label/marklife-core` | Encoders, device and media registries. No transport code. |
| `@thermal-label/marklife-node` | Node.js: `MarklifePrinter` over any `Transport`, plus `MarklifeDiscovery` for OS-paired Bluetooth SPP. |
| `@thermal-label/marklife-web` | Browser: `requestPrinters()` over Web Bluetooth, WebUSB and Web Serial, plus `WebMarklifePrinter`. |

## Install

```bash
pnpm add @thermal-label/marklife-node    # Node.js
pnpm add @thermal-label/marklife-web     # browser
```

## Hello label — browser

`requestPrinters` opens the browser picker for the transport you
name, identifies the chassis where the transport allows it, and
returns a map of printers keyed by engine role. Marklife chassis have
one engine, `primary`.

```ts
import { requestPrinters, MEDIA, DeviceIdentificationRequiredError } from '@thermal-label/marklife-web';

// From a click handler — every browser picker needs a user gesture.
let printers;
try {
  printers = await requestPrinters({ transport: 'bluetooth-gatt' });
} catch (err) {
  if (err instanceof DeviceIdentificationRequiredError) {
    // The advertised name matched nothing in the registry. Offer
    // err.candidates to the user and resume with their choice.
    printers = await err.continueWith('S2');
  } else {
    throw err;
  }
}

const printer = printers.primary!;
try {
  await printer.print(image, MEDIA.GAP_50X30);
} finally {
  await printer.close();
}
```

- **`'bluetooth-gatt'`** — the picker is filtered on the registry's
  name prefixes and the chassis is identified from its advertised
  name (`P12_ZA15B_BLE` → `P12`). The BLE profile is probed after
  connect; Profile A's credit gate is handled for you.
- **`'usb'`** — WebUSB; identified by vendor and product id. The P12
  and P15 expose USB.
- **`'serial'`** / **`'bluetooth-spp'`** — Web Serial carries no
  identity, so pass `deviceKey` up front or the call rejects with
  `DeviceIdentificationRequiredError` immediately.

```ts
const printers = await requestPrinters({ transport: 'bluetooth-spp', deviceKey: 'S8' });
```

## Hello label — Node.js

Pair the printer at the OS level; the SPP channel surfaces as a
serial port (`/dev/rfcomm0`, `/dev/tty.<Name>-SPPDev`, `COMx`).

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

`image` is `RawImageData` — RGBA pixels, typically from a `<canvas>`
or `@mbtech-nl/bitmap`'s `renderText`. The driver thresholds,
dithers and rotates it for the media you pass.

## Media is required

No marklife chassis reports what is loaded, so `print()` needs to be
told: it throws `MediaNotSpecifiedError` when called without a media
descriptor. Pick one from `MEDIA` or build your own — the family
takes any third-party stock, and a descriptor is just dimensions and
a type:

```ts
const myRoll = { id: 'gap-30x20', name: '30 × 20 mm', type: 'die-cut', widthMm: 30, heightMm: 20, targetModels: ['mobile-2in'] };
```

### The catalogue

`MEDIA` carries researched rolls grouped by head-size class
(`targetModels`):

| Class | Keys |
| --- | --- |
| `narrow-tape` (P12, P15 …) | `CONTINUOUS_15MM`, `GAP_12X40`, `GAP_14X40`, `GAP_15X30`, `GAP_15X50`, `CABLE_FLAG_12_5X109` |
| `mobile-2in` (S2, P50, X2 …) | `GAP_50X30`, `GAP_40X30`, `GAP_40X20`, `GAP_40X60`, `GAP_50X50`, `GAP_50X80`, `ROUND_40X40`, `CONTINUOUS_50MM` |
| `industrial-4in` (D210, X8 …) | `SHIPPING_100X150`, `GAP_100X100`, `GAP_70X50`, `GAP_60X40`, `CONTINUOUS_100MM` |

`findMediaByDimensions(width, height?)` looks a roll up by size. Add
entries to `packages/core/data/media.json5` and re-run
`pnpm --filter ./packages/core run compile-data`.

## Print options

`print(image, media, options)` accepts `MarklifePrintOptions`:

| Field | Values | Default |
| --- | --- | --- |
| `density` | `'light'` \| `'normal'` \| `'dark'` | `'normal'` — on L11 the chassis' stored density, since no command is sent unless asked |
| `densityLevel` | number | — ; wins over `density`, sent through on the chassis' own scale |
| `rotate` | `'auto'` \| `0` \| `90` \| `180` \| `270` | `'auto'` — rotates landscape input on media tagged `defaultOrientation: 'horizontal'`; no catalogue roll is, so the default prints the image as given |
| `copies` | number | `1` — only the TSPL path honours it; loop `print()` elsewhere |

## What is not implemented

- **The JBIG payload encoder** (D100, X4, X8, U210, L100). The
  wrapper bytes exist; `print()` throws `UnsupportedOperationError`.
- **Status.** `getStatus()` reports whether the link is open and
  nothing else — no chassis has a status query wired, and the only
  reply ever observed is a one-byte ack after a job.
- **Red + black on the X2.** Recorded on the registry entry, printed
  in black.
- **BLE on Node.** `MarklifeDiscovery.openBluetoothGatt` throws; hand
  `MarklifePrinter` a `Transport` from a BLE library of your choice.
