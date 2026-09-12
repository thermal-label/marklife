[**marklife**](../../../README.md)

***

[marklife](../../../README.md) / [core/src](../README.md) / encodeJbigJob

# Function: encodeJbigJob()

> **encodeJbigJob**(`engine`, `page`): `Uint8Array`

Encode a marklife-jbig print job.

## Parameters

### engine

[`JbigEngine`](../type-aliases/JbigEngine.md)

### page

[`JbigPage`](../interfaces/JbigPage.md)

## Returns

`Uint8Array`

## Throws

for `protocolId` 10 (X8 /
  U210), which is a different wire protocol, and for any id other
  than 7 or 12.

## Throws

from `jbigEncode` until the
  WASM build of libjbigkit ships (DECISIONS.md § D4).
