import type { DeviceEntry } from '@thermal-label/contracts';
import type { MarklifeEngine } from './types.js';

/**
 * How a job is fed to a chassis: fixed-size packets with a pause
 * between them, on every link.
 *
 * Both numbers are firmware properties, not link properties. The
 * packet size is what the firmware will take in one intake — the S2
 * accepts a 176-byte BLE packet, acks it, and prints nothing, while
 * the same job in 95-byte packets prints (bench, 2026-09-11). The
 * pause is the rate it drains at: where a link has credit-based flow
 * control, credits report buffer space rather than drain, so a full
 * credit window fired back to back still loses raster. thermoprint
 * documents the same per-device packet sizes and timers
 * (REVERSE_ENGINEERING.md § 2.4–2.5).
 */
export interface SendPacing {
  /** Largest write issued to the transport, in bytes. */
  packetBytes: number;
  /** Pause after every packet but the last, in milliseconds. */
  delayMs: number;
}

/** Packet size when the registry entry declares none. */
export const DEFAULT_PACKET_BYTES = 237;
/** Pause when the engine declares none — the family-wide rate. */
export const DEFAULT_PACKET_DELAY_MS = 30;

/**
 * Resolve a device's send pacing from its registry entry.
 *
 * Packet size comes from `transports['bluetooth-gatt'].mtu`, which
 * the registry uses as the firmware intake ceiling; the pause from
 * `engines[0].capabilities.interChunkDelayMs`. Either falls back to
 * the family default.
 */
export function pacingFor(device: DeviceEntry): SendPacing {
  const caps = (device.engines[0] as MarklifeEngine | undefined)?.capabilities;
  const delay = caps?.interChunkDelayMs;
  return {
    packetBytes: device.transports['bluetooth-gatt']?.mtu ?? DEFAULT_PACKET_BYTES,
    delayMs: typeof delay === 'number' && delay >= 0 ? delay : DEFAULT_PACKET_DELAY_MS,
  };
}
