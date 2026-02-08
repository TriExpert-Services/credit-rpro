// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * Playwright E2E Configuration — Credit Repair Pro
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
  testDir: './e2e',
  /* Maximum time one test can run */
  timeout: 30_000,
  expect: { timeout: 5_000 },
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Reporter to use */
  reporter: process.env.CI ? 'github' : 'html',
  /* Shared settings for all the projects below */
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    /* Collect trace when retrying the failed test */
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Run local servers before starting the tests */
  // Uncomment when you want Playwright to start the dev servers automatically:
  // webServer: [
  //   {
  //     command: 'cd backend && npm start',
  //     port: 5000,
  //     reuseExistingServer: !process.env.CI,
  //   },
  //   {
  //     command: 'cd frontend && npm run dev',
  //     port: 3000,
  //     reuseExistingServer: !process.env.CI,
  //   },
  // ],
});
