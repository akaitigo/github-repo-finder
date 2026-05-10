# Next.js v16 - Caching (Cache Components 含む)

## 公式ドキュメント
- https://nextjs.org/docs/app/getting-started/caching
- https://nextjs.org/docs/app/getting-started/caching-and-revalidating
- バージョン: Next.js v16.2.6

## 今回の用途
- `?q=react` 等の検索結果をどう扱うか（cache する/しない）
- plan.md 「今後の拡張案」での言及

## v15+ デフォルトの大変更

| 項目 | v14 | v15+ / v16 |
|------|-----|----------|
| `fetch` のデフォルト | `force-cache`（自動キャッシュ） | **`no-store`** （毎回 fetch） |
| 結果 | 検索 API も古い結果が返ることがあった | 常に最新が返る |

→ 今回 search/repositories は **デフォルトで `cache: 'no-store'`** で OK（毎回最新検索）

## fetch の cache オプション

```typescript
// 検索結果は常に最新（デフォルト）
await fetch('https://api.github.com/search/repositories?q=react');
// 等価:
await fetch(url, { cache: 'no-store' });

// あえてキャッシュする場合
await fetch(url, { cache: 'force-cache' });
await fetch(url, { next: { revalidate: 3600 } }); // 1時間ごと再検証
```

## 重複排除（fetch dedupe）

同一 render 内で同じ URL を fetch すると **自動的に1回に集約**される（React の機能）:

```typescript
// page.tsx 内で複数回呼ばれても 1回のみ実行
const a = await fetch('https://api.github.com/repos/facebook/react');
const b = await fetch('https://api.github.com/repos/facebook/react');
// a と b は同じ結果、APIコールは1回
```

これにより `generateMetadata` と `page.tsx` で同じデータを fetch しても N+1 にならない。

## React `cache()` 関数

```typescript
import { cache } from 'react';

export const getRepository = cache(async (owner: string, repo: string) => {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
  return res.json();
});

// 同一render内で複数回呼んでも 1回のみ
```

`fetch` 自動 dedupe で十分なケースが多いが、複雑な処理（DB クエリ等）には `cache()` が有効。

## Next.js v16 の Cache Components（新概念）

`cacheComponents: true` を `next.config.ts` に設定すると有効化:

```typescript
// next.config.ts
export default { cacheComponents: true } as const;
```

### `'use cache'` ディレクティブ

```typescript
import { cacheLife, cacheTag } from 'next/cache';

export async function getProducts() {
  'use cache';
  cacheLife('hours');
  cacheTag('products');
  return db.query('SELECT * FROM products');
}
```

### `cacheLife` / `cacheTag` / `updateTag`

```typescript
// cacheLife: 有効期間
cacheLife('seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'max');

// cacheTag: 無効化用タグ
cacheTag('posts', 'user-123');

// updateTag: タグでキャッシュ無効化（Server Action 内）
import { updateTag } from 'next/cache';
async function createPost() {
  'use server';
  await db.post.create({ ... });
  updateTag('posts'); // posts タグのキャッシュ全部無効化
}
```

## Partial Prerendering (PPR)

v16 デフォルト動作（Cache Components 有効時）:

- 静的シェル + Suspense で動的部分を stream
- 静的部分は build 時にプリレンダ
- 動的部分は request 時に stream

```tsx
export default function Page() {
  return (
    <>
      <Header /> {/* 静的、プリレンダ */}
      <BlogPosts /> {/* 'use cache' で cached */}
      <Suspense fallback={<Loading />}>
        <UserPreferences /> {/* request時 stream */}
      </Suspense>
    </>
  );
}
```

## Runtime APIs（dynamic rendering強制）

以下を使うと page は dynamic rendering 化:
- `cookies()`
- `headers()`
- **`searchParams`** ★今回該当
- `params`（generateStaticParams 無い場合）

→ 今回の `app/page.tsx` は `searchParams` 使用 → 自動的に dynamic、Cache Components 不要

## 今回の判断（plan.md 採用）

- **Cache Components は採用しない** — `searchParams` 使用で必然的に dynamic、`'use cache'` の追加メリット薄い
- **`fetch` のデフォルト `cache: 'no-store'` に依存** — 検索結果は常に最新が望ましい
- **`generateMetadata` での fetch dedupe を活用** — `app/repositories/[owner]/[repo]/page.tsx` で metadata と本体で同じ fetch があれば自動集約
- **「今後の拡張案」に PPR と Cache Components 採用を明記**

## 落とし穴

### 1. v14 と v15+ の cache デフォルト変更
- v14: `force-cache`（古いデータが返る罠）
- v15+: `no-store`（毎回最新）
- → 既存記事は古い情報、注意

### 2. `searchParams` 使用 = dynamic rendering
- prerendering 不可
- → 検索ページは元々 dynamic でいい

### 3. Server Action で revalidatePath / updateTag
- 今回 Server Action 不採用なので不要
- お気に入り機能等を将来追加する場合に必要

### 4. `'use cache'` のスコープ
- ファイル先頭に置くと exported 関数全部 cache される
- 個別関数の先頭に置くのが安全

### 5. PPR の理解
- Cache Components 有効時 default 動作
- `<Suspense>` boundary が無いと build 時 error（"Uncached data was accessed outside of <Suspense>"）

## 関連 FAQ

| 質問 | 回答 |
|------|------|
| 「fetch のキャッシュをどう設定した？」 | デフォルト（`cache: 'no-store'`、v15+ 標準）、検索結果は常に最新 |
| 「Cache Components を採用しなかった理由は？」 | searchParams で必然的に dynamic、追加メリット薄い。「今後の拡張案」に記載 |
| 「fetch dedupe を活用したか？」 | `generateMetadata` と `page.tsx` の重複 fetch を自動集約 |
| 「PPR は使ってる？」 | 今回未使用、v16 default だが Cache Components 有効化が必要。理解済みで「次やる」 |

## 実装ファイル参照
- `src/infrastructure/github/github-repository-gateway.ts` — fetch のオプション
- README「今後の拡張案」 — PPR / Cache Components 言及
