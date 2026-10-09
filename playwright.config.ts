import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', timeout: 120000, workers: 1,
  use: { baseURL: process.env.VIEWER_URL ?? 'http://127.0.0.1:5173/gaussian-splat-viewer/', browserName: 'chromium', launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } },
  webServer: process.env.VIEWER_URL ? undefined : { command: 'npm run dev', url: 'http://127.0.0.1:5173/gaussian-splat-viewer/', reuseExistingServer: !process.env.CI }
});
