import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('vite/preload-helper')) return 'react-vendor';
          if (id.includes('node_modules/three')) return 'three-vendor';
          if (id.includes('node_modules/@react-three')) return 'r3f-vendor';
          if (id.includes('node_modules/react') || id.includes('node_modules/scheduler') || id.includes('node_modules/zustand') || id.includes('node_modules/lucide-react')) {
            return 'react-vendor';
          }
        },
      },
    },
  },
});