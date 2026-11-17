import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.BASE_URL ?? 'http://127.0.0.1:8000/';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    headless: false,
    testIdAttribute: 'data-testid',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Pause between actions so local runs can be watched; CI runs at full speed
    launchOptions: { slowMo: process.env.CI ? 0 : 150 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // The demo app is static files; serve them unless BASE_URL points elsewhere
  webServer: process.env.BASE_URL ? undefined : {
    command: 'python3 -m http.server 8000 --bind 127.0.0.1 --directory ../../docs/demo',
    url: `${baseURL}rooms.html`,
    reuseExistingServer: !process.env.CI,
  },
});
