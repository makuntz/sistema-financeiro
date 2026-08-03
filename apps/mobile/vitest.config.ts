import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./src/test/setup.node.ts'],
    pool: 'threads',
    fileParallelism: false,
    dangerouslyIgnoreUnhandledErrors: true,
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    env: {
      EXPO_PUBLIC_API_URL: 'http://localhost:3333',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
