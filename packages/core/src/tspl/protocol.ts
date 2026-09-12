/**
 * `marklife-tspl` local-only byte builders.
 *
 * Most TSPL II directives are re-exported from `@thermal-label/tspl-core@^0.2.0`.
 * The builders below cover the upstream-gap (`SET GAP`) until the
 * corresponding PR lands in `tspl-core@0.3.0` (DECISIONS.md § D6).
 */

const enc = new TextEncoder();
const CRLF = '\r\n';

/**
 * `SET GAP <ON|OFF>\r\n` — TSC TSPL II spec.
 *
 * Sets gap mode. Not in `tspl-core@0.2.0`; flagged upstream.
 */
export function buildSetGap({ on }: { on: boolean }): Uint8Array {
  return enc.encode(`SET GAP ${on ? 'ON' : 'OFF'}${CRLF}`);
}

/**
 * `SET GAP AUTO\r\n` — TSC TSPL II spec extended form (auto-sense).
 */
export function buildSetGapAuto(): Uint8Array {
  return enc.encode(`SET GAP AUTO${CRLF}`);
}

/**
 * `SET GAP <gap>,<offset>\r\n` — TSC TSPL II spec extended form.
 *
 * `gap` and `offset` are in mm.
 */
export function buildSetGapDistances(gap: number, offset: number): Uint8Array {
  return enc.encode(`SET GAP ${String(gap)} mm,${String(offset)} mm${CRLF}`);
}
