import { describe, expect, it } from 'vitest';
import { MarklifeDiscovery, discovery } from '../discovery.js';

describe('MarklifeDiscovery', () => {
  it('exposes family marklife', () => {
    expect(new MarklifeDiscovery().family).toBe('marklife');
  });

  it('listPrinters returns empty (no auto-enumeration in v1)', async () => {
    expect(await discovery.listPrinters()).toEqual([]);
  });

  it('openPrinter throws when host is provided (no TCP transport)', async () => {
    await expect(discovery.openPrinter({ host: '192.168.1.1' })).rejects.toThrow(/no TCP/);
  });

  it('openPrinter does not open USB, and says where to go instead', async () => {
    // The P12 and P15 do expose USB; this surface just does not open
    // it, so the message has to point at the transport that does.
    await expect(discovery.openPrinter({ vid: 0x0922, pid: 0x0020 })).rejects.toThrow(
      /does not open USB/,
    );
  });

  it('openPrinter throws when no options are provided', async () => {
    await expect(discovery.openPrinter({})).rejects.toThrow(/serialPath.*deviceKey/);
  });

  it('openBluetoothSpp throws on unknown deviceKey', async () => {
    await expect(
      discovery.openBluetoothSpp({
        serialPath: '/dev/null',
        deviceKey: 'NOT_A_KEY' as never,
      }),
    ).rejects.toThrow(/not found in registry/);
  });

  it('openBluetoothGatt always throws (deferred)', async () => {
    await expect(discovery.openBluetoothGatt({ deviceKey: 'X2_BLE' })).rejects.toThrow(
      /not wired in v1/,
    );
  });
});
