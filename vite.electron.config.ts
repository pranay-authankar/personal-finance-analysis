import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  build: {
    outDir: 'dist-electron',
    emptyOutDir: true,
    target: 'node20',
    minify: false,
    lib: {
      entry: {
        main: path.resolve(import.meta.dirname, 'electron/main.ts'),
        preload: path.resolve(import.meta.dirname, 'electron/preload.ts')
      },
      formats: ['cjs'],
      fileName: (_format, entryName) => `${entryName}.cjs`
    },
    rollupOptions: {
      external: [
        'electron',
        'better-sqlite3-multiple-ciphers',
        /^node:.*/
      ]
    }
  }
});
