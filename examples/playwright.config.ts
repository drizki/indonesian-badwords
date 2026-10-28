import { defineConfig } from '@playwright/test';

const apps = ['browser', 'react', 'vue', 'svelte'];
export default defineConfig({
  testDir: './checks',
  testMatch: '**/*.browser.ts',
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 2,
  use: { browserName: 'chromium' },
  projects: apps.map((name, index) => ({ name, use: { baseURL: `http://127.0.0.1:${4170 + index}` } })),
  webServer: apps.map((name, index) => ({
    command: `npm exec -- vite preview --mode ${name} --host 127.0.0.1 --port ${4170 + index} --strictPort`,
    url: `http://127.0.0.1:${4170 + index}`,
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  })),
});
