# Tailwind CSS v4 + Next.js v16

## 公式ドキュメント
- https://tailwindcss.com/docs/installation/framework-guides/nextjs
- https://tailwindcss.com/docs/installation/using-vite
- バージョン: Tailwind CSS v4

## 今回の用途
- Next.js v16 + shadcn/ui + Tailwind v4 の組み合わせ
- plan.md セクション 4 (技術スタック)、9 (開発環境)

## v3 vs v4 の主な違い

| 項目 | v3 | v4 |
|------|-----|-----|
| 設定ファイル | `tailwind.config.js` | **不要**（PostCSS config のみ） |
| インストールパッケージ | `tailwindcss` | `tailwindcss` + `@tailwindcss/postcss` + `postcss` |
| globals.css 構文 | `@tailwind base; @tailwind components; @tailwind utilities;` | `@import "tailwindcss";` |
| カスタムテーマ | `theme.extend` in config.js | `@theme` ディレクティブ in CSS |
| PostCSS plugin | `tailwindcss` 直接 | `@tailwindcss/postcss` 経由 |

## Next.js v16 でのインストール

`pnpm create next-app@latest` のデフォルトで Tailwind v4 が選択肢に入る:

```bash
pnpm create next-app@latest github-repo-finder --ts --tailwind --eslint --app --src-dir --use-pnpm
```

または手動:

```bash
pnpm install tailwindcss @tailwindcss/postcss postcss
```

## 設定ファイル

### `postcss.config.mjs`（必須）

```javascript
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
export default config;
```

### `src/app/globals.css`

```css
@import "tailwindcss";

/* カスタムテーマ（v4 では @theme ディレクティブ）*/
@theme {
  --color-primary: oklch(60% 0.15 250);
  --font-sans: ui-sans-serif, system-ui;
}
```

### `tailwind.config.js`

**v4 では不要**。削除して OK。

## shadcn/ui との連携

公式 shadcn/ui CLI が Tailwind v4 対応:

```bash
pnpm dlx shadcn@latest init
```

- `components.json` が生成される（shadcn の設定）
- `lib/utils.ts` に `cn()` helper（clsx + tailwind-merge）
- 必要な component を都度 add:

```bash
pnpm dlx shadcn@latest add button input card skeleton alert
```

shadcn は **コードを所有**する設計（npm パッケージとしてインストールではなく、自分のリポジトリにコピー）→ カスタマイズ自由、依存リスク最小。

## Dark Mode（v4）

v4 では `@theme` で設定、または `@variant` ディレクティブ:

```css
@import "tailwindcss";

@variant dark (.dark &);
```

```html
<html class="dark">
  <body class="bg-white dark:bg-gray-900">
    ...
  </body>
</html>
```

## 落とし穴

### 1. v3 と v4 の混在
- v3 から v4 に移行する場合、`tailwind.config.js` を削除し忘れると挙動不安定
- `@tailwind base;` 等の古い構文も削除必要

### 2. PostCSS plugin の指定
- v3: `plugins: { tailwindcss: {}, autoprefixer: {} }`
- v4: `plugins: { '@tailwindcss/postcss': {} }`
- autoprefixer は v4 に内蔵（個別不要）

### 3. shadcn/ui 旧版
- shadcn/ui の古いバージョンは Tailwind v3 前提
- 必ず最新版（`shadcn@latest`）を使う

### 4. IDE 拡張
- VSCode: Tailwind CSS IntelliSense 拡張は v4 対応版を使用
- `.vscode/settings.json` で `"tailwindCSS.experimental.configFile"` の指定不要

### 5. PurgeCSS 不要
- v4 はスキャンベースで自動的に未使用クラスを除外
- v3 の `content` 設定は不要

## クイックスタート（plan.md にも反映）

```bash
# 1. Next.js v16 + TS + Tailwind v4 (defaultで含まれる)
pnpm create next-app@latest github-repo-finder \
  --ts --tailwind --eslint --app --src-dir --use-pnpm

cd github-repo-finder

# 2. shadcn/ui init
pnpm dlx shadcn@latest init

# 3. shadcn components を add
pnpm dlx shadcn@latest add button input card skeleton alert

# 4. .env.local
cp .env.example .env.local

# 5. dev サーバ起動
pnpm dev
```

## 関連 FAQ

| 質問 | 回答 |
|------|------|
| 「Tailwind v3 ではなく v4 を選んだ理由は？」 | Next.js v16 create-next-app デフォルト + `@theme` 構文がCSS-firstで設計思想と整合 + v3移行コスト不要 |
| 「tailwind.config.js が無いのは何故？」 | v4 で廃止、PostCSS config のみで動作 |
| 「shadcn/ui のカスタマイズ方法は？」 | コードを所有しているので直接編集、`@theme` でテーマ変数だけ上書きも可能 |
| 「dark mode は？」 | `@variant dark (.dark &);` で定義、`<html class="dark">` 切替 |

## 実装ファイル参照
- `postcss.config.mjs`
- `src/app/globals.css`
- `components.json`（shadcn）
- `src/lib/utils.ts`（cn helper）
- `src/components/ui/*`（shadcn add 生成物）
