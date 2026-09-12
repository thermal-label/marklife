import { describe, expect, it, vi } from 'vitest';
import { DeviceIdentificationRequiredError } from '@thermal-label/contracts';
import { DEVICES } from '@thermal-label/marklife-core';
import { devicesForTransport, requestPrinters } from '../request-printers.js';

// Web Bluetooth / Web Serial don't exist in jsdom — tests cover the
// deterministic branches: transport gating, candidate filtering,
// deviceKey validation. Picker round-trips need a real browser.

describe('requestPrinters(opts) — marklife generic factory', () => {
  describe('transport: usb', () => {
    // jsdom has no navigator.usb; stub just enough of the picker to
    // drive the identify branches. The transport layer itself is
    // covered in @thermal-label/transport.
    const withUsb = (device: unknown, fn: () => Promise<void>) => async () => {
      const nav = navigator as unknown as { usb?: unknown };
      const had = 'usb' in nav;
      const prev = nav.usb;
      nav.usb = { requestDevice: vi.fn().mockResolvedValue(device) };
      try {
        await fn();
      } finally {
        if (had) nav.usb = prev;
        else delete nav.usb;
      }
    };

    it(
      'rejects when no USB-capable device matches and none is chosen',
      withUsb({ vendorId: 0xdead, productId: 0xbeef }, async () => {
        await expect(requestPrinters({ transport: 'usb' })).rejects.toBeInstanceOf(
          DeviceIdentificationRequiredError,
        );
      }),
    );

    it(
      'candidates are limited to usb-capable entries',
      withUsb({ vendorId: 0xdead, productId: 0xbeef }, async () => {
        try {
          await requestPrinters({ transport: 'usb' });
          throw new Error('expected DeviceIdentificationRequiredError');
        } catch (err) {
          if (!(err instanceof DeviceIdentificationRequiredError)) throw err;
          expect(err.candidates.length).toBeGreaterThan(0);
          for (const c of err.candidates) expect(c.transports.usb).toBeDefined();
        }
      }),
    );

    it(
      'rejects an unknown deviceKey',
      withUsb({ vendorId: 0x09c7, productId: 0x0011 }, async () => {
        await expect(requestPrinters({ transport: 'usb', deviceKey: 'NOT_A_KEY' })).rejects.toThrow(
          /unknown deviceKey/,
        );
      }),
    );
  });

  it('devicesForTransport(usb) matches the registry USB entries', () => {
    const usbKeys = devicesForTransport('usb').map(d => d.key);
    // P12 + P15 are the chassis that declare USB today.
    expect(usbKeys).toContain('P12');
    expect(usbKeys).toContain('P15');
  });

  // BLE now identifies from the advertised name after connecting, so
  // these exercise a faked GATT tree rather than a pre-connect throw.
  describe('transport: bluetooth-gatt', () => {
    const A = '0000ff00-0000-1000-8000-00805f9b34fb';
    const B = '49535343-fe7d-4ae5-8fa9-9fafd205e455';

    const chr = (uuid: string) => ({
      uuid,
      properties: { writeWithoutResponse: true, notify: true },
      startNotifications: vi.fn(() => Promise.resolve()),
      stopNotifications: vi.fn(() => Promise.resolve()),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      writeValueWithoutResponse: vi.fn(() => Promise.resolve()),
    });

    /** Fake device exposing exactly one profile's service tree. */
    const fakeDevice = (name: string, serviceUuid: string) => {
      const chars = new Map<string, unknown>();
      const add = (u: string) => chars.set(u, chr(u));
      if (serviceUuid === A) {
        add('0000ff02-0000-1000-8000-00805f9b34fb');
        add('0000ff01-0000-1000-8000-00805f9b34fb');
        add('0000ff03-0000-1000-8000-00805f9b34fb');
      } else {
        add('49535343-8841-43f4-a8d4-ecbe34729bb3');
        add('49535343-1e4d-4bd9-ba61-23c647249616');
      }
      const service = {
        uuid: serviceUuid,
        getCharacteristic: (u: string) => {
          const c = chars.get(u.toLowerCase());
          return c ? Promise.resolve(c) : Promise.reject(new Error('NotFoundError'));
        },
      };
      const gatt = {
        connected: true,
        connect: vi.fn(),
        disconnect: vi.fn(),
        getPrimaryService: (u: string) =>
          u.toLowerCase() === serviceUuid
            ? Promise.resolve(service)
            : Promise.reject(Object.assign(new Error('not found'), { name: 'NotFoundError' })),
      };
      gatt.connect.mockResolvedValue(gatt);
      return { name, gatt, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    };

    const withBle = (device: unknown, fn: () => Promise<void>) => async () => {
      const nav = navigator as unknown as { bluetooth?: unknown };
      const had = 'bluetooth' in nav;
      const prev = nav.bluetooth;
      nav.bluetooth = { requestDevice: vi.fn().mockResolvedValue(device) };
      try {
        await fn();
      } finally {
        if (had) nav.bluetooth = prev;
        else delete nav.bluetooth;
      }
    };

    it(
      'identifies the chassis from its advertised name (Profile A)',
      withBle(fakeDevice('P12_ZA15B_BLE', A), async () => {
        const printers = await requestPrinters({ transport: 'bluetooth-gatt' });
        expect(Object.values(printers)[0]?.device?.key).toBe('P12');
      }),
    );

    it(
      'falls back to the Microchip UART profile when Profile A is absent',
      withBle(fakeDevice('S2-6D09_BLE', B), async () => {
        const printers = await requestPrinters({ transport: 'bluetooth-gatt' });
        expect(Object.values(printers)[0]?.device?.key).toBe('S2');
      }),
    );

    it(
      'asks the operator when the advertised name matches nothing',
      withBle(fakeDevice('SomeOtherPrinter', A), async () => {
        await expect(requestPrinters({ transport: 'bluetooth-gatt' })).rejects.toBeInstanceOf(
          DeviceIdentificationRequiredError,
        );
      }),
    );

    it(
      'an explicit deviceKey overrides the advertised name',
      withBle(fakeDevice('P12_ZA15B_BLE', A), async () => {
        const printers = await requestPrinters({
          transport: 'bluetooth-gatt',
          deviceKey: 'P15',
        });
        expect(Object.values(printers)[0]?.device?.key).toBe('P15');
      }),
    );

    it(
      "opens the transport with the chosen entry's packet ceiling",
      withBle(fakeDevice('SomeOtherPrinter', B), async () => {
        // The ceiling is a firmware property, so it has to come from
        // the entry the operator picks — not from a name that matched
        // nothing, and not from a default fixed before they picked.
        const { MarklifeBleTransport } = await import('../ble-transport.js');
        const open = vi.spyOn(MarklifeBleTransport, 'open');
        try {
          let resume: ((key: string) => Promise<unknown>) | undefined;
          await requestPrinters({ transport: 'bluetooth-gatt' }).catch((err: unknown) => {
            resume = (err as DeviceIdentificationRequiredError).continueWith;
          });
          expect(open).not.toHaveBeenCalled();
          await resume?.('S2');
          expect(open).toHaveBeenCalledTimes(1);
          expect(open.mock.calls[0]?.[2]).toBe(95);
        } finally {
          open.mockRestore();
        }
      }),
    );

    it(
      'rejects an unknown deviceKey',
      withBle(fakeDevice('P12_ZA15B_BLE', A), async () => {
        await expect(
          requestPrinters({ transport: 'bluetooth-gatt', deviceKey: 'NOT_A_KEY' }),
        ).rejects.toThrow(/unknown deviceKey/);
      }),
    );

    it(
      'reports every profile it tried when none resolves',
      withBle(fakeDevice('P12_ZA15B_BLE', '0000dead-0000-1000-8000-00805f9b34fb'), async () => {
        await expect(requestPrinters({ transport: 'bluetooth-gatt' })).rejects.toThrow(
          /No marklife BLE profile resolved/,
        );
      }),
    );
  });

  describe('transport: serial', () => {
    it('throws DeviceIdentificationRequiredError when deviceKey omitted', async () => {
      await expect(requestPrinters({ transport: 'serial' })).rejects.toBeInstanceOf(
        DeviceIdentificationRequiredError,
      );
    });
  });

  describe('transport: bluetooth-spp', () => {
    it('throws DeviceIdentificationRequiredError when deviceKey omitted', async () => {
      await expect(requestPrinters({ transport: 'bluetooth-spp' })).rejects.toBeInstanceOf(
        DeviceIdentificationRequiredError,
      );
    });
  });
});

describe('devicesForTransport — marklife', () => {
  it('returns only entries declaring the queried transport', () => {
    for (const t of ['serial', 'bluetooth-spp', 'bluetooth-gatt', 'usb'] as const) {
      for (const entry of devicesForTransport(t)) {
        expect(entry.transports[t]).toBeDefined();
      }
    }
  });

  it('S8 appears as a bluetooth-spp candidate (per existing factories test)', () => {
    const spp = devicesForTransport('bluetooth-spp');
    expect(spp.some(d => d.key === DEVICES.S8.key)).toBe(true);
  });
});
