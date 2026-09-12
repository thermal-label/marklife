[**marklife**](../../../README.md)

***

[marklife](../../../README.md) / [node/src](../README.md) / REGISTRY\_MARKLIFE

# Variable: REGISTRY\_MARKLIFE

> `const` **REGISTRY\_MARKLIFE**: [`DeviceRegistry`](/contracts/api/interfaces/DeviceRegistry)

The marklife device registry — every model authored under
`data/devices/*.json5`, validated and aggregated by
`scripts/compile-data.mjs`.

Pair with `PROTOCOLS` (from this package) and pass to
`resolveSupportedDevices` from `@thermal-label/contracts` to filter
the list down to what the runtime can actually drive.
