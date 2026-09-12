/**
 * YXQ-stream byte builders.
 *
 * Every command in this family is prefixed `0x1F`. Job structure and
 * the per-id variations are documented in `docs/protocol/yxq.md`;
 * `protocolId` here matches `engines[].capabilities.protocolId`.
 *
 * The `0x1F` prefix is bench-confirmed: an earlier revision emitted
 * `0x1D` (GS) for the raster header, density, enable, stop and
 * paper-type commands, and the S2 accepted the job in silence and
 * printed nothing.
 *
 * Only protocol id 2 (the S2) is bench-confirmed end to end. Every
 * other id's byte table is inference from our own wire analysis of
 * the family — each builder says which ids it is claimed for, and
 * nothing outside id 2 has been printed against.
 */

/** Raster header opcode pair `0x1F 0x10`. */
export const YXQ_RASTER_HEADER = new Uint8Array([0x1f, 0x10]);

/**
 * Media classes the paper-type and position commands distinguish.
 *
 * `gap` covers die-cut and gap stock — one sensor mode serves both.
 * The two black-mark modes are separate sensor settings; no media in
 * the catalogue selects them today, so those paths are untested.
 */
export type YxqPaperKind = 'continuous' | 'gap' | 'black-mark' | 'black-mark-2';

/** ESC J — feed n dots (used for trailing line-feed advance). */
export function buildEscFeedDots(dots: number): Uint8Array {
  return new Uint8Array([0x1b, 0x4a, dots & 0xff]);
}

/**
 * Wakeup sequence — protocol-id-dependent run of NUL bytes.
 *
 * - id 1, 11 → 15 NUL bytes
 * - id 3, 4, 5, 8 → 6 NUL bytes
 * - others → none
 *
 * id 5 only wakes on black-mark stock; the caller gates it (see
 * `encode.ts`). id 9 has no wakeup at all — its first bytes on the
 * wire are the paper-type / density prelude.
 */
export function buildYxqWakeup(protocolId: number): Uint8Array {
  if (protocolId === 1 || protocolId === 11) {
    return new Uint8Array(15);
  }
  if (protocolId === 3 || protocolId === 4 || protocolId === 5 || protocolId === 8) {
    return new Uint8Array(6);
  }
  return new Uint8Array(0);
}

/**
 * Enable-printer command — protocol-id-dependent.
 *
 * - id 1, 5 → `10 FF F1 03`
 * - id 2 → `10 FF F1 02`
 * - id 3, 4, 8, 9, 11 → `1F C0 01 00`
 * - others → none
 */
export function buildYxqEnablePrinter(protocolId: number): Uint8Array {
  switch (protocolId) {
    case 1:
    case 5:
      return new Uint8Array([0x10, 0xff, 0xf1, 0x03]);
    case 2:
      return new Uint8Array([0x10, 0xff, 0xf1, 0x02]);
    case 3:
    case 4:
    case 8:
    case 9:
    case 11:
      return new Uint8Array([0x1f, 0xc0, 0x01, 0x00]);
    default:
      return new Uint8Array(0);
  }
}

/**
 * Stop command — protocol-id-dependent.
 *
 * - id 1, 2 → `10 FF F1 45`
 * - id 3, 4, 8, 9, 11 → `1F C0 01 01`
 * - id 5 → `10 FF FE 45`
 * - others → none
 */
export function buildYxqStop(protocolId: number): Uint8Array {
  switch (protocolId) {
    case 1:
    case 2:
      return new Uint8Array([0x10, 0xff, 0xf1, 0x45]);
    case 3:
    case 4:
    case 8:
    case 9:
    case 11:
      return new Uint8Array([0x1f, 0xc0, 0x01, 0x01]);
    case 5:
      return new Uint8Array([0x10, 0xff, 0xfe, 0x45]);
    default:
      return new Uint8Array(0);
  }
}

/**
 * Density command — protocol-id-dependent.
 *
 * - id 1 → `1F 70 01 density`
 * - id 4 → `10 FF 10 00 density`
 * - id 5 → `1F 70 01 density`
 * - id 2, 3, 8, 9 → `1F 70 i8 density`
 *
 * `i8` is the register slot — see `yxqDensitySlot`.
 */
export function buildYxqDensity(protocolId: number, i8: number, density: number): Uint8Array {
  const d = density & 0xff;
  switch (protocolId) {
    case 1:
    case 5:
      return new Uint8Array([0x1f, 0x70, 0x01, d]);
    case 4:
      return new Uint8Array([0x10, 0xff, 0x10, 0x00, d]);
    case 2:
    case 3:
    case 8:
    case 9:
      return new Uint8Array([0x1f, 0x70, i8 & 0xff, d]);
    default:
      return new Uint8Array(0);
  }
}

/**
 * Register slot for `1F 70 <slot> <density>`.
 *
 * Ids 3, 8 and 9 address slot `02`; the rest of the family addresses
 * slot `01`. Address the wrong slot and the write lands somewhere the
 * head never reads — the job prints at the printer's stored density
 * and the operator's light/dark choice is silently discarded.
 *
 * Slot `01` for id 2 is bench-confirmed; slot `02` for 3 / 8 / 9 is
 * inference from wire analysis.
 */
export function yxqDensitySlot(protocolId: number): number {
  return protocolId === 3 || protocolId === 8 || protocolId === 9 ? 2 : 1;
}

/**
 * Density-gear command — only emitted by id 5 (D210).
 *
 * Wire: `[0x10, 0xFF, 0x10, 0x00, gear]`.
 */
export function buildYxqDensityGear(protocolId: number, gear: number): Uint8Array {
  if (protocolId !== 5) return new Uint8Array(0);
  return new Uint8Array([0x10, 0xff, 0x10, 0x00, gear & 0xff]);
}

/**
 * Paper-type command for ids 5, 7, 12 — `1F 80 i8 <sensorMode>`.
 *
 * `paperType` is the numeric code, mapped to a sensor-mode byte by
 * the table below. Pick the code with `yxqPaperTypeCode` rather than
 * hard-coding one: the codes are not ordered and the sensor modes
 * they select are easy to pair up backwards.
 */
export function buildYxqPaperType(protocolId: number, i8: number, paperType: number): Uint8Array {
  if (protocolId !== 5 && protocolId !== 7 && protocolId !== 12) {
    return new Uint8Array(0);
  }
  let mapped = 0;
  switch (paperType) {
    case 1:
      mapped = 0x10;
      break;
    case 2:
      mapped = 0x20;
      break;
    case 10:
      mapped = 0x40;
      break;
    case 20:
      mapped = 0x30;
      break;
    default:
      return new Uint8Array(0);
  }
  return new Uint8Array([0x1f, 0x80, i8 & 0xff, mapped]);
}

/**
 * Paper-type code for the `buildYxqPaperType` table (ids 5, 7, 12).
 *
 * Continuous is code 1 (sensor mode `0x10`) and gap is code 20
 * (sensor mode `0x30`). Getting this pair backwards is not a cosmetic
 * error: `0x40` is a black-mark sensor mode, so continuous stock sent
 * with a black-mark code makes the head hunt for a mark that never
 * arrives and the job stalls with the label still under the burn
 * line. Inference from wire analysis; not bench-confirmed.
 */
export function yxqPaperTypeCode(kind: YxqPaperKind): number {
  switch (kind) {
    case 'continuous':
      return 1;
    case 'black-mark':
      return 2;
    case 'black-mark-2':
      return 10;
    default:
      return 20; // gap / die-cut
  }
}

/**
 * Paper-type prelude for ids 3, 8, 9 — `1F 80 02 <sensorMode>`.
 *
 * A different table from `buildYxqPaperType`, on a different register
 * slot: gap `0x20`, black-mark `0x30`, black-mark-2 `0x40`.
 * Continuous stock sends no prelude at all. Borrowing the slot-1
 * table here selects a black-mark sensor on gap stock and the job
 * never registers. Inference from wire analysis; not bench-confirmed.
 */
export function buildYxqPaperTypeSensor(protocolId: number, kind: YxqPaperKind): Uint8Array {
  if (protocolId !== 3 && protocolId !== 8 && protocolId !== 9) {
    return new Uint8Array(0);
  }
  let mode = 0;
  switch (kind) {
    case 'gap':
      mode = 0x20;
      break;
    case 'black-mark':
      mode = 0x30;
      break;
    case 'black-mark-2':
      mode = 0x40;
      break;
    default:
      return new Uint8Array(0); // continuous — no prelude
  }
  return new Uint8Array([0x1f, 0x80, 0x02, mode]);
}

/**
 * `1F 11 51` — seek forward to the next gap.
 *
 * Ids 3, 8 and 9 send it between the enable and the raster on gap
 * stock, so the head starts the burn at a label edge instead of
 * wherever the last job left the media.
 */
export function buildYxqGapSeek(): Uint8Array {
  return new Uint8Array([0x1f, 0x11, 0x51]);
}

/**
 * `1F 11 51 <stepLo> <stepHi>` — the same seek with an explicit
 * 16-bit little-endian step. id 5 sends it with step 0 immediately
 * after the paper-type byte, which retracts the media to the sensor
 * before the head starts.
 */
export function buildYxqRetract(steps = 0): Uint8Array {
  return new Uint8Array([0x1f, 0x11, 0x51, steps & 0xff, (steps >> 8) & 0xff]);
}

/**
 * `1F 11 50` — park the media at the tear-off edge. Sent on gap
 * stock by ids 3, 8, 9 (after the stop) and unconditionally by id 5
 * (before the stop).
 */
export function buildYxqParkPosition(): Uint8Array {
  return new Uint8Array([0x1f, 0x11, 0x50]);
}

/**
 * `1F 11 00` — the continuous-stock counterpart of `1F 11 50`, sent
 * after the stop by ids 8 and 9. There is no tear-off edge to park
 * against on continuous stock.
 */
export function buildYxqHomePosition(): Uint8Array {
  return new Uint8Array([0x1f, 0x11, 0x00]);
}

/**
 * Post-raster position — `1F 12 20 00` on gap stock, `1F 12 00 00`
 * on continuous.
 *
 * id 3 sends it on gap stock only; ids 8 and 9 send it on both.
 * Omitting it leaves the label sitting under the head — the raster
 * burns, nothing advances, and the job reads as "connected but
 * nothing prints". Inference from wire analysis; not bench-confirmed.
 */
export function buildYxqPostRasterPosition(protocolId: number, kind: YxqPaperKind): Uint8Array {
  if (protocolId !== 3 && protocolId !== 8 && protocolId !== 9) {
    return new Uint8Array(0);
  }
  if (kind === 'continuous') {
    return protocolId === 3 ? new Uint8Array(0) : new Uint8Array([0x1f, 0x12, 0x00, 0x00]);
  }
  return new Uint8Array([0x1f, 0x12, 0x20, 0x00]);
}

/**
 * Wide feed — `1B 4A <stepLo> <stepHi> 00`.
 *
 * A 16-bit little-endian step plus a trailing NUL. Ids 3, 5 and 8
 * use this form on continuous stock. The 3-byte `1B 4A <step>` form
 * (`buildEscFeedDots` / `buildYxqPrintLineDots`) is a different
 * command with a different argument width — id 2 is the only id
 * confirmed to take it, and sending the short form where the wide
 * one is expected leaves two argument bytes to be read as the next
 * opcode.
 */
export function buildYxqFeedSteps(steps: number): Uint8Array {
  return new Uint8Array([0x1b, 0x4a, steps & 0xff, (steps >> 8) & 0xff, 0x00]);
}

/**
 * `1D 0C` — run the stock forward to the next gap.
 *
 * In the vocabulary of ids 2, 4, 5 and 11 only. id 3 has no `1D 0C`;
 * it closes a page with a position command after the stop instead.
 */
export function buildYxqPositionToGap(): Uint8Array {
  return new Uint8Array([0x1d, 0x0c]);
}

/**
 * Print-line-dots advance — only emitted by ids 1, 4, 11.
 *
 * Wire: `[0x1B, 0x4A, dots]` (ESC J n). id 5 is in the same command
 * family but composes its own postlude (`buildYxqFeedSteps`), so it
 * never routes through here.
 */
export function buildYxqPrintLineDots(protocolId: number, dots: number): Uint8Array {
  if (protocolId !== 1 && protocolId !== 4 && protocolId !== 11) {
    return new Uint8Array(0);
  }
  return new Uint8Array([0x1b, 0x4a, dots & 0xff]);
}

/**
 * Page advance for id 2 (the S2) — bench-confirmed.
 *
 *   - gap / die-cut stock: `1D 0C` (GS FF) after every copy, which
 *     runs the stock forward to the next gap.
 *   - continuous stock: `1B 4A 64` (ESC J 100) once, after the final
 *     copy, to clear the printed area past the head.
 *
 * Without this the S2 composes a valid job that never advances, so
 * the label stays under the head and reads as "connected but nothing
 * prints".
 *
 * Scope is deliberately id 2. It once served id 3 as well, on the
 * assumption that the two compressed ids closed a page the same way;
 * they do not — neither the `1D 0C` nor the 3-byte feed is in id 3's
 * vocabulary. Ids 4 and 11 close a page with `buildYxqPrintLineDots`
 * and id 5 with its own postlude.
 *
 * `isFinalCopy` only matters for continuous stock.
 */
export function buildYxqPageAdvance(
  protocolId: number,
  kind: YxqPaperKind,
  isFinalCopy: boolean,
): Uint8Array {
  if (protocolId !== 2) return new Uint8Array(0);
  if (kind === 'continuous') {
    return isFinalCopy ? buildEscFeedDots(100) : new Uint8Array(0);
  }
  return buildYxqPositionToGap();
}

/**
 * Build the YXQ-stream raster header for a `widthBytes × heightDots`
 * tile with `payloadLen` zlib-compressed payload bytes.
 *
 * Wire layout:
 *
 *   1F 10 widthBytesHi widthBytesLo heightHi heightLo
 *         payloadLenB3 payloadLenB2 payloadLenB1 payloadLenB0
 *
 * — 10 bytes total, followed by `payloadLen` payload bytes.
 *
 * `widthBytes` rounds up: `ceil(widthPx / 8)`.
 */
export function buildYxqRasterHeader(
  widthBytes: number,
  heightDots: number,
  payloadLen: number,
): Uint8Array {
  return new Uint8Array([
    0x1f,
    0x10,
    (widthBytes >> 8) & 0xff,
    widthBytes & 0xff,
    (heightDots >> 8) & 0xff,
    heightDots & 0xff,
    (payloadLen >> 24) & 0xff,
    (payloadLen >> 16) & 0xff,
    (payloadLen >> 8) & 0xff,
    payloadLen & 0xff,
  ]);
}

/**
 * Uncompressed raster header — `1D 76 30 <mode> <wLo> <wHi> <hLo> <hHi>`.
 *
 * id 9's raster command. Three things differ from the `1F 10`
 * header and all three are load-bearing: the fields are
 * **little-endian**, there is no payload-length field, and the 1-bpp
 * rows that follow are raw — zlib-wrapping them produces a page of
 * noise. `mode` is 0.
 *
 * Same shape as the `l11` sub-engine's `GS v 0` header; kept
 * separate because the two engines' framing may diverge.
 */
export function buildYxqRawRasterHeader(
  widthBytes: number,
  heightDots: number,
  mode = 0,
): Uint8Array {
  return new Uint8Array([
    0x1d,
    0x76,
    0x30,
    mode & 0xff,
    widthBytes & 0xff,
    (widthBytes >> 8) & 0xff,
    heightDots & 0xff,
    (heightDots >> 8) & 0xff,
  ]);
}

/** Concatenate a list of byte arrays into one. */
export function concatBytes(...parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}
