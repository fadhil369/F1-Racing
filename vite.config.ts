import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  base: '/F1-Racing/', // Match repository name
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
