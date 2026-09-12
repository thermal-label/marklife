[**marklife**](../../../README.md)

***

[marklife](../../../README.md) / [core/src](../README.md) / SendPacing

# Interface: SendPacing

How a job is fed to a chassis: fixed-size packets with a pause
between them, on every link.

Both numbers are firmware properties, not link properties. The
packet size is what the firmware will take in one intake — the S2
accepts a 176-byte BLE packet, acks it, and prints nothing, while
the same job in 95-byte packets prints (bench, 2026-09-11). The
pause is the rate it drains at: where a link has credit-based flow
control, credits report buffer space rather than drain, so a full
credit window fired back to back still loses raster. thermoprint
documents the same per-device packet sizes and timers
(REVERSE_ENGINEERING.md § 2.4–2.5).

## Properties

### delayMs

> **delayMs**: `number`

Pause after every packet but the last, in milliseconds.

***

### packetBytes

> **packetBytes**: `number`

Largest write issued to the transport, in bytes.
