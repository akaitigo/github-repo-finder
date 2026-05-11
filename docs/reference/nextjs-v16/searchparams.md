# Next.js v16 - searchParams (async)

## 公式ドキュメント
- https://nextjs.org/docs/app/api-reference/file-conventions/page
- バージョン: Next.js v16.2.6（v15.0.0-RC で `params`/`searchParams` が Promise化、v16 でも継続）

## 今回の用途
- `app/page.tsx` で `?q=react` を受け取り Server Component 内で fetch
- `app/repositories/[owner]/[repo]/page.tsx` で `params.owner` / `params.repo` を取得

## 必要なAPI

### 公式の型定義（v15+）

```typescript
type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function Page({ params, searchParams }: Props) {
  const { slug } = await params;
  const { q } = await searchParams;
  return <h1>...</h1>;
}
```

### PageProps ヘルパー（v16 新機能、推奨）

```typescript
// 型インポート不要、グローバル利用可
export default async function Page(props: PageProps<'/repositories/[owner]/[repo]'>) {
  const { owner, repo } = await props.params;
  const query = await props.searchParams;
  return <h1>{owner}/{repo}</h1>;
}
```

- リテラルルート (`'/repositories/[owner]/[repo]'`) を渡すと params の型が自動補完
- `next dev` / `next build` / `next typegen` で型生成
- 静的ルートは `params` が `{}` に解決
- import不要（global）

### URL → searchParams の対応表

| URL | searchParams の解決値 |
|-----|---------------------|
| `/?a=1` | `Promise<{ a: '1' }>` |
| `/?a=1&b=2` | `Promise<{ a: '1', b: '2' }>` |
| `/?a=1&a=2` | `Promise<{ a: ['1', '2'] }>` ← 重複キーで配列 |

### Client Component での使用

Client Component（`async` 不可）では React の `use()` フックを使う:

```typescript
'use client';
import { use } from 'react';

export default function Page({ searchParams }: Props) {
  const { q } = use(searchParams);
}
```

## 落とし穴

### 1. v15 未満との非互換
- v14 以前: `params` / `searchParams` は同期。`{ slug }` で直接アクセス
- v15+: `await` 必須。直接アクセスは backwards compatibility で動くが将来 throw（codemod あり）

### 2. searchParams は dynamic rendering を強制
- `searchParams` を読むと page.tsx は **dynamic rendering** 化
- static generation 不可
- ビルド時にプリレンダリングされない（検索ページとしては正しい挙動）

### 3. URLSearchParams ではなく plain object
- 公式: 「`searchParams` is a plain JavaScript object, not a URLSearchParams instance」
- `.get()` / `.has()` メソッドは使えない
- 直接プロパティアクセス: `searchParams.q`

### 4. 重複キーで配列化（正規化が必要）
- `?q=react&q=vue` で `q: ['react', 'vue']`
- 単一値を期待するロジックが配列を受けると挙動破綻
- → `normalizeSearchParam()` helper 必須

### 5. params は dynamic route segment のみ
- `app/page.tsx` は params なし（dynamic segment が無いため）
- `app/[id]/page.tsx` のように `[xxx]` がある場合のみ params が来る

## 推奨実装パターン

### normalizeSearchParam helper（v3レビューで指摘された seam）

```typescript
// app/_lib/normalize-search-params.ts (Server-only)
export function normalizeSearchParam(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) return value[value.length - 1]; // 最後の値を採用
  return value;
}

// app/page.tsx
export default async function HomePage(
  props: PageProps<'/'>,
) {
  const sp = await props.searchParams;
  const q = normalizeSearchParam(sp.q);
  // ...
}
```

## 関連 FAQ

| 質問 | 回答 |
|------|------|
| 「なぜ searchParams を await する？」 | v15+ で Promise化、Next.js が rendering を並列化するため |
| 「q が string \| string[] になる理由は？」 | URL 仕様、重複キー対応 |
| 「PageProps ヘルパーを使う/使わない理由は？」 | 使う: 型自動補完 + Next.js v16 知識明示 / 使わない: 型生成依存 |
| 「重複キー時の方針は？」 | normalizeSearchParam で最後の値を採用（first/last は要検討） |
| 「searchParams を使うと何が起きる？」 | dynamic rendering 化、static generation 不可 |

## 実装ファイル参照
- `src/app/page.tsx`
- `src/app/repositories/[owner]/[repo]/page.tsx`
- `src/app/_lib/normalize-search-params.ts`（新設）
- `src/app/_lib/render-search-result.tsx`
