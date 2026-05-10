# Issue #10: E2E (Playwright) + Vercel デプロイ

> **設計意図**: SSR の動作証明と本番デプロイ。E2E は CI から外し、ローカル実行のみ（flaky リスク回避、README に明記）。Vercel Hobby で完全無料デプロイ、Spending Limit を $0 に設定して課金完全防止。

## 目的
Playwright で E2E ハッピーパス + deep link 1本を実装し、SSR の動作を証明。Vercel Hobby に本番デプロイし、URL を README で公開。**設計判断**で旧 #10 を分割（技術PR）した。

## 完了条件

### Playwright E2E
- [ ] `pnpm add -D @playwright/test`
- [ ] `pnpm exec playwright install chromium`（chromium のみ、firefox/webkit 不要）
- [ ] `playwright.config.ts`:
  - `testDir: './tests/e2e'`
  - `use.baseURL: 'http://localhost:3000'`
  - `webServer.command: 'pnpm dev'`
  - chromium project のみ
  - `retries: process.env.CI ? 2 : 0`
- [ ] `tests/e2e/search-flow.spec.ts` — 1本のみ:
  1. `/` 表示 → `<h1>` 確認
  2. "react" 入力 → submit
  3. URL `?q=react` 確認
  4. 結果リスト表示（`role="list"`）
  5. 1件目クリック → `/repositories/[owner]/[repo]` 遷移
  6. 詳細ページの `<h1>` または fullName 表示
  7. 直接 `/repositories/notexist123/notexist123` → not-found 画面（deep link）
- [ ] `pnpm playwright test` ローカル pass
- [ ] **CI からは除外**（README に「ローカル実行のみ」と明記）

### Vercel デプロイ
- [ ] Vercel プロジェクト作成、GitHub 連携（Web UI で作業）
- [ ] Node version を **22** に固定（Vercel Dashboard で明示）
- [ ] `GITHUB_TOKEN` を Vercel Dashboard で env 設定（任意、未設定でも動作）
- [ ] **Spending Limit を $0 に設定**（課金完全防止、Hobby のため不要だが念のため）
- [ ] `pnpm install --frozen-lockfile` を Vercel が使うことを確認
- [ ] デプロイURL動作確認: top / 検索 / 詳細 / 404 / error / rate-limit の6状態

## 非スコープ
- README / ADR / スクショ（→ Issue #11）
- ローカル運用メモ（`.gitignore` 対象ファイルで管理）

### 明示却下事項（積極的にやらない）
- **E2E を CI に組み込む**: flaky リスク + ブラウザインストール時間 + Vercel Hobby の build 時間圧迫 → ローカル実行で十分動作証明
- **Playwright 全ブラウザ**（firefox/webkit）: chromium のみで十分、本課題のスコープでは過剰
- **page.route() で rate-limit シミュレーション**: 結合テストでカバー済、E2E で重複させる必要なし
- **Vercel Pro プラン採用**: Hobby で完結、課金リスク完全回避

## 依存Issue
- 先行: #9 (Composition Root 完成、page.tsx 起動可能)
- 後続: #11 (README が Vercel URL を引用)

## 関連 reference
- `reference/testing/playwright.md` (config + ロケータ戦略 + page.route)

## ラベル
- `type:feat`, `type:ci`

## ブランチ名
`feat/10-e2e-vercel`

## 実装メモ

### 最初の1ファイル
**`playwright.config.ts`** から:
```typescript
import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL: 'http://localhost:3000' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: { command: 'pnpm dev', url: 'http://localhost:3000', reuseExistingServer: !process.env.CI },
});
```
**理由**: config なしで `playwright test` を呼ぶと global config を探して失敗。最初に置く。

### 設計判断
- ロケータ戦略: `getByRole` 優先（脆い `class` セレクタ禁止）、a11y観点と一致
- E2E は **happy path + deep link の1本に絞る**（壊れやすいテストを増やさない、SSR動作証明だけ）
- Vercel デプロイは **Hobby プラン**: 商用利用判定OK（個人ポートフォリオ）、Spending Limit $0 で課金完全防止
- Vercel に `pnpm-lock.yaml` を読ませる、`--frozen-lockfile` で再現性担保

## CI 担保範囲（Issue 完了時点）

このPRが merge された時点で CI が**初めて以下を機械検証**:
- **Vercel デプロイが build pass** すること（Vercel が GitHub Actions と並列で build）
- E2E は CI 対象外（ローカル実行のみ、README記載）

→ プロダクション環境で動作証明完了、README で URL 公開可能
