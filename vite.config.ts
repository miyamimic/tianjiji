import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: __dirname,
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
  },
  build: {
    rollupOptions: {
      input: './index.html',
    },
  },
  optimizeDeps: {
    entries: ['./index.html'],
    exclude: ['lucide-react'],
  },
});
