// playwright.config.js - Playwright configuration

import { defineConfig, devices } from '@playwright/test';
import { TEST_PORT, TEST_CONFIG } from './e2e/test_config.js';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'test_*.js',
  // Helpers share the test_ prefix but are not specs
  testIgnore: ['test_utils.js', 'test_config.js'],
  globalSetup: './e2e/global_setup.js',

  // Test timeout
  timeout: 30 * 1000,

  // Expect timeout
  expect: {
    timeout: 5000
  },

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests for more predictable results
  workers: 1,

  // Reporter to use
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results.json' }],
    ['html', { open: 'never' }]
  ],

  // Shared settings for all projects
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: TEST_CONFIG.serverUrl,

    // Collect trace when retrying the failed test
    trace: 'retain-on-failure',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'retain-on-failure',

    // Emulate a desktop viewport
    viewport: { width: 1280, height: 720 },

    // Ignore HTTPS errors
    ignoreHTTPSErrors: true,

    // Locale
    locale: 'en-US',

    // Timezone
    timezoneId: 'America/New_York',
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Start the Dave server on the test port (or reuse one already running there)
  webServer: {
    command: 'node scripts/server.cjs',
    cwd: '..',
    env: { PORT: String(TEST_PORT) },
    url: TEST_CONFIG.serverUrl,
    reuseExistingServer: !process.env.CI,
  },
});
