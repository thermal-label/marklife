/**
 * `marklife-escpos` local-only byte builders.
 *
 * Most ESC/POS directives are re-exported from
 * `@thermal-label/escpos-core@^0.2.1`. The builders below cover:
 *
 *   - `FF` (`0x0C`) — universal Epson form-feed; OOS in
 *     `escpos-core@0.2.1` (DECISIONS.md § D6).
 *   - `printerWake` — a six-NUL wake the family's ESC/POS path sends;
 *     not in any spec.
 */

/** Form feed (`FF` = `0x0C`). */
export const FORM_FEED: Uint8Array = new Uint8Array([0x0c]);

/** Form-feed builder for symmetry with the rest of the API surface. */
export function buildFormFeed(): Uint8Array {
  return new Uint8Array(FORM_FEED);
}

/**
 * Vendor "printer wake" preamble — six NUL bytes.
 *
 * Sent on open, before any ESC/POS directives, to wake the printer
 * from idle. Trivial to
 * emit; trivial for a non-marklife printer to ignore (NUL is a no-op
 * in ESC/POS).
 */
export function buildPrinterWake(): Uint8Array {
  return new Uint8Array(6);
}
