[**marklife**](../../../README.md)

***

[marklife](../../../README.md) / [node/src](../README.md) / discovery

# Variable: discovery

> `const` **discovery**: [`MarklifeDiscovery`](../classes/MarklifeDiscovery.md)

Default `MarklifeDiscovery` singleton.

`thermal-label-cli` auto-detects installed driver packages by
walking a `KNOWN_DRIVERS` allowlist and looking for the named
`discovery` export with a `listPrinters` method.
