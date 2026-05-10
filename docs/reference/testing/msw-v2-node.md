# MSW v2 - Node Server Mode

## 公式ドキュメント
- https://mswjs.io/docs/integrations/node
- https://mswjs.io/docs/api/setup-server
- バージョン: MSW v2.x

## 今回の用途
- presentation 結合テストで GitHub API を mock
- Server Component fetch も Node 環境で MSW で intercept
- 設計プラン セクション 2-3 (テスト設計指針)、2-4 (Next.js v16 固有指針)

## なぜ Node mode か

| テスト種別 | 環境 | MSW モード |
|----------|------|----------|
| Browser テスト（Playwright等） | Browser | `setupWorker` (Service Worker) |
| Vitest + jsdom | Node + jsdom | **`setupServer` (Node)** ★今回 |
| Server Component fetch | Node | **`setupServer`** (一致) |

Next.js v16 の Server Component で `fetch` を呼ぶ場合、それは Node 上で実行される → `setupServer` で intercept 可能（jsdom の handlers ではない）

## セットアップ

### 1. インストール

```bash
pnpm add -D msw
```

### 2. ハンドラ定義（v2 構文）

```typescript
// tests/helpers/msw/handlers.ts
import { http, HttpResponse } from 'msw';
import searchSuccess from '../../fixtures/github-api/search-success.json';

export const handlers = [
  http.get('https://api.github.com/search/repositories', ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get('q');
    if (!q) return new HttpResponse(null, { status: 422 });
    return HttpResponse.json(searchSuccess);
  }),

  http.get('https://api.github.com/repos/:owner/:repo', ({ params }) => {
    const { owner, repo } = params;
    if (owner === 'notexist123' && repo === 'notexist123') {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json({ /* ... */ });
  }),
];
```

### 3. Server セットアップ

```typescript
// tests/helpers/msw/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

### 4. Vitest 統合

```typescript
// vitest.setup.ts
import { beforeAll, afterEach, afterAll } from 'vitest';
import { server } from './tests/helpers/msw/server';

beforeAll(() => server.listen({
  onUnhandledRequest: 'error',  // ★unhandled request で fail（リーク即検知）
}));

afterEach(() => server.resetHandlers());

afterAll(() => server.close());
```

`vitest.config.ts` で setupFiles 登録:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./vitest.setup.ts'],
    environment: 'jsdom',
    globals: true,
  },
});
```

## ライフサイクル

| メソッド | タイミング | 役割 |
|---------|----------|------|
| `server.listen({ onUnhandledRequest })` | beforeAll | mock 開始 |
| `server.use(...handlers)` | テスト内 | local handler 追加（一時的） |
| `server.resetHandlers()` | afterEach | use() で追加した handler クリア |
| `server.close()` | afterAll | native fetch 復帰 |

## `onUnhandledRequest` オプション

| 値 | 挙動 |
|----|------|
| `'warn'`（デフォルト） | console warning のみ、テストは pass |
| **`'error'`**（★推奨） | unhandled request で test FAIL |
| `'bypass'` | 実APIに通す（dangerous、E2E で稀に使う） |

🔴 **`'error'` 必須**: 想定外リクエスト（new endpoint 追加忘れ等）を即検知できる

## `server.use()` で local handler 注入

```typescript
import { server } from '@/tests/helpers/msw/server';

it('handles rate limit', async () => {
  // global handler を上書き、このテストだけ rate-limit を返す
  server.use(
    http.get('https://api.github.com/search/repositories', () => {
      return new HttpResponse(null, {
        status: 403,
        headers: {
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600),
          'x-ratelimit-resource': 'search',
        },
      });
    }),
  );

  // テスト本体
  // ...
});

// afterEach の resetHandlers() で global に戻る
```

## Vitest workspace との統合（v3レビューで指摘）

```typescript
// vitest.config.ts (Vitest 最新は projects 形式、workspace は deprecated)
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        // ユニットテスト（domain, application, infrastructure）
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts'],
          environment: 'node',  // jsdom 不要
          setupFiles: ['./vitest.setup.unit.ts'], // MSW 不要
        },
      },
      {
        // 結合テスト（components, app/_lib）
        test: {
          name: 'integration',
          include: [
            'src/**/*.test.tsx',
            'tests/integration/**/*.test.{ts,tsx}',
          ],
          environment: 'jsdom',
          setupFiles: ['./vitest.setup.integration.ts'], // MSW あり
        },
      },
    ],
  },
});
```

→ unit と integration で setup を分離、MSW は integration のみで起動。

## Server Component との相性

- Server Component で `fetch` を呼ぶコード → Node 上で実行
- `setupServer` は Node の `fetch` を intercept 可能
- ただし、Server Component 自体を Vitest で直接テストするのは公式非サポート
- → helper 抽出して helper をテスト + MSW で `fetch` mock

## 落とし穴

### 1. `setupWorker` と `setupServer` の混同
- Browser → `setupWorker`（Service Worker）
- Vitest jsdom → **`setupServer`** ★今回
- 間違うと「fetch が intercept されない」

### 2. `onUnhandledRequest` 未指定で leak
- デフォルト `'warn'` だと unhandled でテスト pass
- 想定外 API 呼び出しを見逃す
- → `'error'` 必須

### 3. `resetHandlers()` 忘れ
- テスト間で handler が残ると、次のテストが汚染される
- afterEach で必ず

### 4. fetch URL の絶対 URL 必須
- MSW は URL マッチングなので、相対 URL `'/api/...'` は intercept できない
- 完全な URL `'https://api.github.com/...'` で fetch する

### 5. handlers の export 順序
- 最初にマッチしたものが採用される
- specific → general の順で並べる

## 関連 FAQ

| 質問 | 回答 |
|------|------|
| 「なぜ MSW を Node mode で？」 | Vitest は Node 環境、Server Component fetch も Node、Service Worker は無い |
| 「onUnhandledRequest を 'error' にした理由は？」 | 想定外リクエストを即検知、テストの leak 防止 |
| 「server.use() の使いどころは？」 | グローバル handler を一時上書き（rate limit シナリオ等） |
| 「workspace が deprecated って？」 | Vitest 最新は `projects` 形式に統合、`vitest.config.ts` の `test.projects` で設定 |
| 「unit と integration で環境分離した理由は？」 | unit は Node でMSW不要、integration は jsdom + MSW でリソース効率化 |

## 実装ファイル参照
- `tests/helpers/msw/handlers.ts`
- `tests/helpers/msw/server.ts`
- `vitest.setup.unit.ts`
- `vitest.setup.integration.ts`
- `vitest.config.ts`
