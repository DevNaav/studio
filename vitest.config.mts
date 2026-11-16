import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Dates in tests are written as India dates; keep "today" stable everywhere.
    env: { TZ: 'Asia/Kolkata' },
  },
});
