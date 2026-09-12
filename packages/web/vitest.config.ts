import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  // Resolve the workspace dep directly to its source so tests don't
  // depend on a fresh `dist/` build. See packages/node/vitest.config.ts
  // for the rationale.
  resolve: {
    alias: {
      '@thermal-label/marklife-core': fileURLToPath(
        new URL('../core/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'jsdom',
    coverage: {
      // jsdom doesn't ship Web Serial / Web Bluetooth. The factory
      // happy-paths (`requestPrinter*`) require a real browser via
      // Playwright — flagged for a future test pass. Index barrel
      // is re-exports only.
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/__tests__/**', 'dist/**'],
      thresholds: {
        lines: 70,
        statements: 70,
        functions: 70,
        branches: 70,
      },
    },
  },
});
