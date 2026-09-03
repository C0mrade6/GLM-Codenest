import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Build web workers as ES modules so CDN imports keep working in production.
  worker: { format: 'es' },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:5000', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:5000', ws: true, changeOrigin: true },
    },
  },
  build: { outDir: 'dist', chunkSizeWarningLimit: 1500 },
});
