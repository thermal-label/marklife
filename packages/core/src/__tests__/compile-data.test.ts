import { describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const CORE_DIR = resolve(TEST_DIR, '../..');

describe('compile-data.mjs', () => {
  it('runs cleanly against the v1 representative entries', () => {
    const result = execSync('node scripts/compile-data.mjs', {
      cwd: CORE_DIR,
      encoding: 'utf8',
    });
    expect(result).toMatch(/\[compile-data\] OK/);
    expect(result).toMatch(/\d+ devices \+ 19 media/);
  });
});
