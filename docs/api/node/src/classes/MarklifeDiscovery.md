[**marklife**](../../../README.md)

***

[marklife](../../../README.md) / [node/src](../README.md) / MarklifeDiscovery

# Class: MarklifeDiscovery

`PrinterDiscovery` implementation for marklife printers.

Every chassis speaks Bluetooth; the P12 and P15 also expose a USB
Printer-class interface, and none speaks TCP. The discovery surface
is therefore:

- **Classic-BT SPP** (the bulk of the catalogue) — `openBluetoothSpp`
  accepts an OS-paired RFCOMM device path (`/dev/rfcomm0`,
  `/dev/tty.<Name>-SPPDev`, `COMx`) plus a `deviceKey`. The user
  pairs at the OS level; `SerialTransport.open` opens the path.
- **BLE GATT** — deferred. Node BLE (`noble`) is rough; for v1,
  `openBluetoothGatt` throws. Browser hosts use the web package's
  `requestPrinterBluetooth` factory.

`listPrinters()` returns an empty list because none of the
supported transports are auto-enumerable to a specific marklife
model from Node — Classic-BT pairing is OS-managed and BLE is
deferred.

## Implements

- [`PrinterDiscovery`](/contracts/api/interfaces/PrinterDiscovery)

## Constructors

### Constructor

> **new MarklifeDiscovery**(): `MarklifeDiscovery`

#### Returns

`MarklifeDiscovery`

## Properties

### family

> `readonly` **family**: `"marklife"` = `'marklife'`

Driver family identifier — matches `DeviceEntry.family`.

#### Implementation of

`PrinterDiscovery.family`

## Methods

### listPrinters()

> **listPrinters**(): `Promise`\<[`DiscoveredPrinter`](/contracts/api/interfaces/DiscoveredPrinter)[]\>

Returns an empty list — no auto-enumeration in v1.

Classic-BT SPP printers don't surface a model identifier on
their RFCOMM channel, so we can't bind a registry entry without
a user-provided `deviceKey`. BLE enumeration is deferred until
a Node BLE backend is wired in.

#### Returns

`Promise`\<[`DiscoveredPrinter`](/contracts/api/interfaces/DiscoveredPrinter)[]\>

#### Implementation of

`PrinterDiscovery.listPrinters`

***

### openBluetoothGatt()

> **openBluetoothGatt**(`_options`): `Promise`\<[`MarklifePrinter`](MarklifePrinter.md)\>

Open a BLE printer.

**Deferred in v1** — Node BLE backends (`noble`) are rough and
the BLE Profile A / B / C dispatch layer is non-trivial. Browser
hosts use `@thermal-label/marklife-web`'s
`requestPrinterBluetooth(modelKey)` factory, which surfaces the
Web Bluetooth picker with the right service UUID.

#### Parameters

##### \_options

###### deviceKey

[`DeviceKey`](../type-aliases/DeviceKey.md)

#### Returns

`Promise`\<[`MarklifePrinter`](MarklifePrinter.md)\>

#### Throws

always.

***

### openBluetoothSpp()

> **openBluetoothSpp**(`options`): `Promise`\<[`MarklifePrinter`](MarklifePrinter.md)\>

Open a Bluetooth-SPP printer by OS-paired RFCOMM path.

On Linux: `/dev/rfcomm0` (after `rfcomm bind` or `rfcomm
connect`). On macOS: `/dev/tty.<Name>-SPPDev` (after Bluetooth
pairing). On Windows: `COMx` (after pairing in the Bluetooth
settings). The `deviceKey` is required because RFCOMM carries no
protocol-binding information.

#### Parameters

##### options

###### baudRate?

`number`

###### deviceKey

[`DeviceKey`](../type-aliases/DeviceKey.md)

###### serialPath

`string`

#### Returns

`Promise`\<[`MarklifePrinter`](MarklifePrinter.md)\>

***

### openPrinter()

> **openPrinter**(`options?`): `Promise`\<[`MarklifePrinter`](MarklifePrinter.md)\>

Open a printer.

- `serialPath` + `deviceKey` → opens an OS-paired Bluetooth-SPP
  port via `SerialTransport`.
- `host` → throws (no TCP transport in this catalogue).
- `vid`+`pid` → throws (no USB transport).

Use `openBluetoothSpp` / `openBluetoothGatt` directly for the
marklife-specific surface.

#### Parameters

##### options?

[`OpenOptions`](/contracts/api/interfaces/OpenOptions) = `{}`

#### Returns

`Promise`\<[`MarklifePrinter`](MarklifePrinter.md)\>

#### Implementation of

`PrinterDiscovery.openPrinter`
