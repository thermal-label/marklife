/**
 * Status reply parser shared across marklife sub-engines.
 *
 * YXQ-stream replies carry a vendor shape (opcode + length + payload
 * + tail) — handled here. The JBIG and ESC/POS paths use real Epson
 * realtime status; those replies are parsed by `escpos-core`'s
 * `parseRealtimeStatus` and this module then classifies the
 * vendor-extended bits.
 *
 * **Coverage.** The decoder is structural — length checks and
 * opcode-byte dispatch — not byte-accurate against a reference
 * fixture. The one reply we have observed directly is the single
 * `0xAA` ack an S2 sends after accepting a job (bench, 2026-09-11).
 * Promote individual classifiers to `verified` as captured replies
 * arrive.
 */

import type { PrinterError } from '@thermal-label/contracts';
import type { MarklifeStatus } from './types.js';

function err(code: string, message: string): PrinterError {
  return { code, message };
}

/**
 * YXQ-stream status reply opcodes.
 *
 * Best-effort: each query claims its own leading byte rather than
 * sharing a documented enum, so this table is inferred and awaits
 * capture against hardware. The query commands themselves are
 * `1F 20 00` (status), `1F 80 00` (paper type) and the `10 FF 20 Fx`
 * info family.
 */
export const YXQ_QUERY_OPCODES = {
  battery: 0x10,
  firmware: 0x11,
  printerStatus: 0x12,
  printerPrepare: 0x13,
} as const;

/**
 * Parse a YXQ-stream reply.
 *
 * The vendor framing is opcode + length + payload + tail. Without a
 * hardware capture to anchor the byte layout, this returns a
 * structural status with `rawBytes` filled and `errors` listing the
 * unrecognised opcode.
 */
export function parseYxqStatus(bytes: Uint8Array): MarklifeStatus {
  const status: MarklifeStatus = {
    ready: bytes.length > 0,
    mediaLoaded: true,
    paperOut: false,
    errors: [],
    rawBytes: new Uint8Array(bytes),
  };

  if (bytes.length === 0) {
    status.ready = false;
    status.errors.push(err('empty_reply', 'empty status reply'));
    return status;
  }

  const opcode = bytes[0] ?? 0;
  switch (opcode) {
    case YXQ_QUERY_OPCODES.battery:
      if (bytes.length >= 2) {
        const level = bytes[1] ?? 0;
        if (level <= 100) status.batteryLevel = level;
      }
      break;
    case YXQ_QUERY_OPCODES.firmware:
      if (bytes.length >= 2) {
        const len = bytes[1] ?? 0;
        if (len > 0 && bytes.length >= 2 + len) {
          status.firmwareVersion = new TextDecoder().decode(bytes.subarray(2, 2 + len));
        }
      }
      break;
    case YXQ_QUERY_OPCODES.printerStatus:
    case YXQ_QUERY_OPCODES.printerPrepare:
      if (bytes.length >= 2) {
        const flags = bytes[1] ?? 0;
        status.paperOut = (flags & 0x01) !== 0;
        if (status.paperOut) {
          status.mediaLoaded = false;
          status.errors.push(err('no_media', 'paper out'));
        }
        status.headOverTemp = (flags & 0x02) !== 0;
        if (status.headOverTemp) status.errors.push(err('head_overtemp', 'head over temperature'));
        if ((flags & 0x04) !== 0) status.errors.push(err('cover_open', 'cover open'));
      }
      break;
    default:
      status.errors.push(
        err('unrecognised_opcode', `unrecognised opcode 0x${opcode.toString(16).padStart(2, '0')}`),
      );
  }

  status.ready = !status.paperOut && !status.headOverTemp && status.errors.length === 0;
  return status;
}
