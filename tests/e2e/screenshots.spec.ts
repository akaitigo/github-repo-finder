import { test, devices, type Page } from "@playwright/test";
import path from "node:path";

/**
 * 品質証跡スクリーンショット自動撮影。
 *
 * 設計判断:
 * - Playwright の screenshot 機能で PC + mobile を自動撮影
 * - docs/screenshots/ にコミット (README から参照)
 * - 実 GitHub API を叩くため Search bucket rate-limit に注意 (1 回数 req 程度)
 *
 * 使い方:
 *   pnpm playwright test screenshots.spec.ts  # 撮影のみ
 *
 * 撮影対象:
 *   01-top-pc.png         : PC トップ (検索フォーム + 初期 EmptyState)
 *   02-search-result-pc.png : PC 検索結果 (react)
 *   03-detail-pc.png      : PC 詳細
 *   04-mobile-top.png     : iPhone 14 Pro Max トップ
 *   05-mobile-result.png  : iPhone SE 検索結果 (折返し検証)
 */

const SHOTS_DIR = path.resolve(process.cwd(), "docs/screenshots");

async function dismissReactDevOverlay(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.querySelectorAll("nextjs-portal").forEach((el) => el.remove());
  });
}

test.describe("PC screenshots (1280x800)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("01 トップ", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("text=リポジトリを検索", { state: "visible" });
    await dismissReactDevOverlay(page);
    await page.screenshot({
      path: path.join(SHOTS_DIR, "01-top-pc.png"),
      fullPage: true,
    });
  });

  test("02 検索結果", async ({ page }) => {
    await page.goto("/?q=react");
    await page.waitForSelector('[role="list"]', {
      state: "visible",
      timeout: 15_000,
    });
    await dismissReactDevOverlay(page);
    await page.screenshot({
      path: path.join(SHOTS_DIR, "02-search-result-pc.png"),
      fullPage: true,
    });
  });

  test("03 詳細", async ({ page }) => {
    await page.goto("/repositories/facebook/react");
    await page.waitForSelector("h1", { state: "visible", timeout: 15_000 });
    await dismissReactDevOverlay(page);
    await page.screenshot({
      path: path.join(SHOTS_DIR, "03-detail-pc.png"),
      fullPage: true,
    });
  });
});

test.describe("Mobile screenshots (iPhone 14 Pro Max emulation)", () => {
  // defaultBrowserType を describe 内で変えられないため、device 設定から viewport / mobile flags のみ抽出
  const iphone = devices["iPhone 14 Pro Max"];
  test.use({
    viewport: iphone.viewport,
    userAgent: iphone.userAgent,
    deviceScaleFactor: iphone.deviceScaleFactor,
    isMobile: iphone.isMobile,
    hasTouch: iphone.hasTouch,
  });

  test("04 mobile トップ", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("text=リポジトリを検索", { state: "visible" });
    await dismissReactDevOverlay(page);
    await page.screenshot({
      path: path.join(SHOTS_DIR, "04-mobile-top.png"),
      fullPage: true,
    });
  });

  test("05 mobile 検索結果 (折返し)", async ({ page }) => {
    await page.goto("/?q=react");
    await page.waitForSelector('[role="list"]', {
      state: "visible",
      timeout: 15_000,
    });
    await dismissReactDevOverlay(page);
    await page.screenshot({
      path: path.join(SHOTS_DIR, "05-mobile-result.png"),
      fullPage: true,
    });
  });
});
