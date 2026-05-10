# Next.js v16 - Server and Client Components

## 公式ドキュメント
- https://nextjs.org/docs/app/getting-started/server-and-client-components
- バージョン: Next.js v16.2.6

## 今回の用途
- `app/page.tsx` を Server Component として実装、`<SearchForm />` のみ Client
- `<RepositoryList />`, `<RepositoryCard />`, `<RepositoryDetail />` を Server Component
- plan.md セクション 1-2-2 (Server/Client境界決定表)

## 基本原則

**デフォルトは Server Component**。Layout/Page/Component は明示しない限り Server。

| 用途 | Server / Client |
|------|----------------|
| データ fetch（DB / 外部API） | **Server** |
| API キー / token を扱う | **Server**（client bundle に漏れない）|
| state（useState） | **Client** |
| イベントハンドラ（onClick, onChange） | **Client** |
| ライフサイクル（useEffect） | **Client** |
| ブラウザAPI（localStorage, window） | **Client** |
| カスタムフック | **Client** |
| 純粋表示 | **Server**（JS削減）|

## 'use client' の境界

```typescript
// app/ui/search-form.tsx
'use client';

import { useState } from 'react';

export default function SearchForm() {
  const [value, setValue] = useState('');
  return <input value={value} onChange={e => setValue(e.target.value)} />;
}
```

- ファイル先頭に `'use client'` を置く
- **そのファイルと、そこから import される子孫すべてが client bundle に入る**
- 子コンポーネントには `'use client'` 重複不要

## Composition Pattern

### Server → Client（props で渡す）

```typescript
// app/page.tsx (Server)
import LikeButton from '@/app/ui/like-button';

export default async function Page({ params }: Props) {
  const post = await getPost((await params).id);
  return <LikeButton likes={post.likes} />;
}

// app/ui/like-button.tsx (Client)
'use client';
import { useState } from 'react';

export default function LikeButton({ likes }: { likes: number }) {
  // ...
}
```

⚠️ **Props は serializable のみ**（function, Date, class instance などは渡せない）

### Client が Server を children で受ける（Slot Pattern）

```typescript
// app/ui/modal.tsx (Client)
'use client';
export default function Modal({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}

// app/page.tsx (Server)
import Modal from './ui/modal';
import Cart from './ui/cart';

export default function Page() {
  return (
    <Modal>
      <Cart />  {/* Server Component が Client の children として描画される */}
    </Modal>
  );
}
```

これで Server Component が Client の中に visually nest できる。

### Third-party Component（client-only）の wrap

`useState` を使う3rdパーティを Server で使う場合、自前 Client wrapper が必要:

```typescript
// app/carousel.tsx (Client wrapper)
'use client';
import { Carousel } from 'acme-carousel';
export default Carousel;

// app/page.tsx (Server)
import Carousel from './carousel';
```

## Context Provider のパターン

React Context は Server Component **未対応**。Client Component で Provider を作り、Server の layout で wrap:

```typescript
// app/theme-provider.tsx (Client)
'use client';
import { createContext } from 'react';
export const ThemeContext = createContext({});
export default function ThemeProvider({ children }) {
  return <ThemeContext.Provider value="dark">{children}</ThemeContext.Provider>;
}

// app/layout.tsx (Server)
import ThemeProvider from './theme-provider';
export default function RootLayout({ children }) {
  return (
    <html><body>
      <ThemeProvider>{children}</ThemeProvider>
    </body></html>
  );
}
```

⚠️ Provider は **deep に置く**（`<html>` 全体ではなく `{children}` だけ wrap）。Server Component の static optimization のため。

## Environment Poisoning 防止

### `NEXT_PUBLIC_` プレフィックス

- `NEXT_PUBLIC_` 付き → client bundle に含まれる
- 付かない → empty string に置換される（build-time）
- `process.env.GITHUB_TOKEN` は client では空文字、Server でのみ実値

### `import 'server-only'` パッケージ

```typescript
// lib/data.ts
import 'server-only';

export async function getData() {
  const res = await fetch('https://api.github.com/...', {
    headers: { authorization: process.env.GITHUB_TOKEN }
  });
  return res.json();
}
```

- Client Component から import すると **build-time error**
- インストールはオプション（Next.js が独自 type declaration 内蔵）
- TypeScript の `noUncheckedSideEffectImports` が active なら型エラーで早期検知

### `import 'client-only'` パッケージ

`window` を触る module を marker するために使う。

## RSC（React Server Component Payload）

Server で:
- Server Components → **RSC Payload**（compact binary representation）にレンダリング
- Client Components + RSC Payload → HTML プリレンダリング

Client で:
1. HTML が即座に non-interactive プレビュー表示
2. RSC Payload で Client/Server コンポーネントツリー reconcile
3. JavaScript で Client Components を hydration（イベントハンドラ attach）

その後のナビゲーション:
- RSC Payload を prefetch & cache → instant navigation
- Client Components はクライアントで render（HTML 不要）

## 落とし穴

### 1. Server Component に onClick 渡そうとする
```typescript
// ❌ 動かない（Server Component に callback prop は不可）
<RateLimitDisplay onRetry={() => router.refresh()} />
```
→ Retry ボタンは Client Component に切り出す or `<Link href="/?q={q}">` で代替

### 2. Server Component で useState/useEffect
```typescript
// ❌ ビルドエラー
export default function Page() {
  const [x, setX] = useState(0);
}
```
→ `'use client'` を付けるか、interactive 部分だけ別ファイルに切り出す

### 3. 'use client' の影響範囲を理解せずバンドルが膨らむ
- 最上位 layout に `'use client'` 付けると **全部 Client bundle**
- 細かく分割: Layout/Page は Server、interactive 部品だけ Client

### 4. Props serialization 制約
- Date, RegExp, function, class instance は serializable でない
- → ISO string, plain object に変換してから渡す
- `Repository.updatedAt: Date` を Client に渡す場合、Server側で `toISOString()` するか、Client側で `new Date()` する設計判断必要

### 5. server-only と client-only の混入チェック
- container.ts に `import 'server-only'` を付けたら、Client Component から import すると build エラー
- テスト時は `vi.mock('server-only', () => ({}))` または `resolve.alias` で stub

## Server / Client 決定フロー

```
1. interactivity (state, event, browser API) が必要？
   YES → Client
   NO → 2へ

2. token / API key / DB 接続が必要？
   YES → Server
   NO → 3へ

3. 純粋表示？
   YES → Server (JS削減・SEO最適化)
   NO → ケースバイケース
```

## 関連 FAQ

| 質問 | 回答 |
|------|------|
| 「'use client' をどこに置く判断基準は？」 | 最も狭く、interactive な責務を持つ component のみ |
| 「Server Component から Client に何を渡せる？」 | serializable な値のみ（plain object, primitive） |
| 「Context Provider をどこに置いた？」 | Client Component で作り、Server layout で `{children}` のみ wrap |
| 「token を Client に漏らさない仕組みは？」 | `NEXT_PUBLIC_` プレフィックスなし + `import 'server-only'` |
| 「なぜ `useRepositorySearch` hook を作らなかった？」 | searchParams で URL同期、Server fetch で完結、Client hookは不要（Composition Root原則） |

## 実装ファイル参照
- `src/app/page.tsx` (Server)
- `src/app/repositories/[owner]/[repo]/page.tsx` (Server)
- `src/app/_lib/container.ts` (Server-only)
- `src/app/_lib/render-search-result.tsx` (Server-only)
- `src/app/error.tsx` (Client、Next.js仕様)
- `src/presentation/components/search-form.tsx` (Client)
- 他 presentation/components/* は Server
