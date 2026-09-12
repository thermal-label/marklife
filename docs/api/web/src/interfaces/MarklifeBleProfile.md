[**marklife**](../../../README.md)

***

[marklife](../../../README.md) / [web/src](../README.md) / MarklifeBleProfile

# Interface: MarklifeBleProfile

One candidate GATT layout.

## Properties

### cxCharacteristicUuid?

> `optional` **cxCharacteristicUuid?**: `string`

Optional flow-control characteristic. Profile A gates writes on
a credit counter published here; the other profiles are
unthrottled. See `MarklifeBleTransport`.

***

### id

> **id**: [`MarklifeBleProfileId`](../type-aliases/MarklifeBleProfileId.md)

Short tag recorded on the transport for triage.

***

### rxCharacteristicUuid

> **rxCharacteristicUuid**: `string`

***

### serviceUuid

> **serviceUuid**: `string`

***

### txCharacteristicUuid

> **txCharacteristicUuid**: `string`
