# Next.js v16 - Error Handling (error.tsx / not-found.tsx / loading.tsx)

## 公式ドキュメント
- https://nextjs.org/docs/app/api-reference/file-conventions/error
- バージョン: Next.js v16.2.6

## 今回の用途
- `app/error.tsx` (Client、reset/unstable_retry)
- `app/not-found.tsx` (Server、404画面)
- `app/loading.tsx` (Server、Suspense fallback)
- 設計プラン セクション 1-1, 1-2-2, 1-4 (UIマッピング表)

## error.tsx

### 必須要件
- **`'use client'` ディレクティブ必須**（Error boundary は Client Component）
- export default の関数を定義

### Props（v16.2.0+）

```typescript
type Props = {
  error: Error & { digest?: string };
  unstable_retry: () => void; // ★v16.2.0 追加、reset の後継
};
```

### 公式コード例（v16.2+ 推奨パターン）

```typescript
'use client'; // Error boundaries must be Client Components

import { useEffect } from 'react';

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div role="alert">
      <h2>Something went wrong!</h2>
      <button onClick={() => unstable_retry()}>Try again</button>
    </div>
  );
}
```

### `unstable_retry()` vs `reset()` の使い分け

- **`unstable_retry()`**（v16.2.0+ 推奨）: 「再fetch + 再render」を試みる。一時的エラーから回復するため
- **`reset()`**（旧API、まだ使える）: 「error stateをクリアして再render」のみ、再fetchしない
- 公式: 「In most cases, you should use unstable_retry() instead」

### error.digest

- Server Component から forward されたエラーは production で generic message のみ（security）
- `error.digest` = 自動生成 hash → server-side logs と照合可
- Sentry等に digest を送ると追跡しやすい

### error.tsx が wrap する対象

```
error.tsx
├── loading.tsx     ← wrap
├── not-found.tsx   ← wrap
├── page.tsx        ← wrap
└── 入れ子 layout.tsx ← wrap
```

**wrap されない**:
- 同一セグメントの `layout.tsx`, `template.tsx`
- → root layout のエラーは `global-error.tsx` で

### global-error.tsx

```typescript
'use client';

export default function GlobalError({ error, unstable_retry }) {
  return (
    <html>
      <body>
        <h2>Something went wrong!</h2>
        <button onClick={() => unstable_retry()}>Try again</button>
      </body>
    </html>
  );
}
```

- root layout のエラー対応
- `<html>` `<body>` を**自分で含める**必要あり
- metadata/generateMetadata は使えない（React の `<title>` 使う）

## not-found.tsx

### 公式パターン

```typescript
// app/not-found.tsx (Server Component)
import Link from 'next/link';

export default function NotFound() {
  return (
    <div>
      <h2>404 - Not Found</h2>
      <p>探しているリポジトリが見つかりません</p>
      <Link href="/">トップに戻る</Link>
    </div>
  );
}
```

### 呼び出し方

```typescript
// app/repositories/[owner]/[repo]/page.tsx
import { notFound } from 'next/navigation';

export default async function DetailPage(props) {
  const { owner, repo } = await props.params;
  const result = await createDetailUseCase().execute(owner, repo);
  if (!result.ok && result.error.kind === 'not-found') {
    notFound(); // → app/not-found.tsx 表示
  }
  // ...
}
```

- `notFound()` は throw で動作（後続コードは実行されない）
- React の `redirect()` と同様の internal mechanism

## loading.tsx

```typescript
// app/loading.tsx (Server Component)
export default function Loading() {
  return <div role="status" aria-live="polite">読み込み中...</div>;
}
```

- 自動的に `<Suspense>` boundary として機能
- 同一セグメントの `page.tsx` の async 完了まで表示
- skeleton UI を入れると体験向上

## 階層関係（最終確認）

```
app/
├── layout.tsx        ← global wrap（error.tsx より外）
├── global-error.tsx  ← layout のエラー（root のみ）
├── error.tsx         ← page/loading/not-found を wrap
├── loading.tsx       ← Suspense fallback
├── not-found.tsx     ← notFound() 呼出時
└── page.tsx          ← メインコンテンツ
```

## 落とし穴

### 1. `reset()` を使い続ける罠
- v3 PLAN や古い記事では `reset()`
- v16.2+ では `unstable_retry()` 推奨
- → 本プロジェクトでは **`unstable_retry()` を使う方がv16 ベストプラクティス準拠**

### 2. error.tsx に `'use client'` 忘れ
- ビルドエラー: 「Error components must be Client Components」
- 必須

### 3. error.digest の扱い
- production と dev で挙動違い
- production: generic message のみ表示、digest を log と照合
- dev: 元の error message が出る

### 4. global-error.tsx に html/body 入れ忘れ
- root layout を replace するため、自分で html/body 必要
- 入れ忘れると blank ページ

### 5. error.tsx をテストする難しさ
- Vitest で `<ErrorBoundary />` 単体は描画可能
- ただし `unstable_retry` の挙動は実際の Next.js runtime に依存
- 推奨: `reset` の呼び出しを `vi.fn()` で監視 + axe で違反検証（snapshot 不要）

## テスト例

```typescript
// app/error.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import Error from './error';

describe('error.tsx', () => {
  it('calls unstable_retry on button click', async () => {
    const retry = vi.fn();
    render(<Error error={new Error('test')} unstable_retry={retry} />);
    await userEvent.click(screen.getByRole('button', { name: /try again|再試行/i }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('has no a11y violations', async () => {
    const { container } = render(<Error error={new Error('test')} unstable_retry={() => {}} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
```

## 関連 FAQ

| 質問 | 回答 |
|------|------|
| 「なぜ error.tsx は Client Component？」 | Error boundary は React のクラスコンポーネント機能、Server Component では使えない |
| 「unstable_retry と reset の違い？」 | unstable_retry は再fetch + 再render、reset は state クリアのみ。v16.2+ では unstable_retry 推奨 |
| 「error.digest の用途は？」 | production で generic message を表示しつつ、サーバーログと照合するための hash |
| 「snapshot ではなく reset() 動作確認した理由は？」 | snapshot は壊れやすく価値が低い、契約（reset 呼び出される）を検証する方が回帰検知に効く |

## 実装ファイル参照
- `src/app/error.tsx` (Client、unstable_retry)
- `src/app/not-found.tsx` (Server)
- `src/app/loading.tsx` (Server)
- `tests/integration/app/error-boundary.test.tsx`
