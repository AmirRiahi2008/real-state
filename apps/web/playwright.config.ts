import { defineConfig, devices } from '@playwright/test';

const externalBase = process.env.PLAYWRIGHT_BASE_URL;
const channel = process.env.PLAYWRIGHT_CHANNEL ?? (process.env.CI ? 'chromium' : 'chrome');
export default defineConfig({
  testDir: './test',
  timeout: 45000,
  expect: { timeout: 12000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  outputDir: '../../.artifacts/web-tests',
  use: {
    baseURL: externalBase || 'http://127.0.0.1:3000',
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 1000 },
    channel: channel === 'chromium' ? undefined : channel,
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: externalBase
    ? undefined
    : {
        command: process.env.CI ? 'npm run start' : 'npm run dev',
        env: { NODE_ENV: process.env.CI ? 'production' : 'development' },
        url: 'http://127.0.0.1:3000/en',
        reuseExistingServer: !process.env.CI,
        timeout: 90000,
      },
});
