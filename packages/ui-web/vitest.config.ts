import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    pool: 'threads',
    fileParallelism: false,
    dangerouslyIgnoreUnhandledErrors: true,
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
  },
  esbuild: {
    jsx: 'automatic',
  },
});
