import { fileURLToPath } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    /*
     * shared/ sits outside this package and has no node_modules of its own, so the
     * dev server cannot resolve the bare zod import inside shared/contract.ts from
     * there. Pointing at the ESM entry the package's exports map names, rather than
     * the directory, because an alias to a directory bypasses that map.
     */
    alias: {
      zod: fileURLToPath(new URL('./node_modules/zod/index.js', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
