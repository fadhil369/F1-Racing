import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  base: './', // Use relative path for portability
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: true, // Automatically open the browser
  },
});
