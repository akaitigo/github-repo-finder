# reference/ — 公式ドキュメント抜粋

このディレクトリは **github-repo-finder** プロジェクトの実装中に参照する公式ドキュメントの抜粋集。

## 目的

1. **AI幻覚防止** — 実装時に「`docs/reference/nextjs-v16/searchparams.md` を読んで」と指示できる、AI が古い知識・幻覚で書く事故を防ぐ
2. **設計判断の根拠確認** — 各ファイルに「関連 FAQ」セクション
3. **設計プランと実コードの一貫性** — 設計判断の根拠を一次情報で裏付け

## 構造（Reference 12本 + 索引）

### Next.js v16
- [`nextjs-v16/searchparams.md`](nextjs-v16/searchparams.md) — async searchParams (v15+ Promise化)、PageProps ヘルパー、normalize seam
- [`nextjs-v16/server-components.md`](nextjs-v16/server-components.md) — Server/Client境界、Composition Pattern、`server-only` パッケージ
- [`nextjs-v16/error-handling.md`](nextjs-v16/error-handling.md) — error.tsx (Client必須/`unstable_retry`)、not-found.tsx、loading.tsx (Suspense)
- [`nextjs-v16/caching.md`](nextjs-v16/caching.md) — fetch dedupe、React `cache()`、Cache Components / PPR (v16新概念)

### GitHub API
- [`github-api/search-repositories.md`](github-api/search-repositories.md) — `/search/repositories` エンドポイント仕様、zod スキーマ
- [`github-api/rate-limits.md`](github-api/rate-limits.md) — search bucket（10/min, 30/min）、403 3分類、ヘッダ仕様
- [`github-api/error-responses.md`](github-api/error-responses.md) — ステータスコード一覧、infra 14異常系テストの根拠

### Testing
- [`testing/vitest.md`](testing/vitest.md) — `test.projects` (旧 workspace)、pool: 'forks'、coverage 設定
- [`testing/msw-v2-node.md`](testing/msw-v2-node.md) — setupServer、`onUnhandledRequest: 'error'`、vitest projects との統合
- [`testing/playwright.md`](testing/playwright.md) — config、ロケータ戦略、page.route() でモック、CI 除外判断

### Styling
- [`styling/tailwind-v4.md`](styling/tailwind-v4.md) — `@theme` 構文、PostCSS plugin、`tailwind.config.js` 不要、shadcn 連携

### Tooling
- [`tooling/eslint-flat-config.md`](tooling/eslint-flat-config.md) — flat config、`next lint` 廃止対応、no-restricted-imports で依存方向強制

## 使い方

### 実装時（AI への指示）

```
@docs/reference/nextjs-v16/searchparams.md と @docs/plan.md を読んで、
app/page.tsx を実装してください。PageProps ヘルパーと normalizeSearchParam を使って。
```

### コード参照

各ファイル末尾に「実装ファイル参照」セクションあり。reference の該当 doc を見たら、対応する `src/` のファイルがすぐ分かる。

## 優先度（実装着手順）

| 優先 | ファイル | 理由 |
|-----|---------|------|
| **A** | searchparams, server-components, error-handling, rate-limits, error-responses, msw-v2-node, tailwind-v4 | 実装で必ず参照 |
| **B** | search-repositories, vitest, playwright, eslint-flat-config, caching | 設計で参照 |
| **C** (未作成) | shadcn-ui, zod, typescript-strict, pnpm, conventional-commits, adr-template | あると便利、必要時追加 |

## 関連ドキュメント

- [`../plan.md`](../plan.md) — 設計プラン（各 reference へのリンク含む）

## メンテナンス

- 公式ドキュメントの URL は変わる可能性あり、参照前に各リンクの存続確認
- バージョン記載（Next.js v16.2.6 等）が古くなったら更新
- 実装中に新しい知見を得たら「落とし穴」セクションに追記
