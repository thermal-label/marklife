# Web guide

`@thermal-label/marklife-web` exposes:

- **`requestPrinters(opts)`** — the browser picker for one transport,
  returning a `PrinterAdapterMap`. This is the entry point.
- **`WebMarklifePrinter`** — the `PrinterAdapter`; construct it
  yourself when you already hold a `Transport`.
- **`MarklifeBleTransport`**, **`resolveProfile`**,
  **`MARKLIFE_BLE_PROFILES`**, **`OPTIONAL_SERVICES`** — the BLE
  pieces, for hosts that drive `navigator.bluetooth` themselves.
- **`devicesForTransport(type)`** — the registry entries that declare
  a transport; what `DeviceIdentificationRequiredError.candidates`
  is built from.
- `requestPrinterSerial` / `fromSerialPort` — deprecated
  single-transport factories, kept for one release.

## `requestPrinters`

```ts
import { requestPrinters } from '@thermal-label/marklife-web';

const printers = await requestPrinters({ transport: 'bluetooth-gatt' });
const printer = printers.primary!;
```

| `transport` | Picker | Identification |
| --- | --- | --- |
| `'bluetooth-gatt'` | Web Bluetooth, filtered on every registry name prefix | From the advertised name by longest-prefix match: `P12_ZA15B_BLE` → `P12`. Unmatched → `DeviceIdentificationRequiredError`. |
| `'usb'` | WebUSB, filtered on the registry's vendor/product ids | From the vendor/product id. Unmatched → `DeviceIdentificationRequiredError`. |
| `'serial'`, `'bluetooth-spp'` | Web Serial (any port the page may see) | None available; `deviceKey` is required and the call rejects without it. |

An explicit `deviceKey` always wins over identification.

`DeviceIdentificationRequiredError` carries `candidates` (the
entries that declare the transport) and `continueWith(key)`, which
resumes with the already-picked device so the browser picker does
not open twice.

### BLE

The chassis advertise a vendor UUID rather than the service they
host, and a single unit can host several GATT profiles. After the
picker, `requestPrinters` connects, probes the four known profiles
in preference order and opens `MarklifeBleTransport` on the first
that resolves. Profile A's credit gate on `ff03` is honoured
automatically; see the [hardware page](./hardware#ble-profiles) for
the profile table and the [protocol index](./protocol/#link-layer)
for the gate.

Chrome, Edge and Opera on desktop and Android; not Firefox or
Safari.

### USB

The P12 and P15 enumerate as USB Printer-class devices. WebUSB needs
the OS to leave the interface unclaimed — on Linux, a udev rule
granting access (`MODE="0666"`, `TAG+="uaccess"`) plus `usblp`
unbound from the interface (an `ACTION=="bind", DRIVER=="usblp"`
unbind rule keyed on the VID); on Windows, a WinUSB driver.

### Serial

Web Serial lists every paired Bluetooth SPP device and every
USB-serial bridge the page is permitted to see, and tells you
nothing about which is which. Pass `deviceKey`. Pairing notes —
PINs, the RFCOMM bind on Linux — are in the
[Node guide](./node#bluetooth-spp); the port it produces is what the
picker lists.

Chrome, Edge and Opera on desktop only.

## `WebMarklifePrinter`

```ts
class WebMarklifePrinter implements PrinterAdapter {
  constructor(device: DeviceEntry, transport: Transport, options?: WebMarklifePrinterOptions);
  readonly family: 'marklife';
  readonly device: DeviceEntry;
  get model(): string;
  get connected(): boolean;
  print(image: RawImageData, media?: MediaDescriptor, options?: MarklifePrintOptions): Promise<void>;
  createPreview(image: RawImageData, options?: PreviewOptions): Promise<PreviewResult>;
  getStatus(): Promise<MarklifeStatus>;
  onStatus(cb: (status: PrinterStatus) => void): () => void;
  close(): Promise<void>;
}

interface WebMarklifePrinterOptions {
  threshold?: number;          // dither threshold, 0..255; per-engine default
  interChunkDelayMs?: number;  // pause between packets; registry default
}
```

- `print()` encodes the job for the entry's engine and feeds it to
  the transport in registry-sized packets with a pause between them
  (the [pacing](./hardware#packet-size-and-pacing) every chassis
  needs). It throws `MediaNotSpecifiedError` without a media
  descriptor.
- `getStatus()` reports link state only; no chassis has a status
  query wired. `onStatus()` polls it.
- `print()` and `getStatus()` are serialised against each other, so a
  status poll during a print waits for the job to finish.

## Bringing your own transport

`WebMarklifePrinter` takes any `Transport`. To skip the picker
logic — a WebUSB device you already hold, say:

```ts
import { WebUsbTransport } from '@thermal-label/transport/web';
import { DEVICES } from '@thermal-label/marklife-core';
import { WebMarklifePrinter } from '@thermal-label/marklife-web';

const transport = await WebUsbTransport.fromDevice(usbDevice);
const printer = new WebMarklifePrinter(DEVICES.P12, transport);
```
