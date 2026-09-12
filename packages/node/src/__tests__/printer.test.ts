import { describe, expect, it, vi } from 'vitest';
import type { Transport } from '@thermal-label/contracts';
import { DEVICES, MEDIA, MediaNotSpecifiedError } from '@thermal-label/marklife-core';
import { MarklifePrinter } from '../printer.js';

class FakeTransport implements Transport {
  connected = true;
  writes: Uint8Array[] = [];
  replies: Uint8Array[] = [];

  async write(data: Uint8Array): Promise<void> {
    this.writes.push(data);
    return Promise.resolve();
  }

  async read(_n: number, _t?: number): Promise<Uint8Array> {
    return Promise.resolve(this.replies.shift() ?? new Uint8Array(0));
  }

  async close(): Promise<void> {
    this.connected = false;
    return Promise.resolve();
  }
}

function rgba(width: number, height: number): { width: number; height: number; data: Uint8Array } {
  const data = new Uint8Array(width * height * 4);
  data.fill(0xff);
  return { width, height, data };
}

describe('MarklifePrinter', () => {
  it('print() writes wire bytes for marklife-yxq', async () => {
    const transport = new FakeTransport();
    const printer = new MarklifePrinter(DEVICES.S8, transport, 'bluetooth-spp');
    await printer.print(rgba(48, 16), MEDIA.GAP_50X30);
    expect(transport.writes.length).toBe(1);
    const bytes = transport.writes[0]!;
    // S8 (id 1) starts with 1F 70 01 (density)
    expect(bytes[0]).toBe(0x1f);
    expect(bytes[1]).toBe(0x70);
  });

  it('print() composes CPCL bytes for T3, not TSPL', () => {
    // T3 was bound to marklife-tspl. Our own wire analysis shows it
    // speaks a CPCL dialect: a paper-type byte, then a `! 0 200 200`
    // page header. No registry chassis binds to marklife-tspl now.
    const transport = new FakeTransport();
    const printer = new MarklifePrinter(DEVICES.T3, transport, 'bluetooth-spp');
    return printer.print(rgba(48, 16), MEDIA.GAP_50X30).then(() => {
      const bytes = transport.writes[0]!;
      expect([...bytes.subarray(0, 4)]).toEqual([0x1f, 0x80, 0x01, 0x10]);
      expect(new TextDecoder().decode(bytes.subarray(4, 6))).toBe('! ');
    });
  });

  it('print() rejects D100 (jbig encoder deferred)', async () => {
    const transport = new FakeTransport();
    const printer = new MarklifePrinter(DEVICES.D100, transport, 'bluetooth-spp');
    await expect(printer.print(rgba(8, 8), MEDIA.GAP_50X30)).rejects.toThrow();
  });

  it('reports family, model, and connected', () => {
    const transport = new FakeTransport();
    const printer = new MarklifePrinter(DEVICES.S8, transport, 'bluetooth-spp');
    expect(printer.family).toBe('marklife');
    expect(printer.model).toBe('S8');
    expect(printer.connected).toBe(true);
  });

  it('close closes the transport', async () => {
    const transport = new FakeTransport();
    const printer = new MarklifePrinter(DEVICES.S8, transport, 'bluetooth-spp');
    await printer.close();
    expect(transport.connected).toBe(false);
  });

  it('getStatus returns ready=true when connected', async () => {
    const transport = new FakeTransport();
    const printer = new MarklifePrinter(DEVICES.S8, transport, 'bluetooth-spp');
    const status = await printer.getStatus();
    expect(status.ready).toBe(true);
    expect(status.errors).toEqual([]);
  });

  it('createPreview returns a single-plane preview', async () => {
    const transport = new FakeTransport();
    const printer = new MarklifePrinter(DEVICES.S8, transport, 'bluetooth-spp');
    const result = await printer.createPreview(rgba(8, 8));
    expect(result.planes.length).toBe(1);
  });

  it('print() throws MediaNotSpecifiedError when no media is known', async () => {
    const transport = new FakeTransport();
    const printer = new MarklifePrinter(DEVICES.P12, transport, 'usb');
    await expect(printer.print(rgba(48, 16))).rejects.toBeInstanceOf(MediaNotSpecifiedError);
    expect(transport.writes.length).toBe(0);
  });

  it('print() honours an explicit rotate override', async () => {
    const transport = new FakeTransport();
    const printer = new MarklifePrinter(DEVICES.S8, transport, 'bluetooth-spp');
    await printer.print(rgba(64, 16), MEDIA.GAP_50X30, { rotate: 90 });
    const auto = new FakeTransport();
    await new MarklifePrinter(DEVICES.S8, auto, 'bluetooth-spp').print(
      rgba(64, 16),
      MEDIA.GAP_50X30,
    );
    expect(transport.writes[0]).not.toEqual(auto.writes[0]);
  });
});

describe('send pacing', () => {
  // Same packet ceiling and pause as the web driver: the firmware's
  // intake rate is a property of the chassis, not of the link, so a
  // job over an RFCOMM or USB stream is fed the same way.
  it('splits the job at the registry ceiling and pauses between packets', async () => {
    vi.useFakeTimers();
    try {
      const unpaced = new FakeTransport();
      await new MarklifePrinter(DEVICES.LP15, unpaced, 'bluetooth-spp', {
        interChunkDelayMs: 0,
      }).print(rgba(48, 64), MEDIA.CONTINUOUS_15MM);
      const packets = unpaced.writes.length;
      expect(packets).toBeGreaterThanOrEqual(3);
      for (const w of unpaced.writes) expect(w.length).toBeLessThanOrEqual(95);

      const transport = new FakeTransport();
      const printer = new MarklifePrinter(DEVICES.LP15, transport, 'bluetooth-spp');
      const done = printer.print(rgba(48, 64), MEDIA.CONTINUOUS_15MM);
      await vi.advanceTimersByTimeAsync(0);
      for (let n = 1; n < packets; n++) {
        expect(transport.writes.length).toBe(n);
        await vi.advanceTimersByTimeAsync(30);
      }
      expect(transport.writes.length).toBe(packets);
      await done;
    } finally {
      vi.useRealTimers();
    }
  });

  it('serialises a status poll behind an in-flight print', async () => {
    vi.useFakeTimers();
    try {
      const transport = new FakeTransport();
      const printer = new MarklifePrinter(DEVICES.LP15, transport, 'bluetooth-spp');
      const order: string[] = [];
      const printing = printer.print(rgba(48, 64), MEDIA.CONTINUOUS_15MM).then(() => {
        order.push('print');
      });
      await vi.advanceTimersByTimeAsync(0);
      const polling = printer.getStatus().then(() => {
        order.push('status');
      });
      await vi.advanceTimersByTimeAsync(1_000);
      await Promise.all([printing, polling]);
      expect(order).toEqual(['print', 'status']);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('render threshold per sub-engine', () => {
  // The rebindings left marklife-tspl and marklife-escpos with no
  // registry chassis, so these branches are only reachable through a
  // synthetic entry. They are still live code — a chassis may route
  // to either — so they stay covered.
  const deviceWith = (protocol: string): (typeof DEVICES)['S8'] =>
    ({
      key: 'SYNTHETIC',
      name: 'Synthetic',
      family: 'marklife',
      transports: { 'bluetooth-spp': { namePrefix: 'X' } },
      supportStatus: 'unverified',
      engines: [
        {
          role: 'primary',
          protocol,
          dpi: 203,
          headDots: 384,
          capabilities: { bitPolarity: '1=dark', compression: 'none', protocolId: 0 },
        },
      ],
    }) as unknown as (typeof DEVICES)['S8'];

  it('drives the TSPL path through a synthetic entry', async () => {
    const transport = new FakeTransport();
    const printer = new MarklifePrinter(deviceWith('marklife-tspl'), transport, 'bluetooth-spp');
    await printer.print(rgba(48, 16), MEDIA.GAP_50X30);
    expect(new TextDecoder().decode(transport.writes[0]!.subarray(0, 5))).toBe('CLS\r\n');
  });

  it('drives the ESC/POS path through a synthetic entry', async () => {
    const transport = new FakeTransport();
    const printer = new MarklifePrinter(deviceWith('marklife-escpos'), transport, 'bluetooth-spp');
    await printer.print(rgba(48, 16), MEDIA.GAP_50X30);
    expect(transport.writes[0]![0]).toBe(0x1b); // ESC @
  });

  it('rejects an entry whose engine has no encoder', async () => {
    const transport = new FakeTransport();
    const printer = new MarklifePrinter(deviceWith('marklife-nope'), transport, 'bluetooth-spp');
    await expect(printer.print(rgba(8, 8), MEDIA.GAP_50X30)).rejects.toThrow(/drivable/i);
  });
});
