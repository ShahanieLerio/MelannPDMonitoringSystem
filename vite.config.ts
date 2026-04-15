/// <reference types="vitest" />
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './setupTests.ts',
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        include: [
          'components/**/*.{ts,tsx}',
          'services/**/*.{ts,tsx}',
          'types.ts',
          'constants.tsx'
        ],
        exclude: [
          'node_modules/**',
          'dist/**',
          '**/*.test.{ts,tsx}',
          '**/*.spec.{ts,tsx}',
          'setupTests.ts',
          'vite.config.ts',
          'declarations.d.ts'
        ],
        thresholds: {
          lines: 90,
          functions: 90,
          branches: 90,
          statements: 90
        }
      }
    },
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.DATABASE_URL': JSON.stringify(env.DATABASE_URL)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
