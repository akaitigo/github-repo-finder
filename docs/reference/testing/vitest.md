# Vitest v4 - Configuration

## 公式ドキュメント
- https://vitest.dev/config/
- https://vitest.dev/guide/projects.html
- バージョン: Vitest v4.x

## 今回の用途
- ユニット / 結合 / E2E（外）の3種テストを 1 設定で管理
- 設計プラン セクション 2-3, 2-5 (vitest.config.ts 構成)

## 基本構造

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // テスト設定
  },
  // resolve.alias 等の Vite 設定はトップレベル
});
```

Vitest は Vite 設定を継承するので、`resolve.alias`, `define` 等も使える。

## test.projects（v3+ 推奨、旧 workspace 廃止）

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['src/domain/**/*.test.ts', 'src/application/**/*.test.ts', 'src/infrastructure/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'integration',
          include: ['src/presentation/**/*.test.tsx', 'tests/integration/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
          setupFiles: ['./vitest.setup.integration.ts'],
        },
      },
    ],
  },
});
```

実行:
```bash
pnpm vitest               # 全 project
pnpm vitest --project unit
pnpm vitest --project integration
```

🔴 **注意**: v3 以前の `vitest.workspace.ts` は **deprecated**。`test.projects` に移行推奨。

## pool オプション

| pool | 動作 | 用途 |
|------|------|------|
| `'threads'`（default） | Worker thread で並列 | 一般的、高速 |
| `'forks'` | 子プロセス fork | **process isolation 必要時**（`server-only` 等の global state） |
| `'vmThreads'` | VM context | 古いVue/React で使う |

→ `import 'server-only'` を使う場合 `pool: 'forks'` 推奨（global mock の伝播のため）

## environment

| environment | 用途 |
|-------------|------|
| `'node'`（default） | サーバーサイドコード（domain, application, infrastructure） |
| `'jsdom'` | DOM が必要なテスト（components, app/_lib） |
| `'happy-dom'` | jsdom 互換、より高速、新しいブラウザAPI 対応 |

## setupFiles

各テストファイル前に実行される setup スクリプト:

```typescript
// vitest.setup.integration.ts
import { beforeAll, afterEach, afterAll } from 'vitest';
import { server } from './tests/helpers/msw/server';
import * as matchers from 'vitest-axe/matchers';
import { expect } from 'vitest';

expect.extend(matchers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

```typescript
// vitest.config.ts
test: {
  setupFiles: ['./vitest.setup.integration.ts'],
}
```

## coverage オプション

```typescript
test: {
  coverage: {
    provider: 'v8', // または 'istanbul'
    reporter: ['text', 'json', 'html'],
    exclude: [
      'src/app/**/page.tsx',  // ★薄殻、テスト対象外
      'src/app/**/layout.tsx',
      '**/*.test.{ts,tsx}',
      '**/index.ts',
    ],
    thresholds: {
      lines: 75,      // CI 必須下限（global）
      functions: 75,
      branches: 75,   // branch 重視
      statements: 75,
    },
  },
}
```

CI で `pnpm vitest run --coverage` で機械検証。

## resolve.alias

`server-only` を mock したい場合:

```typescript
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'), // tsconfig paths と整合
      'server-only': path.resolve(__dirname, './tests/helpers/server-only-stub.ts'),
    },
  },
  test: { /* ... */ },
});
```

```typescript
// tests/helpers/server-only-stub.ts
export {};
```

## include / exclude

```typescript
test: {
  include: ['src/**/*.test.{ts,tsx}', 'tests/integration/**/*.test.{ts,tsx}'],
  exclude: [
    ...configDefaults.exclude, // node_modules, .next, etc.
    'tests/e2e/**',           // Playwright が管理
  ],
}
```

## globals 有効化

```typescript
test: {
  globals: true, // describe, it, expect, vi を import 不要に
}
```

→ tsconfig.json にも追加:

```json
{
  "compilerOptions": {
    "types": ["vitest/globals"]
  }
}
```

## TypeScript 統合

```bash
pnpm add -D @types/node
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  }
}
```

## 落とし穴

### 1. workspace → projects への移行
- `vitest.workspace.ts` は v3 で deprecated
- `vitest.config.ts` の `test.projects` に統合

### 2. environment 指定漏れ
- jsdom 指定なしで `<div>` レンダリングテスト → エラー
- 各 project で明示

### 3. setupFiles の global pollution
- MSW server を unit project にも適用すると、不要な intercept で性能低下
- project ごとに setup 分離

### 4. pool: 'threads' で server-only mock が効かない
- thread 間で global state 共有不可
- → `pool: 'forks'` に切替 or `resolve.alias` で stub

### 5. coverage の include 漏れ
- デフォルトで `src/**` が含まれるが、`tests/integration/**` も対象にする場合は明示

## 関連 FAQ

| 質問 | 回答 |
|------|------|
| 「なぜ test.projects で分けた？」 | unit (node) と integration (jsdom + MSW) で環境とリソースを分離、CI 時間短縮 |
| 「pool は何を選んだ？」 | `forks`（server-only mock を確実に効かせるため） |
| 「coverage の exclude で page.tsx を外した理由は？」 | 5行薄殻、ロジックは `_lib/render-*.tsx` に抽出、そちらで網羅 |
| 「workspace と projects の違いは？」 | workspace は別ファイル、projects は config 内で統合。v3 以降は projects 推奨 |

## 実装ファイル参照
- `vitest.config.ts`
- `vitest.setup.integration.ts`
- `tests/helpers/server-only-stub.ts`（resolve.alias 経由）
