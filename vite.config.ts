import { defineConfig } from 'vite';
import { resolve } from 'node:path';
export default defineConfig({
 base:'/gaussian-splat-viewer/',
 build:{rolldownOptions:{input:{viewer:resolve('index.html'),photos:resolve('spike/index.html'),trained:resolve('spike/viewer.html')}}},
 worker:{format:'es'},
 optimizeDeps:{exclude:['@banou/opencv-wasm']},
 server:{hmr:process.env.TRAINING_SPIKE==='1'?false:undefined,watch:{ignored:['**/test-results/**']}}
});
