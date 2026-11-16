import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Tests that need the Firebase emulator (database rules, backup/restore).
// Run with: npm run test:emulator
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { include: ['tests-emulator/**/*.test.ts'], environment: 'node', testTimeout: 30000, hookTimeout: 30000, fileParallelism: false },
});
