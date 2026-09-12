import { describe, expect, it } from 'vitest';
import { DEVICES } from '../devices.js';
import { DEFAULT_PACKET_BYTES, DEFAULT_PACKET_DELAY_MS, pacingFor } from '../pacing.js';

describe('pacingFor', () => {
  it('reads the S2 ceiling and the family default pause', () => {
    // Bench, 2026-09-11: 95-byte packets print, 176-byte ones do not.
    expect(pacingFor(DEVICES.S2)).toEqual({ packetBytes: 95, delayMs: DEFAULT_PACKET_DELAY_MS });
  });

  it('reads the X2 pause from its capabilities', () => {
    expect(pacingFor(DEVICES.X2).delayMs).toBe(1);
    expect(pacingFor(DEVICES.X2_BLE).delayMs).toBe(1);
    expect(pacingFor(DEVICES.M60_BY_X2).delayMs).toBe(1);
  });

  it('falls back to the family defaults on an entry declaring neither', () => {
    const bare = {
      ...DEVICES.S8,
      transports: { 'bluetooth-spp': { namePrefix: 'S8' } },
      engines: [{ ...DEVICES.S8.engines[0]!, capabilities: {} }],
    } as typeof DEVICES.S8;
    expect(pacingFor(bare)).toEqual({
      packetBytes: DEFAULT_PACKET_BYTES,
      delayMs: DEFAULT_PACKET_DELAY_MS,
    });
  });

  it('every registry entry resolves to a sane packet size and pause', () => {
    for (const device of Object.values(DEVICES)) {
      const { packetBytes, delayMs } = pacingFor(device);
      expect(packetBytes, device.key).toBeGreaterThanOrEqual(20);
      expect(packetBytes, device.key).toBeLessThanOrEqual(DEFAULT_PACKET_BYTES);
      expect(delayMs, device.key).toBeGreaterThanOrEqual(0);
    }
  });
});
