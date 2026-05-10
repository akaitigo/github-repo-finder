# Issue #8: presentation (UIコンポーネント) + a11y + 結合テスト

> **設計意図**: UIを「先に固めて」 #9 (Composition Root) で組み合わせる。**順序入替の根拠**: #9で render-* helper が UI コンポーネントを呼ぶため、UI を placeholder で先行実装するより、UI 完成後に Composition Root で繋ぐ方が手戻りゼロ。

## 目的
UIコンポーネントを実装し、shadcn/ui を adopt（5component 一括 add）。SearchForm のみ Client、他は Server。MSW node mode で結合テスト、vitest-axe で a11y 違反0、`<Link href="?q={q}">` で Retry（callbackなし、URL同期戦略と一貫）。

## 完了条件

### shadcn add
- [ ] `pnpm dlx shadcn@latest add button input card skeleton alert` で 5 component 取得

### Server Components（純粋表示、`'use client'` なし）
- [ ] `src/presentation/components/repository-list.tsx` (items prop、`role="list"`)
- [ ] `src/presentation/components/repository-card.tsx` (Repository prop)
- [ ] `src/presentation/components/repository-detail.tsx` (Repository prop、各種 count 表示)
- [ ] `src/presentation/components/empty-state.tsx` (reason prop で表示分岐: initial / no-results / invalid-query)
- [ ] `src/presentation/components/loading-state.tsx` (Suspense fallback、`role="status"` + `aria-live`)
- [ ] `src/presentation/components/rate-limit-display.tsx` (resetAt + q prop、`<Link href="/?q={q}">` で Retry、callbackなし)

### Client Components（最小限）
- [ ] `src/presentation/components/search-form.tsx` (`'use client'`、`useState` + `useRouter().push('/?q=' + value)`)
- [ ] `src/presentation/components/error-state.tsx` (`'use client'` 必須、reason prop で 6種類表示分岐)

### テスト helpers
- [ ] `tests/helpers/msw/handlers.ts` (3 patterns: success / empty / rate-limit)
- [ ] `tests/helpers/msw/server.ts` (`setupServer({ onUnhandledRequest: 'error' })`)
- [ ] `tests/helpers/factories/repository.ts` (`buildRepository(overrides)`)

### 結合テスト（vitest-axe で a11y 検証込み）
- [ ] `search-form.test.tsx`:
  - `vi.mock('next/navigation')` → `useRouter.push` 監視
  - 入力 + Submit → `push('/?q=入力値')`
  - `c++` 入力 → `push('/?q=c%2B%2B')` (URLエンコード)
  - 空白/全角空白のみ submit → `push` 呼ばれない
  - axe 違反0
- [ ] `repository-list.test.tsx`:
  - items 表示
  - **`description` に `<script>alert(1)</script>` 含む fixture でレンダリング → React 自動エスケープ確認**（XSS）
  - 0件で `<EmptyState />` 表示
- [ ] `repository-card.test.tsx`:
  - 各 count 表示、null フィールド対応
- [ ] `repository-detail.test.tsx`:
  - star/watcher/fork/issue 4 count 全表示
- [ ] `rate-limit-display.test.tsx`:
  - `resetAt` 表示
  - **`<Link href>` の検証**（callbackテスト不要）
- [ ] `error-state.test.tsx`:
  - 6 reason の表示分岐
  - axe 違反0
- [ ] `empty-state.test.tsx`, `loading-state.test.tsx` も axe 検証

### CSP 設定
- [ ] `next.config.ts` の `headers()` に **CSP最低限**設定
  ```javascript
  "default-src 'self'; img-src 'self' https://avatars.githubusercontent.com; connect-src 'self' https://api.github.com; script-src 'self'"
  ```

### カバレッジ
- [ ] presentation カバレッジ 60%（CI 必須）/ 80%（努力目標）達成

## a11y チェックリスト（設計上の特徴）
- 色情報のみで状態を伝えない（エラーは赤色 + アイコン + テキスト併記）
- 動的更新（rate-limit カウントダウン）に `aria-live="polite"`
- `prefers-reduced-motion` 対応（Tailwind `motion-safe:` プレフィクス）
- コントラスト比 WCAG AA（4.5:1）以上
- キーボード操作完結、focus-visible 対応
- 適切な aria-label、role 属性

## 非スコープ
- composition root / page.tsx（→ Issue #9）
- E2E（→ Issue #10）
- README / ADR（→ Issue #11）
- Vercel デプロイ（→ Issue #10）

### 明示却下事項（積極的にやらない）
- **Server Action 採用**: 検索結果は「URL共有可能性」が本質的価値、Server Action は副作用操作向き → ADR 0003 で記載
- **TanStack Query / SWR 採用**: Server Component fetch で完結、Client hook 不要 → token client漏洩防止と整合
- **shadcn 深カスタマイズ**: 本プロジェクトのスコープ外、`@theme` でブランドカラー1色のみ上書き

## 依存Issue
- 先行: #2 (shadcn init), #4 (domain Repository 型), #7 (UseCase の SearchResult 型を props 経由で受ける前提)
- 後続: #9 (Composition Root が UI を呼ぶ)

## 関連 reference
- `reference/testing/msw-v2-node.md` (MSW node mode setup)
- `reference/styling/tailwind-v4.md` (shadcn add)
- `reference/nextjs-v16/server-components.md` (Server/Client境界)

## ラベル
- `type:feat`, `layer:ui`

## ブランチ名
`feat/8-presentation-ui-a11y`

## 実装メモ

### 最初の1ファイル
**`src/presentation/components/repository-card.tsx`** の date format helper:
```typescript
const formatted = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric', month: 'numeric', day: 'numeric',
}).format(repository.updatedAt);
```
**理由**: Vercel Edge (UTC) と jsdom (ローカルTZ) で date 表示が異なると、production で hydration mismatch が発生。最初に固定して以降の実装でブレないようにする。

### 設計判断
- `<RateLimitDisplay />` (旧 RateLimitState から rename) は Server Component のまま `<Link>` で Retry → URL同期戦略と一貫
- `<ErrorState />` は `error.tsx` で使うので Client、reason prop で 6種類（forbidden / upstream / malformed / schema / network / generic）の表示分岐
- shadcn/ui のテーマカスタマイズは最小限、`@theme` でブランドカラー1色のみ上書き
- MSW handlers は `tests/helpers/msw/handlers.ts` に 3 pattern 集約、各テストで `server.use()` で local 上書き

## CI 担保範囲（Issue 完了時点）

このPRが merge された時点で CI が**初めて以下を機械検証**:
- **UI コンポーネントの描画ロジック** が壊れたら CI で落ちる
- **a11y 違反**（axe） が 0 でない場合 CI で落ちる
- **MSW unhandled request** で CI で落ちる
- **XSS脆弱性**（dangerouslySetInnerHTML 使用）が ESLint で落ちる

→ presentation 層完成、composition root と組み合わせる準備完了
