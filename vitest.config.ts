import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      // `server-only` throws on import outside a React Server Component, which
      // is exactly what these node-environment tests are. The guard is a build
      // affordance for Next, not behaviour worth testing, so stub it out —
      // otherwise importing any router that reaches `src/server/auth/*` fails
      // before a single assertion runs.
      'server-only': new URL('./test/server-only-stub.ts', import.meta.url).pathname,
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
