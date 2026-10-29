import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
const executablePath = process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
export default defineConfig({
  testDir: './tests', testMatch: '**/*.spec.js', fullyParallel: false,
  workers: 1, timeout: 30_000, expect: { timeout: 5000 }, reporter: 'list',
  outputDir: 'test-results',
  webServer: [
    { command: 'npm run dev -- --port 5175 --strictPort', url: 'http://127.0.0.1:5175/', reuseExistingServer: !process.env.CI },
    { command: 'npm run build:standalone && npm run preview -- --port 4175 --strictPort', url: 'http://127.0.0.1:4175/', reuseExistingServer: !process.env.CI },
    { command: 'npm run build:pages && npm run preview:pages', url: 'http://127.0.0.1:4275/wordjourney/', reuseExistingServer: !process.env.CI },
  ],
  use: {
    baseURL: 'http://127.0.0.1:5175/', browserName: 'chromium',
    launchOptions: { ...(executablePath ? { executablePath } : {}), args: ['--no-sandbox'] },
    screenshot: 'only-on-failure', trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', testIgnore:'**/phone.spec.js', use: { viewport: { width: 1440, height: 1080 } } },
    { name: 'mobile', testIgnore:'**/phone.spec.js', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: 'portrait-1080', testMatch:'**/phone.spec.js', use: { viewport:{width:360,height:640},deviceScaleFactor:3,isMobile:true,hasTouch:true } },
  ],
});
