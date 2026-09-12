import { describe, expect, it } from 'vitest';
import { UnsupportedOperationError } from '@thermal-label/contracts';
import { jbigEncode } from '../jbig.js';

describe('jbigEncode (deferred)', () => {
  it('throws UnsupportedOperationError per DECISIONS.md § D4', () => {
    // Input contract is a packed 1-bpp plane — ceil(w/8) * h bytes,
    // not w * h greyscale bytes.
    const plane = new Uint8Array(Math.ceil(16 / 8) * 16);
    expect(() => jbigEncode(plane, 16, 16)).toThrow(UnsupportedOperationError);
  });

  it('error message references the decisions doc', () => {
    expect(() => jbigEncode(new Uint8Array(0), 0, 0)).toThrow(/D4/);
  });
});
