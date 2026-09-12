[**marklife**](../../../README.md)

***

[marklife](../../../README.md) / [web/src](../README.md) / MarklifeBleTransport

# Class: MarklifeBleTransport

## Implements

- [`Transport`](/contracts/api/interfaces/Transport)

## Properties

### profileId

> `readonly` **profileId**: [`MarklifeBleProfileId`](../type-aliases/MarklifeBleProfileId.md)

Which GATT profile resolved — surfaced for triage reports.

## Accessors

### connected

#### Get Signature

> **get** **connected**(): `boolean`

Whether the transport is currently connected.

##### Returns

`boolean`

#### Implementation of

`Transport.connected`

## Methods

### close()

> **close**(): `Promise`\<`void`\>

Close the connection.

Always safe to call multiple times. Always `await` the result.

#### Returns

`Promise`\<`void`\>

#### Implementation of

`Transport.close`

***

### read()

> **read**(`length`, `timeout?`): `Promise`\<`Uint8Array`\>

Read bytes from the printer.

Buffers until `length` bytes are available or the timeout fires.

BLE implementations: there is no "read N bytes" primitive in BLE.
Implementations must buffer incoming GATT notifications internally
and satisfy `read()` calls from that buffer. Document this in your
transport class — every BLE implementation must handle buffering
consistently so drivers get the same pull-based API on every
transport.

#### Parameters

##### length

`number`

##### timeout?

`number`

#### Returns

`Promise`\<`Uint8Array`\>

#### Throws

TransportTimeoutError on timeout.

#### Throws

TransportClosedError if the transport is closed mid-read.

#### Implementation of

`Transport.read`

***

### write()

> **write**(`data`): `Promise`\<`void`\>

Send bytes to the printer.

#### Parameters

##### data

`Uint8Array`

#### Returns

`Promise`\<`void`\>

#### Implementation of

`Transport.write`

***

### open()

> `static` **open**(`device`, `resolved`, `maxPacket?`): `Promise`\<`MarklifeBleTransport`\>

Wrap a probed profile on an already-connected device, starting
notifications on RX (and on the credit channel when present).

#### Parameters

##### device

`BluetoothDevice`

##### resolved

[`ResolvedProfile`](../interfaces/ResolvedProfile.md)

##### maxPacket?

`number` = `DEFAULT_MAX_PACKET`

— the registry's `bluetooth-gatt.mtu`, the
  firmware's packet ceiling.

#### Returns

`Promise`\<`MarklifeBleTransport`\>
