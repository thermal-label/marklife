[**marklife**](../../../README.md)

***

[marklife](../../../README.md) / [web/src](../README.md) / resolveProfile

# Function: resolveProfile()

> **resolveProfile**(`server`): `Promise`\<[`ResolvedProfile`](../interfaces/ResolvedProfile.md)\>

Probe a connected GATT server for the first profile it satisfies.

A profile counts as satisfied only when TX and RX both resolve —
a chassis can expose a service shell with no usable characteristics.

## Parameters

### server

`BluetoothRemoteGATTServer`

## Returns

`Promise`\<[`ResolvedProfile`](../interfaces/ResolvedProfile.md)\>

## Throws

when no candidate profile resolves, naming what was tried
  so a triage report says something actionable.
