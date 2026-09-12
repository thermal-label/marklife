import { describe, expect, it, vi } from 'vitest';
import type { Transport } from '@thermal-label/contracts';
import { DEVICES, MEDIA, MediaNotSpecifiedError } from '@thermal-label/marklife-core';
import { WebMarklifePrinter } from '../printer.js';

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

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

describe('WebMarklifePrinter', () => {
  it('print() composes wire bytes for marklife-yxq via S8', async () => {
    const transport = new FakeTransport();
    const printer = new WebMarklifePrinter(DEVICES.S8, transport);
    await printer.print(rgba(48, 16), MEDIA.GAP_50X30);
    expect(transport.writes.length).toBe(1);
    const bytes = transport.writes[0]!;
    // S8 (id 1) starts with `1F 70 01 d` (density)
    expect(bytes[0]).toBe(0x1f);
    expect(bytes[1]).toBe(0x70);
  });

  it('print() composes CPCL bytes for T3, not TSPL', () => {
    // T3 was bound to marklife-tspl. Our own wire analysis shows it
    // speaks a CPCL dialect: a paper-type byte, then a `! 0 200 200`
    // page header. No registry chassis binds to marklife-tspl now.
    const transport = new FakeTransport();
    const printer = new WebMarklifePrinter(DEVICES.T3, transport);
    return printer.print(rgba(48, 16), MEDIA.GAP_50X30).then(() => {
      const bytes = transport.writes[0]!;
      expect([...bytes.subarray(0, 4)]).toEqual([0x1f, 0x80, 0x01, 0x10]);
      expect(new TextDecoder().decode(bytes.subarray(4, 6))).toBe('! ');
    });
  });

  it('print() composes L11 bytes for LP15, not the ESC/POS envelope', async () => {
    // LP15 was bound to marklife-escpos and emitted an ESC @ reset.
    // Wire analysis showed it speaks the L11 stream: a 15-NUL wakeup
    // then the enable. The old envelope had no enable and no stop, so
    // the raster was never committed.
    const transport = new FakeTransport();
    const printer = new WebMarklifePrinter(DEVICES.LP15, transport, { interChunkDelayMs: 0 });
    await printer.print(rgba(48, 16), MEDIA.CONTINUOUS_15MM);
    const bytes = concat(transport.writes);
    expect([...bytes.subarray(0, 15)].every(b => b === 0x00)).toBe(true);
    expect([...bytes.subarray(15, 19)]).toEqual([0x10, 0xff, 0xf1, 0x02]);
  });

  it('print() throws for D100 (jbig encoder deferred)', async () => {
    const transport = new FakeTransport();
    const printer = new WebMarklifePrinter(DEVICES.D100, transport);
    await expect(printer.print(rgba(8, 8), MEDIA.GAP_50X30)).rejects.toThrow(
      /D4|deferred|drivable/i,
    );
  });

  it('print() throws MediaNotSpecifiedError when no media is known', async () => {
    // A P12 with 12 mm tape must not be handed a 50 × 30 mm job on
    // the strength of a catalogue default.
    const transport = new FakeTransport();
    const printer = new WebMarklifePrinter(DEVICES.P12, transport);
    await expect(printer.print(rgba(48, 16))).rejects.toBeInstanceOf(MediaNotSpecifiedError);
    expect(transport.writes.length).toBe(0);
  });

  it('print() honours an explicit rotate override', async () => {
    const transport = new FakeTransport();
    const printer = new WebMarklifePrinter(DEVICES.S8, transport);
    // 64 × 16 turned on its side is a 16 × 64 raster with a different
    // header, so the override is visible in the bytes.
    await printer.print(rgba(64, 16), MEDIA.GAP_50X30, { rotate: 90 });
    const auto = new FakeTransport();
    await new WebMarklifePrinter(DEVICES.S8, auto).print(rgba(64, 16), MEDIA.GAP_50X30);
    expect(concat(transport.writes)).not.toEqual(concat(auto.writes));
  });

  it('createPreview() returns a single-plane preview', async () => {
    const transport = new FakeTransport();
    const printer = new WebMarklifePrinter(DEVICES.S8, transport);
    const result = await printer.createPreview(rgba(8, 8));
    expect(result.planes.length).toBe(1);
    expect(result.assumed).toBe(true);
  });

  it('getStatus() returns ready=true when connected', async () => {
    const transport = new FakeTransport();
    const printer = new WebMarklifePrinter(DEVICES.S8, transport);
    const status = await printer.getStatus();
    expect(status.ready).toBe(true);
    expect(status.errors).toEqual([]);
  });

  it('onStatus() polls getStatus() and delivers to the subscriber', async () => {
    vi.useFakeTimers();
    try {
      const transport = new FakeTransport();
      const printer = new WebMarklifePrinter(DEVICES.S8, transport);
      const cb = vi.fn();
      const stop = printer.onStatus(cb);
      await vi.advanceTimersByTimeAsync(0);
      expect(cb).toHaveBeenCalledTimes(1);
      expect(cb.mock.calls[0]?.[0]).toMatchObject({ ready: true });
      stop();
      await vi.advanceTimersByTimeAsync(10_000);
      expect(cb).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('close() closes the transport', async () => {
    const transport = new FakeTransport();
    const printer = new WebMarklifePrinter(DEVICES.S8, transport);
    await printer.close();
    expect(transport.connected).toBe(false);
  });
});

describe('send pacing', () => {
  // A real job spans packets; the S2 takes 95 bytes per packet and
  // drains at 30 ms. The failure this guards against is silent — a
  // job sent too fast is accepted and never printed — so the tests
  // pin the packet size and the pause, not just the bytes.
  it('splits the job at the registry packet ceiling', async () => {
    const transport = new FakeTransport();
    const printer = new WebMarklifePrinter(DEVICES.S2, transport, { interChunkDelayMs: 0 });
    // Noise does not compress, so the job is guaranteed to span packets.
    const image = rgba(384, 64);
    for (let i = 0; i < image.data.length; i += 4) {
      const v = (i * 2654435761) >>> 24;
      image.data[i] = image.data[i + 1] = image.data[i + 2] = v;
    }
    await printer.print(image, MEDIA.GAP_50X30);
    expect(transport.writes.length).toBeGreaterThan(1);
    for (const w of transport.writes) expect(w.length).toBeLessThanOrEqual(95);
    expect(transport.writes.some(w => w.length === 95)).toBe(true);
  });

  it('pauses between packets and not after the last', async () => {
    vi.useFakeTimers();
    try {
      // LP15: 95-byte ceiling, family-default 30 ms. An uncompressed
      // L11 raster of 12 B/row × 64 rows spans several packets.
      const unpaced = new FakeTransport();
      await new WebMarklifePrinter(DEVICES.LP15, unpaced, { interChunkDelayMs: 0 }).print(
        rgba(48, 64),
        MEDIA.CONTINUOUS_15MM,
      );
      const packets = unpaced.writes.length;
      expect(packets).toBeGreaterThanOrEqual(3);

      const transport = new FakeTransport();
      const printer = new WebMarklifePrinter(DEVICES.LP15, transport);
      const done = printer.print(rgba(48, 64), MEDIA.CONTINUOUS_15MM);
      await vi.advanceTimersByTimeAsync(0);
      for (let n = 1; n < packets; n++) {
        expect(transport.writes.length).toBe(n);
        await vi.advanceTimersByTimeAsync(29);
        expect(transport.writes.length).toBe(n);
        await vi.advanceTimersByTimeAsync(1);
      }
      expect(transport.writes.length).toBe(packets);
      // Resolves without a further wait after the last packet.
      await done;
    } finally {
      vi.useRealTimers();
    }
  });

  it('takes the pause from the engine capabilities', async () => {
    vi.useFakeTimers();
    try {
      const transport = new FakeTransport();
      // X2 declares interChunkDelayMs: 1 and no packet ceiling.
      const printer = new WebMarklifePrinter(DEVICES.X2, transport);
      const image = rgba(384, 64);
      for (let i = 0; i < image.data.length; i += 4) {
        const v = (i * 2654435761) >>> 24;
        image.data[i] = image.data[i + 1] = image.data[i + 2] = v;
      }
      const done = printer.print(image, MEDIA.GAP_50X30);
      await vi.advanceTimersByTimeAsync(0);
      const first = transport.writes.length;
      expect(first).toBe(1);
      expect(transport.writes[0]?.length).toBe(237);
      await vi.advanceTimersByTimeAsync(1);
      expect(transport.writes.length).toBe(2);
      await vi.advanceTimersByTimeAsync(10_000);
      await done;
    } finally {
      vi.useRealTimers();
    }
  });

  it('serialises a status poll behind an in-flight print', async () => {
    vi.useFakeTimers();
    try {
      const transport = new FakeTransport();
      const printer = new WebMarklifePrinter(DEVICES.LP15, transport);
      const order: string[] = [];
      const printing = printer.print(rgba(48, 16), MEDIA.CONTINUOUS_15MM).then(() => {
        order.push('print');
      });
      await vi.advanceTimersByTimeAsync(0);
      const polling = printer.getStatus().then(() => {
        order.push('status');
      });
      await vi.advanceTimersByTimeAsync(100);
      await Promise.all([printing, polling]);
      expect(order).toEqual(['print', 'status']);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Cross-runtime byte parity', () => {
  it('yxq job bytes are identical between core and web paths (same encoder)', async () => {
    const transport = new FakeTransport();
    const printer = new WebMarklifePrinter(DEVICES.S8, transport);
    await printer.print(rgba(48, 16), MEDIA.GAP_50X30);
    const webBytes = transport.writes[0]!;

    const { encodeYxqJob } = await import('@thermal-label/marklife-core');
    const { renderImage, ROTATE_DIRECTION, pickRotation } =
      await import('@thermal-label/marklife-core');
    const rotation = pickRotation(rgba(48, 16), MEDIA.GAP_50X30, ROTATE_DIRECTION);
    const bitmap = renderImage(rgba(48, 16), { dither: true, threshold: 128, rotate: rotation });
    const directBytes = encodeYxqJob(DEVICES.S8.engines[0] as never, {
      bitmap,
      media: MEDIA.GAP_50X30,
    });
    expect(webBytes).toEqual(directBytes);
  });
});
