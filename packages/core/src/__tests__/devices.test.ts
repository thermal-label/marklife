import { describe, expect, it } from 'vitest';
import { DEVICES, REGISTRY_MARKLIFE, findDevice, findDeviceByName } from '../devices.js';

describe('REGISTRY_MARKLIFE', () => {
  it('has at least 15 entries after step-3 expansion', () => {
    expect(REGISTRY_MARKLIFE.devices.length).toBeGreaterThanOrEqual(15);
  });

  it('declares family marklife on every entry', () => {
    for (const entry of REGISTRY_MARKLIFE.devices) {
      expect(entry.family).toBe('marklife');
    }
  });

  it('every engine declares a supported dpi', () => {
    // 203 across the family, except the CPCL chassis, whose page
    // header declares 200.
    for (const entry of REGISTRY_MARKLIFE.devices) {
      for (const eng of entry.engines) {
        const expected = eng.protocol === 'marklife-cpcl' ? 200 : 203;
        expect(eng.dpi, entry.key).toBe(expected);
      }
    }
  });

  it('every engine declares headDots as a number', () => {
    for (const entry of REGISTRY_MARKLIFE.devices) {
      for (const eng of entry.engines) {
        expect(typeof eng.headDots).toBe('number');
        expect(eng.headDots).toBeGreaterThan(0);
      }
    }
  });
});

describe('DEVICES', () => {
  it('contains the 6 representative chassis', () => {
    expect(DEVICES.S8).toBeDefined();
    expect(DEVICES.D210).toBeDefined();
    expect(DEVICES.X2_BLE).toBeDefined();
    expect(DEVICES.D100).toBeDefined();
    expect(DEVICES.P15).toBeDefined();
    expect(DEVICES.LP15).toBeDefined();
  });

  it('binds X2_BLE to BLE Profile C (0xFD00)', () => {
    const x2 = DEVICES.X2_BLE;
    const gatt = x2.transports['bluetooth-gatt'];
    expect(gatt).toBeDefined();
    expect(gatt!.serviceUuid).toBe('0000fd00-0000-1000-8000-00805f9b34fb');
  });

  it('marks D100 unsupported (jbig encoder deferred)', () => {
    expect(DEVICES.D100.supportStatus).toBe('unsupported');
  });
});

describe('findDevice', () => {
  it('returns the entry for a known key', () => {
    expect(findDevice('S8')).toBe(DEVICES.S8);
  });

  it('returns undefined for an unknown key', () => {
    expect(findDevice('NONEXISTENT_MODEL')).toBeUndefined();
  });
});

describe('findDeviceByName', () => {
  it('matches exact namePrefix', () => {
    expect(findDeviceByName('S8')?.key).toBe('S8');
  });

  it('matches namePrefix-prefixed names', () => {
    expect(findDeviceByName('S8-1234')?.key).toBe('S8');
  });

  it('returns undefined for unmatched names', () => {
    expect(findDeviceByName('TOTALLY_UNKNOWN_MODEL_NAME')).toBeUndefined();
  });

  it('matches BLE namePrefix', () => {
    // X2 (SPP) and X2_BLE (BLE) both have namePrefix "X2"; longest-
    // prefix-first dispatch picks one deterministically (here, the
    // ordering depends on insertion, but the result is one of the X2
    // chassis — verify it's an X2 family entry).
    const result = findDeviceByName('X2-ABCD');
    expect(result?.engines[0]?.capabilities?.realSeries).toBe('X2');
  });

  it('disambiguates BARABOGOP12 (longer prefix) from a shorter "BAR" prefix', () => {
    expect(findDeviceByName('BARABOGOP12-ABCD')?.key).toBe('BARABOGOP12');
  });

  it('finds AbleMark M50 by namePrefix and routes via S2 protocol id', () => {
    const m50 = findDeviceByName('M50-1234');
    expect(m50?.key).toBe('M50_BY_S2');
    expect(m50?.engines[0]?.capabilities?.protocolId).toBe(2);
  });
});
