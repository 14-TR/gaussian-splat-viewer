import { defineConfig } from '@playwright/test';
const remote=process.env.VIEWER_URL;
const built=process.env.TEST_BUILD==='1';
const base=remote??`http://127.0.0.1:${built?4173:5173}/gaussian-splat-viewer/`;
if(built&&!remote)process.env.VIEWER_URL=base;
export default defineConfig({
 testDir:'./tests',timeout:120000,workers:1,
 use:{baseURL:base,browserName:'chromium',launchOptions:{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}},
 webServer:remote?undefined:{command:built?'npm run preview -- --port 4173':'npm run dev',url:base,reuseExistingServer:!process.env.CI}
});
