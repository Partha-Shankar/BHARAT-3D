import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // Long-lived, separately cached vendor chunks: the 3D engine and the map load in parallel with the app.
        manualChunks: {
          three: ['three'],
          maplibre: ['maplibre-gl'],
          react: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query', 'zustand', 'axios'],
        },
      },
    },
  },
});
