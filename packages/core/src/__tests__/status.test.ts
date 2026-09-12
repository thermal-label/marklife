import { describe, expect, it } from 'vitest';
import { parseYxqStatus, YXQ_QUERY_OPCODES } from '../status.js';

describe('parseYxqStatus', () => {
  it('flags an empty reply as not-ready', () => {
    const status = parseYxqStatus(new Uint8Array());
    expect(status.ready).toBe(false);
    expect(status.errors[0]?.code).toBe('empty_reply');
  });

  it('decodes a battery reply', () => {
    const reply = new Uint8Array([YXQ_QUERY_OPCODES.battery, 73]);
    const status = parseYxqStatus(reply);
    expect(status.batteryLevel).toBe(73);
  });

  it('decodes a firmware reply', () => {
    const versionStr = '3.7.2';
    const versionBytes = new TextEncoder().encode(versionStr);
    const reply = new Uint8Array([
      YXQ_QUERY_OPCODES.firmware,
      versionBytes.length,
      ...versionBytes,
    ]);
    const status = parseYxqStatus(reply);
    expect(status.firmwareVersion).toBe(versionStr);
  });

  it('decodes a paper-out flag', () => {
    const reply = new Uint8Array([YXQ_QUERY_OPCODES.printerStatus, 0x01]);
    const status = parseYxqStatus(reply);
    expect(status.paperOut).toBe(true);
    expect(status.ready).toBe(false);
  });

  it('decodes a head-overtemp flag', () => {
    const reply = new Uint8Array([YXQ_QUERY_OPCODES.printerStatus, 0x02]);
    const status = parseYxqStatus(reply);
    expect(status.headOverTemp).toBe(true);
    expect(status.ready).toBe(false);
  });

  it('decodes a cover-open error', () => {
    const reply = new Uint8Array([YXQ_QUERY_OPCODES.printerStatus, 0x04]);
    const status = parseYxqStatus(reply);
    expect(status.errors.some(e => e.code === 'cover_open')).toBe(true);
    expect(status.ready).toBe(false);
  });

  it('decodes a clean ready status', () => {
    const reply = new Uint8Array([YXQ_QUERY_OPCODES.printerStatus, 0x00]);
    const status = parseYxqStatus(reply);
    expect(status.ready).toBe(true);
    expect(status.paperOut).toBe(false);
    expect(status.errors).toEqual([]);
  });

  it('flags unrecognised opcodes', () => {
    const reply = new Uint8Array([0xff, 0x42]);
    const status = parseYxqStatus(reply);
    expect(status.errors[0]?.code).toBe('unrecognised_opcode');
  });
});
