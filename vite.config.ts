import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Allow overriding base path for GitHub Pages deployments while keeping local dev at '/'
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  build: {
    outDir: 'dist-web',
  },
  test: {
    exclude: ['**/node_modules/**', '**/e2e/**', '**/*.spec.ts'],
  },
});
