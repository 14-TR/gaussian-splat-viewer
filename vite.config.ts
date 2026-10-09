import { defineConfig } from 'vite';
export default defineConfig({ base: '/gaussian-splat-viewer/', optimizeDeps: { exclude: ['@banou/opencv-wasm'] }, server:{hmr:process.env.TRAINING_SPIKE==='1'?false:undefined,watch:{ignored:['**/test-results/**']}} });
