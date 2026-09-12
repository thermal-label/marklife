[**marklife**](../../../README.md)

***

[marklife](../../../README.md) / [node/src](../README.md) / MarklifeMedia

# Interface: MarklifeMedia

## Extends

- [`MediaDescriptor`](/contracts/api/interfaces/MediaDescriptor)

## Properties

### targetModels

> **targetModels**: readonly `MarklifeTargetModel`[]

Devices this media is compatible with. Driver-defined string set;
matched against `PrintEngine.mediaCompatibility`. Examples:
`['standard']` (paper roll fits 672-dot heads),
`['4xl', '5xl']` (wide-head only), `['duo']` (D1 cartridges).
Omit = fits every device in the family.

#### Overrides

`MediaDescriptor.targetModels`
