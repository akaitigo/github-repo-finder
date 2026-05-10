# Issue #3: GitHub Actions CI + vitest.config.ts

> **設計意図**: PR ごとの機械検証パイプラインを構築。最小権限 + frozen-lockfile + カバレッジ閾値を CI で担保し、後続 #4 以降の品質を「自動的に」保証する基盤。

## 目的
PR ごとに lint / typecheck / test / build を機械検証する CI を構築。最小権限方針 + frozen-lockfile で再現性とセキュリティを担保。`vitest.config.ts` の `test.projects` で unit / integration を分離。

## 完了条件
- [ ] `.github/workflows/ci.yml` 作成（`on: push: branches-ignore: [main]` + `on: pull_request: branches: [main]`、ブランチ規約 `feat/<番号>-<短名>` と整合）
- [ ] **`permissions: contents: read` 明示**（最小権限）
- [ ] jobs:
  - `install` (pnpm v9 + Node v22 + `pnpm install --frozen-lockfile`)
  - `lint` (`pnpm lint`)
  - `typecheck` (`pnpm typecheck`)
  - `test` (`pnpm test --coverage`)
  - `build` (`pnpm build`)
- [ ] **E2E（Playwright）は CI から除外**（README に明記）
- [ ] `actions/cache` で `pnpm store` (`~/.local/share/pnpm/store/v3`) と `.next/cache` をキャッシュ（pnpm 公式推奨）
- [ ] `vitest.config.ts` 作成、`test.projects` で unit / integration を分離
- [ ] `vitest.config.ts` の `coverage.thresholds` に **CI 必須下限を機械検証値**として明記（domain 90%, application 80%, infrastructure 75%, presentation 60%）
- [ ] `vitest.config.ts` の `coverage.exclude` に `src/app/**/page.tsx`, `src/app/**/layout.tsx` 追加
- [ ] `vitest.setup.integration.ts` で MSW + vitest-axe の setup（Issue #6 で MSW handlers 定義、#8 で本格活用）
- [ ] **`server-only` パッケージは使用しない方針**（設計プラン Tier 6 #36 に対応、stub/alias 設定不要）
- [ ] CI が空テストでもグリーンで通ることを確認

## 非スコープ
- E2E を CI に組み込む（明示的に除外、ローカル実行のみ）
- CodeRabbit / Dependabot
- main ブランチ保護設定（個人プロジェクトのため不要）

### 明示却下事項（積極的にやらない）
- **E2E を CI に統合**: flaky リスク + ブラウザインストール時間で全 PR が遅くなる、ROIが見合わない
- **CodeRabbit / Dependabot 自動化**: 個人本プロジェクトのスコープ外、追加 dependency
- **GitHub Actions の write 権限付与**: 不要（lint/typecheck/test/build のみ）、最小権限原則
- **`server-only` パッケージ採用**: 設計プラン Tier 6 で削除確定、テストコスト>安全性

## 依存Issue
- 先行: #1 (project scaffold)
- 後続: #4-#11 (各 PR で CI が動く)

## 関連 reference
- `reference/testing/vitest.md`
- `reference/testing/msw-v2-node.md`

## ラベル
- `type:ci`

## ブランチ名
`feat/3-ci-workflow`

## 実装メモ

### 最初の1ファイル
**`.github/workflows/ci.yml`** から:
```yaml
name: CI
on: [push, pull_request]
permissions: { contents: read }
jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test --coverage
      - run: pnpm build
```
**理由**: 最小構成で CI が動く状態を最初に確認、後で coverage threshold 等を vitest.config.ts に追加。

### 設計判断
- `pnpm/action-setup@v4`、`actions/setup-node@v4` (Node 22)
- `actions/cache@v4` で `~/.local/share/pnpm/store/v3` （pnpm store）をキャッシュ
- `permissions: contents: read` で最小権限（write 不要）
- **`server-only` パッケージは 設計プラン で不採用**: `app/_lib/container.ts`, `app/_lib/render-*.tsx` に `import 'server-only'` を **付けない**
- token 保護は「Server Component 内でのみ `process.env.GITHUB_TOKEN` 参照」を ESLint コードレビューで担保
- カバレッジ閾値は **`vitest.config.ts` の `coverage.thresholds`** で機械検証（CI step 側でなく config 側）

## CI 担保範囲（Issue 完了時点）

このPRが merge された時点で CI が**初めて以下を機械検証**:
- **lint / typecheck / test / build** が PR 単位で必須
- **カバレッジ閾値 90/80/75/60** （domain/app/infra/presentation）が満たされない場合 CI で落ちる
- **`pnpm install --frozen-lockfile` 違反**（lockfile 更新忘れ）で CI で落ちる
- **`permissions: contents: read`** で workflow が write 操作を試みると CI で落ちる

→ 後続 #4-#11 の全 PR が品質保証パイプラインに乗る
