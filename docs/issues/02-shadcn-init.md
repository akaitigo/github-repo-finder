# Issue #2: shadcn/ui 初期化

> **設計意図**: コードを所有する設計の UIライブラリを採用、Tailwind v4 + Base UI（shadcn 最新の base-nova preset、旧 Radix UI の後継）内部利用で a11y 担保。後続 #8 (UI) で必要な component を都度 add できる土台。

## 目的
shadcn/ui CLI で初期化し、後続のUIコンポーネント（button/input/card/skeleton/alert）を `add` できる状態にする。コードを所有する設計でカスタマイズ自由 + a11y 担保（Radix UI 内部利用）。

## 完了条件
- [ ] `pnpm dlx shadcn@latest init` を実行（Tailwind v4 対応版）
- [ ] `components.json` 生成、設定確認（Tailwind v4、cn helper、aliases）
- [ ] `src/lib/utils.ts` に `cn()` helper（clsx + tailwind-merge）が配置される
- [ ] **`pnpm dlx shadcn@latest add button` で 1 component の add 動作を検証**（add は #8 で本実装、ここは検証のみ → コミット前に削除）
- [ ] `pnpm build` 全 pass

## 非スコープ
- 個別コンポーネント add（→ Issue #8 で `button/input/card/skeleton/alert` 5個を一括 add）
- カスタムテーマの `@theme` ブロック編集（→ #8 で必要に応じ）

### 明示却下事項（積極的にやらない）
- **shadcn add --all 一括実行**: 不要 component が大量に増えてリポジトリ肥大化
- **shadcn の theme 深カスタマイズ**: 本プロジェクトのスコープ外、`@theme` で1色のみ上書き
- **MUI / Mantine / Chakra UI 採用**: コードを所有できず、bundle サイズも大きい

## 依存Issue
- 先行: #1 (project scaffold)
- 後続: #8 (UI/a11y で shadcn add を本実装)

## 関連 reference
- `reference/styling/tailwind-v4.md`

## ラベル
- `type:setup`

## ブランチ名
`feat/2-shadcn-init`

## 実装メモ

### 最初の1ファイル
**`pnpm dlx shadcn@latest init` 実行 → `components.json` 生成**を確認。**理由**: components.json の設定（style/baseColor/cssVariables）が以降の add コマンドで参照される、最初に固める。

### 設計判断
- shadcn/ui v4 cli は Tailwind v4 対応済
- `components.json` の `style` は `default`、`baseColor` は `neutral` を初期選択
- 個別 add は #8 にまとめる（5個一括: button/input/card/skeleton/alert）

## CI 担保範囲（Issue 完了時点）

このPRが merge された時点で:
- **CI はまだ無い**（#3 で構築）
- shadcn の `cn()` helper が typecheck pass
- `components.json` で settings 固定済
