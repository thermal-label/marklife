import mbtech from '@mbtech-nl/eslint-config';

export default [
  ...mbtech,
  {
    rules: {
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/*.d.ts',
      '**/vitest.config.ts',
      '**/scripts/**',
      'docs/api/**',
      'docs/.vitepress/**',
    ],
  },
];
