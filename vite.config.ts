import { defineConfig } from 'vite';
export default defineConfig({ base: '/gaussian-splat-viewer/', optimizeDeps: { exclude: ['@banou/opencv-wasm'] } });
