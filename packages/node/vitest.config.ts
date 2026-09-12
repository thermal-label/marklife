import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  // Resolve the workspace dep directly to its source so tests don't
  // depend on a fresh `dist/` build. Without this alias, vitest reads
  // through the package's `exports.import` (`../core/dist/index.js`)
  // and any registry change requires `pnpm -r run build` before
  // tests pick it up — and CI, which tests before it builds, fails on
  // a clean checkout.
  resolve: {
    alias: {
      '@thermal-label/marklife-core': fileURLToPath(
        new URL('../core/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    coverage: {
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/__tests__/**', 'dist/**'],
      thresholds: {
        lines: 85,
        statements: 85,
        functions: 85,
        branches: 70,
      },
    },
  },
});
