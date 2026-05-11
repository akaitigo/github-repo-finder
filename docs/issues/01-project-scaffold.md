# Issue #1: Next.js v16 プロジェクト初期化

> **設計意図**: 後続全 PR の土台。`pnpm create next-app` で v16 + TS + Tailwind v4 + ESLint flat config の最小構成を立ち上げ、依存方向ルールを **ESLint で機械強制**できる状態にする。

## 目的
プロジェクトの骨格を作る。Next.js v16 + TypeScript strict + Tailwind v4 + ESLint flat config + Prettier の最小構成を立ち上げ、後続 Issue が即着手できる状態にする。

## 完了条件
- [ ] `pnpm create next-app@latest` で Next.js v16 + TypeScript + Tailwind v4 + App Router + src/ ディレクトリ構成で初期化
- [ ] `package.json` の `engines` に `node >= 22`、`packageManager: pnpm@9.x.x` を明記
- [ ] `.nvmrc` に `22`
- [ ] `.gitignore` に `.env*.local`, `.vercel/`, `coverage/`, `playwright-report/`, `.DS_Store` を追加
- [ ] `.env.example` を `GITHUB_TOKEN=` (任意、未設定でも動作) コメント付きで配置
- [ ] **`LICENSE` ファイル (MIT) を配置** (リポジトリ作成時に手動)
- [ ] `eslint.config.mjs` (flat config) を作成、`no-restricted-imports` で依存方向ルール、`no-restricted-syntax` で `dangerouslySetInnerHTML` 禁止
- [ ] `prettier` 設定 (`.prettierrc.json`、`.prettierignore`)
- [ ] `package.json` scripts: `dev` / `build` / `start` / `lint` / `lint:fix` / `typecheck` / `test` / `test:e2e`
- [ ] **`.github/pull_request_template.md`** 作成（概要 / 変更点 / テスト方針 / スクリーンショット / 設計判断）
- [ ] **`.github/ISSUE_TEMPLATE/feature.md`**, **`chore.md`**, **`config.yml`** 作成
- [ ] `pnpm dev` で `http://localhost:3000` 起動確認
- [ ] `pnpm lint && pnpm typecheck && pnpm build` 全 pass

## 非スコープ
- shadcn/ui 初期化（→ Issue #2）
- CI workflow（→ Issue #3）
- ドメインロジック実装（→ Issue #4）

### 明示却下事項（積極的にやらない）
- **`husky` / `lint-staged`**: CI で十分担保、ローカル hook はノイズ
- **`eslint-plugin-boundaries`**: 標準 `no-restricted-imports` で十分、新規プラグイン依存を避ける
- **Tailwind v3 採用**: v4 が Next.js v16 デフォルト、移行コスト不要

## 依存Issue
- 先行: なし（最初のPR）
- 後続: #2 (shadcn init), #3 (CI), #4-#11 (実装〜最終仕上げ)

## 関連 reference
- `reference/styling/tailwind-v4.md`
- `reference/tooling/eslint-flat-config.md`

## ラベル
- `type:setup`

## ブランチ名
`feat/1-project-scaffold`

## 実装メモ

### 最初の1ファイル
**`pnpm create next-app@latest github-repo-finder --ts --tailwind --eslint --app --src-dir --use-pnpm` の生成物**を確認 → `package.json` で Next.js v16 が入っているか先に確認。**理由**: scaffold が古い v15 を入れたら以降の判断（PageProps ヘルパー等）が成立しない。

### 設計判断
- Tailwind v4 の `@theme` 構文を採用、`tailwind.config.js` は不要
- `next lint` は v16 で廃止 → `eslint .` を直接呼ぶ
- ESLint v9 flat config（`eslint.config.mjs`）
- LICENSE (MIT) は **手動配置**（`gh repo create --license MIT` を使うとローカル/リモート競合発生）

## CI 担保範囲（Issue 完了時点）

このPRが merge された時点で:
- **CI はまだ無い**（#3 で構築）
- ローカルで `pnpm dev` / `pnpm lint` / `pnpm typecheck` / `pnpm build` が pass
- ESLint flat config が動作（依存方向ルール有効）

→ scaffold 完成、後続 Issue が即着手可能
