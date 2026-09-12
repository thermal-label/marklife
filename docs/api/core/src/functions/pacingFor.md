[**marklife**](../../../README.md)

***

[marklife](../../../README.md) / [core/src](../README.md) / pacingFor

# Function: pacingFor()

> **pacingFor**(`device`): [`SendPacing`](../interfaces/SendPacing.md)

Resolve a device's send pacing from its registry entry.

Packet size comes from `transports['bluetooth-gatt'].mtu`, which
the registry uses as the firmware intake ceiling; the pause from
`engines[0].capabilities.interChunkDelayMs`. Either falls back to
the family default.

## Parameters

### device

[`DeviceEntry`](/contracts/api/interfaces/DeviceEntry)

## Returns

[`SendPacing`](../interfaces/SendPacing.md)
