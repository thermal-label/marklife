[**marklife**](../../../README.md)

***

[marklife](../../../README.md) / [core/src](../README.md) / buildCpclPageHeader

# Function: buildCpclPageHeader()

> **buildCpclPageHeader**(`heightDots`): `Uint8Array`

CPCL page header — `! 0 200 200 <heightDots> 1\r\n`.

Fields are: horizontal offset (0), x dpi, y dpi, page height in
dots, label count. The count is fixed at 1 — no other value has been
seen for this family — so `options.copies` is deliberately not
plumbed through here.

## Parameters

### heightDots

`number`

## Returns

`Uint8Array`
