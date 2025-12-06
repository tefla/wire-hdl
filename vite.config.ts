import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig(({ command }) => {
  // Dev mode for web app
  if (command === 'serve') {
    return {
      optimizeDeps: {
        exclude: ['binaryen'],
      },
      test: {
        globals: true,
        environment: 'node',
      },
    };
  }

  // Build mode for library
  return {
    plugins: [
      dts({
        insertTypesEntry: true,
      }),
    ],
    build: {
      lib: {
        entry: resolve(__dirname, 'src/index.ts'),
        name: 'WireHDL',
        formats: ['es', 'cjs'],
        fileName: (format) => `index.${format === 'es' ? 'js' : 'cjs'}`,
      },
      sourcemap: true,
    },
    test: {
      globals: true,
      environment: 'node',
    },
  };
});
