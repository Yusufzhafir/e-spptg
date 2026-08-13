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
      // Tes tidak boleh bisa menyentuh database sungguhan. Root `.env` di host
      // deploy membuat `DATABASE_URL` produksi ikut terbaca `dotenv/config` di
      // dalam `db.ts`, dan jalur yang tidak di-mock (middleware audit, push)
      // lalu menulis ke sana tanpa suara — lihat test/db-stub.ts.
      '@/server/db/db': new URL('./test/db-stub.ts', import.meta.url).pathname,
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
