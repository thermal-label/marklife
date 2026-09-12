# Node.js guide

`@thermal-label/marklife-node` exposes:

- **`MarklifePrinter`** — the `PrinterAdapter`, over any `Transport`
  from `@thermal-label/transport/node`.
- **`MarklifeDiscovery`** — opens an OS-paired Bluetooth SPP port by
  `deviceKey`.
- **`discovery`** — the default `MarklifeDiscovery`, exported for
  `thermal-label-cli`'s driver auto-detection.

## Bluetooth SPP

Every chassis but the X2 BLE entry speaks Classic Bluetooth SPP.
Pair at the OS and the channel surfaces as a serial port; RFCOMM
carries no identity, so `deviceKey` is required.

```ts
import { MarklifeDiscovery, MEDIA } from '@thermal-label/marklife-node';

const printer = await new MarklifeDiscovery().openBluetoothSpp({
  serialPath: '/dev/rfcomm0',
  deviceKey: 'S8',
});
await printer.print(image, MEDIA.GAP_50X30);
await printer.close();
```

**Linux**

```bash
bluetoothctl
> scan bredr
> pair AA:BB:CC:DD:EE:FF                 # PIN 1234 on the P12 / P15; the S2 asks for none
> trust AA:BB:CC:DD:EE:FF
> exit
sudo rfcomm bind 0 AA:BB:CC:DD:EE:FF 1    # channel 1 is the SPP channel
```

The Classic address is not the BLE one: these chassis advertise a
random LE address, so take the MAC from a `bredr` scan, where the
name appears without the `_BLE` suffix.

**macOS** — after pairing in System Settings → Bluetooth the port is
`/dev/tty.<Name>-SPPDev`.

**Windows** — pair in Settings → Bluetooth & devices; the outgoing
COM port appears under Device Manager → Ports.

## USB

The P12 (`09c7:0011`) and P15 (`5958:0015`) are USB Printer-class
devices and print the same byte stream. `MarklifeDiscovery` does not
open USB; construct the printer over `UsbTransport`:

```ts
import { UsbTransport } from '@thermal-label/transport/node';
import { DEVICES } from '@thermal-label/marklife-core';
import { MarklifePrinter, MEDIA } from '@thermal-label/marklife-node';

const transport = await UsbTransport.open(0x09c7, 0x0011);
const printer = new MarklifePrinter(DEVICES.P12, transport, 'usb');
await printer.print(image, MEDIA.CONTINUOUS_15MM);
```

`@thermal-label/transport` declares `usb` as an optional peer; install
it in the application that opens USB.

## BLE

`MarklifeDiscovery.openBluetoothGatt` throws — no Node BLE backend is
wired. Build a `Transport` over the BLE library of your choice and
pass it to `new MarklifePrinter(entry, transport, 'bluetooth-gatt')`.
On Profile A the chassis gates writes on credits published on
`ff03`; see the [protocol index](./protocol/#link-layer). The web
package's `MarklifeBleTransport` is the reference implementation.

## `MarklifePrinter`

```ts
class MarklifePrinter implements PrinterAdapter {
  constructor(device: DeviceEntry, transport: Transport, transportType: TransportType, options?: MarklifePrinterOptions);
  readonly family: 'marklife';
  readonly device: DeviceEntry;
  readonly transportType: TransportType;
  get model(): string;
  get connected(): boolean;
  print(image: RawImageData, media?: MediaDescriptor, options?: MarklifePrintOptions): Promise<void>;
  createPreview(image: RawImageData, options?: PreviewOptions): Promise<PreviewResult>;
  getStatus(): Promise<MarklifeStatus>;
  close(): Promise<void>;
}

interface MarklifePrinterOptions {
  threshold?: number;          // dither threshold, 0..255; per-engine default
  interChunkDelayMs?: number;  // pause between packets; registry default
}
```

- `print()` encodes the job for the entry's engine and feeds it to
  the transport in registry-sized packets with a pause between them —
  the [pacing](./hardware#packet-size-and-pacing) every chassis needs,
  on USB and SPP as much as on BLE. It throws `MediaNotSpecifiedError`
  without a media descriptor.
- `getStatus()` reports link state only. There is no `onStatus`;
  consumers that want a push shape poll `getStatus()`.
- `print()` and `getStatus()` are serialised against each other.

## Discovery semantics

- `listPrinters()` returns `[]` — RFCOMM ports carry no model
  identity and USB is not enumerated here.
- `openPrinter({ serialPath, deviceKey })` delegates to
  `openBluetoothSpp`.
- `openPrinter({ host })` and `openPrinter({ vid, pid })` throw.
