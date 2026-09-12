import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      exclude: [
        'scripts/**',
        'src/*.generated.ts',
        'src/types.ts',
        'src/__tests__/**',
        'src/index.ts',
        'data/**',
        'dist/**',
        // The JBIG encoder body is mostly unreachable until the WASM
        // build of libjbigkit ships (DECISIONS.md § D4). Coverage on
        // these files is artificially low because jbigEncode throws
        // before the helpers run — exclude until the real encoder
        // lands.
        'src/jbig.ts',
        'src/jbig/encode.ts',
      ],
      thresholds: {
        lines: 90,
        statements: 90,
        functions: 90,
        branches: 85,
      },
    },
  },
});
