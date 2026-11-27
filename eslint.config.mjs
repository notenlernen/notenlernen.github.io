import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  { ignores: ['dist/**', 'playwright-report/**', 'test-results/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['scripts/worker.js'],
    languageOptions: { globals: { self: 'readonly', caches: 'readonly', fetch: 'readonly', URL: 'readonly', BUILD: 'readonly' } },
  },
  {
    files: ['*.mjs', 'scripts/*.mjs', 'tests/*.mjs'],
    languageOptions: { globals: { process: 'readonly', URL: 'readonly', document: 'readonly', navigator: 'readonly', localStorage: 'readonly', indexedDB: 'readonly', setTimeout: 'readonly' } },
  },
];
