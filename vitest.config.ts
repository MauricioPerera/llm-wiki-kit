import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/deno/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/cli/**', 'src/**/*.d.ts'],
      thresholds: {
        lines: 80,
        branches: 70
      }
    }
  }
});
