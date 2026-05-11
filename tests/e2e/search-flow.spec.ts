import { test, expect } from "@playwright/test";

/**
 * 検索フロー E2E (1 本に集約)。
 *
 * 設計判断:
 * - happy path + deep link の 2 シナリオを 1 spec にまとめる
 * - ロケータは getByRole 優先（脆い class セレクタ禁止、a11y 観点と一致）
 * - SSR の動作証明のみが目的、rate-limit や error 系は結合テストでカバー済み
 */

test("happy path: 検索 → 一覧 → 詳細", async ({ page }) => {
  await page.goto("/");

  // 初期表示: 検索フォーム + 初期 EmptyState
  await expect(page.getByRole("searchbox")).toBeVisible();
  await expect(
    page.getByText("リポジトリを検索", { exact: true }),
  ).toBeVisible();

  // 検索ワード入力 → submit
  await page.getByRole("searchbox").fill("react");
  await page.getByRole("button", { name: "検索" }).click();

  // URL に q= がついていること（URL 同期戦略）
  await expect(page).toHaveURL(/\?q=react/);

  // 結果リスト表示
  await expect(page.getByRole("list").first()).toBeVisible({ timeout: 15_000 });

  // 1 件目の link をクリック → 詳細ページ遷移
  const firstLink = page
    .getByRole("listitem")
    .first()
    .getByRole("link")
    .first();
  const href = await firstLink.getAttribute("href");
  expect(href).toMatch(/^\/repositories\/[^/]+\/[^/]+$/);
  await firstLink.click();

  // 詳細ページ: h1 表示 + Star などの count
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText("Star", { exact: true })).toBeVisible();
  await expect(page.getByText("Watcher", { exact: true })).toBeVisible();
});

test("deep link: 存在しないリポジトリ URL → 404 ページ", async ({ page }) => {
  await page.goto("/repositories/nonexistent-org-xxx-yyy/notexist123");

  // 404 表示 (next/navigation の notFound() からの not-found.tsx)
  await expect(page.getByText("404 - Not Found")).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole("link", { name: "トップに戻る" })).toBeVisible();
});
