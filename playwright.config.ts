import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E 設定。
 *
 * 設計判断:
 * - testDir: tests/e2e/ に集約（unit/integration とは別）
 * - chromium のみ（Firefox/WebKit は本プロジェクトのスコープ外、起動コスト削減）
 * - webServer.command: pnpm dev（dev mode で起動）、reuseExistingServer で既起動を流用
 * - retries 2 (CI) / 0 (ローカル) は設計プランに従う、ただし本プロジェクトでは CI から E2E を除外
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
  },
});
