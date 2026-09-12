/* eslint-disable @typescript-eslint/no-deprecated -- intentionally exercises the deprecated per-transport factories during plan-10 transition */
import { describe, expect, it, vi } from 'vitest';
import { REGISTRY_MARKLIFE } from '@thermal-label/marklife-core';
import { fromSerialPort, requestPrinterSerial } from '../factories.js';

describe('Web factories — error paths (no browser API needed)', () => {
  it('every registry chassis declares a bluetooth-gatt transport', () => {
    // The whole family is BLE-capable — confirmed on the air — so
    // `requestPrinters({ transport: 'bluetooth-gatt' })` can offer
    // every entry.
    for (const entry of REGISTRY_MARKLIFE.devices) {
      expect(entry.transports['bluetooth-gatt'], entry.key).toBeDefined();
    }
  });

  it('requestPrinterSerial rejects unknown model key', async () => {
    await expect(requestPrinterSerial({ deviceKey: 'NOT_A_KEY' as never })).rejects.toThrow(
      /unknown model/,
    );
  });
});

// `fromSerialPort` takes an already-picked port, so unlike the picker
// factories it needs no browser — only the transport's `fromPort`
// stubbed out. Covers the happy path plus the unknown-key guard.
describe('fromSerialPort', () => {
  it('binds the registry entry and wraps the supplied port', async () => {
    vi.resetModules();
    const fromPort = vi.fn().mockResolvedValue({ connected: true });
    vi.doMock('@thermal-label/transport/web', () => ({
      WebSerialTransport: { fromPort, request: vi.fn() },
    }));
    const { fromSerialPort } = await import('../factories.js');

    const port = { fake: 'port' };
    const printer = await fromSerialPort(port, 'S8', 115200);

    expect(fromPort).toHaveBeenCalledWith(port, 115200);
    expect(printer.model).toBe('S8');
    vi.doUnmock('@thermal-label/transport/web');
  });

  it('rejects an unknown model key', async () => {
    await expect(fromSerialPort({}, 'NOT_A_KEY' as never)).rejects.toThrow(/unknown model/);
  });
});
