# ADR 0003: Server Component 主体 + URL 同期戦略

## Status

Accepted (2026-05-11)

## Context

Next.js v16 App Router では Server Components / Client Components / Server Actions / URL Search Params の使い分けで設計が大きく変わる。検索機能の状態管理戦略を選ぶ必要があった。

選択肢:
- **完全 Server Component** + URL Search Params (`?q=react`)
- Client Component 主体 + useState で状態管理
- Server Actions で submit 処理 + redirect

評価軸:
- token (`GITHUB_TOKEN`) を Client Bundle に漏らさない
- deep link (検索結果 URL の共有) が可能か
- SSR で初期表示が早いか
- ブラウザ back/forward が自然に動くか
- テスト容易性

## Decision

**Server Component 主体 + URL Search Params 同期戦略** を採用する。

```
ユーザー入力
  ↓
SearchForm (Client) → useRouter().push('/?q=react')
  ↓
URL 変更 → page.tsx (Server) が再レンダリング
  ↓
container.ts → UseCase → Gateway (Server で fetch + token 使用)
  ↓
render-search-result.tsx → UI コンポーネント (Server)
```

### Server / Client の最小分離

| Component | 種別 | 理由 |
|-----------|------|------|
| `RepositoryCard` / `RepositoryList` / `RepositoryDetail` | Server | 純粋表示、Client 化メリットなし |
| `EmptyState` / `LoadingState` | Server | 静的表示 |
| `SearchForm` | **Client** | useState (input value) + useRouter().push |
| `RateLimitDisplay` | **Client** | setInterval でカウントダウン (Date.now 必要) |
| `ErrorState` | **Client** | 将来 reset hook 想定で Client 化 |

### URL 同期戦略の詳細

- **検索ワード**: `/?q=react`
- **ページ遷移**: `/repositories/facebook/react`
- **Retry**: `<Link href="/?q=react">` (callback なし、URL 共有可能性維持)

## Consequences

### Positive

- **`process.env.GITHUB_TOKEN` を Client Bundle から完全分離**: `app/_lib/container.ts` (Server only) でのみ参照
- **deep link が機能する**: `/?q=react language:typescript` を共有可能
- **SSR 初期表示が早い**: 検索結果を Server で fetch 済の HTML として返す
- **ブラウザ back/forward が自然**: URL が状態の Single Source of Truth
- **テスト容易性**: render-* helper で Server 側ロジックを純粋関数として分離テスト

### Negative

- **Client Component 内で URL を扱う特殊性**: useRouter() / useSearchParams() の使い方を学ぶ必要
- **検索ごとに Server 通信**: 連続入力時の通信コスト (debounce 等は今回未実装)
- **page.tsx 薄殻 + render-* helper の 2 段構成**: 単純なページ実装より階層が増える

## Alternatives Considered

### Client Component 主体 + useState

却下理由 (Why not now):
- **`GITHUB_TOKEN` が Client Bundle に漏れる懸念**: token を Client から渡す必要 → Bundle 解析で露出
- **deep link 不可**: useState は URL に反映されないため検索結果 URL を共有できない
- **SSR の利点喪失**: 初期表示で空画面 → クライアント fetch → コンテンツ表示の遅延

### Server Actions for submit

却下理由:
- **副作用操作向き** (DB 書き込み、メール送信等)、検索のような read-only 操作には URL 同期の方が自然
- **deep link 不可**: form action は URL を変更しない (redirect が必要だが冗長)
- **共有可能性が本質的価値**: URL = 状態の単一源 = ブックマーク / 共有 / 戻る操作が全て自然動作

## Server Action vs URL 同期 (詳細比較)

| 観点 | Server Action | URL 同期 (本採用) |
|------|--------------|------------------|
| deep link | ❌ form action は URL 不変 | ✅ `/?q=react` |
| ブックマーク | ❌ 不可 | ✅ 可能 |
| ブラウザ back/forward | ❌ 不自然 | ✅ 自然 |
| 共有可能性 | ❌ 状態は server に閉じる | ✅ URL を共有すれば再現 |
| 副作用処理 | ✅ 強い (DB 書込み、メール) | ❌ read-only 向き |

→ 検索は read-only + 共有可能性が本質 → URL 同期が適している。

## 「却下した 1 件」の事例

**AI 提案**: 「Client Component 内で `useEffect` + `fetch('/api/search?q=...')` パターン」

**却下理由 3 軸**:
1. **token 漏洩**: Client から fetch する場合、`GITHUB_TOKEN` を public env に出すか、API route 経由で server proxy する必要 → 構成が複雑化
2. **deep link 喪失**: `useState` で q を保持すると URL に反映されず、検索結果 URL が共有できない
3. **SSR 初期表示劣化**: クライアント fetch まで empty 画面、LCP / CLS 悪化

**採用案**: Server Component で fetch、URL 同期。token は Server boundary に閉じる。

## 参考

- 実装: `src/app/page.tsx`, `src/app/_lib/container.ts`, `src/presentation/components/search-form.tsx`
- v15+ async Server Component 仕様: https://nextjs.org/docs/app/api-reference/file-conventions/page
