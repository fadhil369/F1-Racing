import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  base: './', // Use relative paths for GitHub Pages
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: false,
  },
});
