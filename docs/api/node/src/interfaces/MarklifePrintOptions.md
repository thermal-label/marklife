[**marklife**](../../../README.md)

***

[marklife](../../../README.md) / [node/src](../README.md) / MarklifePrintOptions

# Interface: MarklifePrintOptions

## Extends

- [`PrintOptions`](/contracts/api/interfaces/PrintOptions)

## Properties

### densityLevel?

> `optional` **densityLevel?**: `number`

Per-job density integer override (1..15). Wins over the
inherited string `density` ('light' / 'normal' / 'dark') when
present — useful when the host has fine-grained UI control.

***

### rotate?

> `optional` **rotate?**: `0` \| `90` \| `270` \| `"auto"` \| `180`

Override the family default-rotation behaviour.

- `'auto'` / `undefined` — use `pickRotation(image, media,
  ROTATE_DIRECTION)` from contracts.
- `0` / `90` / `180` / `270` — explicit rotation in degrees.
