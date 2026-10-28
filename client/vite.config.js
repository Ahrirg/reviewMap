import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const backend = process.env.BACKEND_URL || 'http://localhost:3001';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // Category definitions are shared with the server.
      '@shared': path.resolve(import.meta.dirname, '../shared'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    fs: {
      // Needed to serve the out-of-package @shared import in dev.
      allow: ['..'],
    },
    proxy: {
      '/api': { target: backend, changeOrigin: false },
      '/uploads': { target: backend, changeOrigin: false },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
