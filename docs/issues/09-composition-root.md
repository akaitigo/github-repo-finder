# Issue #9: app/ Composition Root + render-* helper + page.tsx 薄殻

> **設計意図**: Next.js v16 App Router の「真の composition root」を `app/_lib/container.ts` factory として明示。Vitest が async Server Component を**公式非サポート**のため、`app/page.tsx` を5行薄殻にし、ロジックを `render-*.tsx` helper に抽出してテスト可能にする戦略。

## 目的
Next.js v16 App Router の app/ 配下を実装。`container.ts` factory で UseCase を生成、`render-*.tsx` helper で UI 分岐ロジックを純粋関数化、page.tsx は5行薄殻に。`loading.tsx`/`error.tsx`/`not-found.tsx` も実装。**#8 で完成した UI コンポーネントを props 経由で組み合わせる**。

## 完了条件

### Composition Root
- [ ] `src/app/_lib/container.ts` — `createSearchUseCase()` / `createDetailUseCase()` factory（`process.env.GITHUB_TOKEN` を渡す、**`import 'server-only'` 不採用**）
- [ ] `src/app/_lib/normalize-search-params.ts` — `string | string[] | undefined` → `string | undefined` 変換（重複キー対応、最後の値を採用）
- [ ] `src/app/_lib/normalize-search-params.test.ts`

### render-* helper（Vitest 非対応問題の回避戦略）
- [ ] `src/app/_lib/render-search-result.tsx` — 純粋関数、ApplicationError 8 kind を全 case で UI コンポーネントに分岐、`assertNever` で網羅性
- [ ] `src/app/_lib/render-detail.tsx` — 同上、`notFound()` 呼び出しも含む

### page.tsx 5行薄殻
- [ ] `src/app/page.tsx` — `PageProps<'/'>` ヘルパー使用、searchParams await、container 呼び出し、render-search-result 委譲（5行）
- [ ] `src/app/repositories/[owner]/[repo]/page.tsx` — `PageProps<'/repositories/[owner]/[repo]'>` ヘルパー使用、同様 5行薄殻

### 規約ファイル
- [ ] `src/app/loading.tsx` — Server Component、Suspense fallback
- [ ] `src/app/error.tsx` — **Client Component（`'use client'` 必須）、`unstable_retry()` ボタン（v16.2.0+）、`error.digest` を console.error**
- [ ] `src/app/not-found.tsx` — Server Component、トップへの Link
- [ ] `src/app/layout.tsx` — `<html lang="ja">`、global CSS import

### 統合テスト
- [ ] `tests/integration/app/render-search-result.test.tsx` — **8 kind 全部の UI 分岐を明示テスト**（各 kind ごと `it()` を1つずつ書く、`render` で実描画して assertion）。switch の `default` には `assertNever(error)` を置き、**型レベルで網羅性を保証**（kind 追加忘れ時にコンパイルエラー）。「明示テスト + assertNever」は競合せず両立する設計
- [ ] `tests/integration/app/render-detail.test.tsx` — happy / not-found / rate-limit / forbidden / upstream-error テスト
- [ ] `tests/integration/app/error-boundary.test.tsx` — `unstable_retry()` 実行確認 + axe 違反0
- [ ] `vitest.config.ts` の `coverage.exclude` に `src/app/**/page.tsx`, `src/app/**/layout.tsx` 追加
- [ ] app/_lib カバレッジ 90%（CI 必須）/ 100%（努力目標）

## 非スコープ
- presentation 層の UI（→ #8 で完了済）
- E2E（→ Issue #10）
- README / ADR（→ Issue #11）

### 明示却下事項（積極的にやらない）
- **`import 'server-only'` パッケージ採用**: テストコスト > 安全性、stub/alias の hoisting 問題回避（設計プラン Tier 6 #36）。token 保護は ESLint レビューで担保
- **「8 kind を `forEach` でループして共通テスト1本」のような汎用化**: 各 kind ごとに `it()` を分けて書き、テスト失敗時にどの kind が壊れたか即特定できる方が運用上有用

## 依存Issue
- 先行: #7 (UseCase + map-* 変換), **#8 (UI コンポーネント完成)**
- 後続: #10 (E2E が page.tsx を起動)

## 関連 reference
- `reference/nextjs-v16/searchparams.md` (PageProps + async searchParams + normalize seam)
- `reference/nextjs-v16/server-components.md` (Composition Pattern + token 保護)
- `reference/nextjs-v16/error-handling.md` (error.tsx + unstable_retry + axe テスト)

## ラベル
- `type:feat`, `layer:app-root`

## ブランチ名
`feat/9-composition-root`

## 実装メモ

### 最初の1ファイル
**`src/app/_lib/normalize-search-params.ts`** から開始:
```typescript
export function normalizeSearchParam(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) return value[value.length - 1];
  return value;
}
```
**理由**: 「searchParams 正規化 seam」が起点。これがないと page.tsx で型エラー。

### 設計判断
- `app/page.tsx` は `PageProps<'/'>` ヘルパー使用（v16新機能、import不要、Next.js v16 知識明示）
- `error.tsx` は **必ず `'use client'`**、**`unstable_retry()` を使う**（v16.2.0+ 推奨、`reset()` の後継 → v16 ベストプラクティス準拠）
- render-* helper は `import 'server-only'` を**付けない**（テストコスト>安全性、設計判断）
- container.ts も `import 'server-only'` 付けない、token 保護は ESLint コードレビューで担保
- **#8 で完成した UI コンポーネント**を render-* から呼び出すだけ、新規実装不要

### 順序入替の意義
当初設計では #8 (composition root) → #9 (UI) だったが、#9 で UI を実装すると #8 の placeholder が手戻り発生。設計判断で **#8 (UI) → #9 (composition root)** に入替。

## CI 担保範囲（Issue 完了時点）

このPRが merge された時点で CI が**初めて以下を機械検証**:
- **app/_lib helper のロジック** が壊れたら CI で落ちる
- **ApplicationError の各 kind 分岐** が UI に正しく繋がっているか CI で落ちる
- **`error.tsx` の `unstable_retry` 動作** が壊れたら CI で落ちる
- **searchParams の正規化** が壊れたら CI で落ちる

→ App Router 全体が結合された状態、E2E と Vercel デプロイの準備完了
