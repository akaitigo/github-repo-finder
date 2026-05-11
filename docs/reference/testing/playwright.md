# Playwright Test

## 公式ドキュメント
- https://playwright.dev/docs/intro
- バージョン: Playwright Test 最新

## 今回の用途
- E2E テスト 1本（happy path + deep link）
- ローカル実行のみ、CI からは外す

## インストール

```bash
pnpm add -D @playwright/test
pnpm exec playwright install        # ブラウザ install（chromium のみ）
# または
pnpm exec playwright install --with-deps chromium  # CI 用
```

## playwright.config.ts

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // 今回 chromium のみ（時間制約）
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
```

## 基本テスト構造

```typescript
// tests/e2e/search-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('search flow', () => {
  test('happy path: search and view detail', async ({ page }) => {
    // 1. ホームページ表示
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // 2. 検索フォームに入力
    await page.getByLabel('検索キーワード').fill('react');
    await page.getByRole('button', { name: '検索' }).click();

    // 3. URL が変化
    await expect(page).toHaveURL(/\/\?q=react/);

    // 4. 結果リスト表示
    await expect(page.getByRole('list', { name: 'リポジトリ一覧' })).toBeVisible();

    // 5. 1件目クリック
    await page.getByRole('listitem').first().getByRole('link').click();

    // 6. 詳細ページ遷移
    await expect(page).toHaveURL(/\/repositories\/.+\/.+/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('deep link: not found', async ({ page }) => {
    await page.goto('/repositories/notexist123/notexist123');
    await expect(page.getByText(/見つかりません|Not Found/)).toBeVisible();
  });
});
```

## ロケータ戦略（推奨）

優先順位:
1. **`getByRole`** — accessibility 観点、最も robust
2. **`getByLabel`** — フォーム要素
3. **`getByText`** — 表示テキスト
4. **`getByTestId`** — 上記で取れない場合のみ

```typescript
// ❌ 脆い（class が変わると壊れる）
await page.locator('.search-button').click();

// ✅ 堅牢
await page.getByRole('button', { name: '検索' }).click();
```

## アサーション（auto-wait あり）

```typescript
await expect(locator).toBeVisible();          // 要素表示
await expect(locator).toHaveText('expected'); // テキスト一致
await expect(locator).toContainText('part');  // 部分一致
await expect(page).toHaveURL(/\/\?q=react/);  // URL match
await expect(locator).toBeEnabled();
await expect(locator).toBeDisabled();
await expect(locator).toHaveAttribute('href', '/?q=react');
```

`expect` は **自動 retry**（デフォルト5秒）→ `await waitFor` 不要なケース多い。

## page.route() でネットワーク mock

E2E で rate limit シナリオを再現する場合に使える:

```typescript
test('rate limit displays retry message', async ({ page }) => {
  await page.route('**/api.github.com/search/repositories**', (route) => {
    route.fulfill({
      status: 403,
      headers: {
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600),
        'x-ratelimit-resource': 'search',
      },
      body: JSON.stringify({ message: 'API rate limit exceeded' }),
    });
  });

  await page.goto('/?q=react');
  await expect(page.getByText(/再試行可能/)).toBeVisible();
});
```

→ MSW 統合不要、Playwright 内で完結

## スクリーンショット

```typescript
await page.screenshot({ path: 'docs/screenshots/01-top-pc.png', fullPage: true });
await page.locator('main').screenshot({ path: 'docs/screenshots/02-search-result.png' });

// モバイル viewport
await page.setViewportSize({ width: 375, height: 667 });
await page.screenshot({ path: 'docs/screenshots/04-mobile-iphone-se.png' });
```

→ README用 7枚を Playwright で半自動生成可能

## 実行コマンド

```bash
pnpm playwright test                  # 全テスト
pnpm playwright test --ui             # UI mode（開発中のデバッグ）
pnpm playwright test --headed         # ブラウザ表示で実行
pnpm playwright show-report           # HTML レポート表示
```

## CI（今回は除外）

```yaml
# .github/workflows/ci.yml に追加する場合（今回はやらない）
- name: Install Playwright Browsers
  run: pnpm exec playwright install --with-deps chromium

- name: Run Playwright tests
  run: pnpm playwright test
```

→ **今回は CI から外す**（flaky リスク + ブラウザインストール時間）
→ ローカル実行で「動く事実」を README に記載

## 落とし穴

### 1. `page.locator` の脆さ
- `page.locator('.btn')` は class 変更で壊れる
- `getByRole` 優先

### 2. `await waitFor` の不要使用
- `expect` は auto-wait なので、明示的な waitFor は通常不要

### 3. `webServer` の起動待ち
- `pnpm dev` の起動に時間がかかる場合 timeout 調整
- 本番テストなら `pnpm build && pnpm start` の方が速い

### 4. CI で flaky
- ブラウザインストールの遅延、resource 不足
- → CI から外す or `retries: 2` で吸収

### 5. screenshot の差分
- viewport / font 差異で snapshot test は脆い
- README 用は手動で撮る方が確実

## 関連 FAQ

| 質問 | 回答 |
|------|------|
| 「E2E をなぜ CI から外した？」 | flaky リスク、ブラウザインストール時間、ローカル実行で十分動作証明 |
| 「Playwright を 1本に絞った理由は？」 | 「壊れやすいテストを増やさない」、ハッピーパスと deep link で SSR の動作証明 |
| 「page.route() を使ったか？」 | 今回 rate limit シナリオは結合テストでカバー、E2E は実 API |
| 「ロケータ戦略は？」 | `getByRole` 優先、a11y 観点と一致 |

## 実装ファイル参照
- `playwright.config.ts`
- `tests/e2e/search-flow.spec.ts`
