import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist-web',
  },
  test: {
    exclude: ['**/node_modules/**', '**/e2e/**', '**/*.spec.ts'],
  },
});
