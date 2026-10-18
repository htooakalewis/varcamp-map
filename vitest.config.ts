import { configDefaults, defineConfig } from 'vitest/config';

// Native ops MJS tests run under `npm run test:node`; all other tests in
// the two owned roots keep Vitest's supported test/spec filename grammar.
export default defineConfig({
  test: {
    include: [
      'tests/**/*.{test,spec}.?(c|m)[jt]s?(x)',
      'ops/tests/**/*.{test,spec}.?(c|m)[jt]s?(x)',
    ],
    exclude: [...configDefaults.exclude, 'ops/tests/*.test.mjs'],
  },
});
