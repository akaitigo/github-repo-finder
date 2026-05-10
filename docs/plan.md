# github-repo-finder — 設計プラン

> 設計の核と判断根拠を記述。実装は本プランに沿って `docs/issues/` の Issue 1〜11 で進める。
> `docs/reference/` 配下に公式ドキュメント抜粋を配置（実装中に参照）。

---

## 設計の核となる判断（37項目を7階層に分類）

### Tier 1: 型・実装直結（必須9件、設計の整合性）

| # | 内容 |
|---|------|
| 1 | `SearchResult` 型を 1-3 に追加（GitHub API の `total_count`, `incomplete_results` 準拠） |
| 2 | `ApplicationError` は 8 kind discriminated union（旧7種類記述を訂正） |
| 3 | **422 → `upstream-error` に倒す**（`invalid-query.reason='empty'\|'too-long'`では型レベル写像不可） |
| 4 | `map-gateway-error` の `malformed-response{cause}` → `malformed-response`/`schema-mismatch` 2 kind 変換ルール明記 |
| 5 | **`presentation → domain` (type-only) 依存ルール追記** — 依存図 + ESLint |
| 6 | `ValidationError → ApplicationError` 変換責務明記（`map-validation-error.ts` or use-case 内） |
| 7 | **`searchParams` 正規化 helper (`normalizeSearchParam`)** 新設 |
| 8 | **403判定**: `x-ratelimit-remaining` で「rate limit / secondary / forbidden」の3分類、SSO 判定は公式に `X-GitHub-SSO` ヘッダ未明記のため `forbidden{reason:'unknown'}` を fallback |
| 9 | **`forbidden.reason = 'abuse-detection'` 削除** — `secondary-rate-limited` と重複 |

### Tier 2: 実装ストーリー（5件）

| # | 内容 |
|---|------|
| 10 | `vitest.workspace.ts` → `vitest.config.ts (test.projects)` 全文置換（v3 全箇所） |
| 11 | **Tailwind v4 + `@theme` 構文 + `next lint` 廃止対応**確定（reference/styling/tailwind-v4.md） |
| 12 | shadcn add 対象 component 明記（`button`/`input`/`card`/`skeleton`/`alert`） |
| 13 | Issue #5/#6 再分割 — application層のみ #5、Server Component 周辺一括 #6 |
| 14 | **`error.tsx` の `reset()` → `unstable_retry()`** に変更（Next.js v16.2.0+ 推奨） |

### Tier 3: リポジトリ準備（4件）

| # | 内容 |
|---|------|
| 15 | LICENSE (MIT) 配置 — Issue #1 |
| 16 | `.gitignore` で `.env*.local` 除外確認 + `git log --all -p \| grep ghp_` 履歴チェック |
| 17 | XSS対策: `dangerouslySetInnerHTML` ESLint禁止、`htmlUrl` の `javascript:` チェック、description XSS テスト |
| 18 | `pnpm audit --prod` clean 確認 |

### Tier 4: README構成（10件、閲覧者の視点最適化）

| # | 内容 |
|---|------|
| 20 | 「設計思想3行サマリ」を3画面目に |
| 21 | AI活用レポート冒頭に「**AI判断責任は私**」1行 |
| 22 | 「Backend から見た Next.js」3行に圧縮（Hexagonal/sealed/Composition Root） |
| 23 | continuation plan 「**次に潰すリスク順**」表現に、Sentry #1 突出 |
| 24 | 「制約と判断」表 列削減（時間あればやりたかった列を脚注へ） |
| 25 | 「今後の拡張案」3カテゴリ整理（運用 / データ / UX） |
| 26 | License / Author / **Requirements セクション**追加（Requirements を License前に） |
| 27 | クイックスタート 5ステップ（短縮版+詳細版）+ サポート連絡先 |
| 28 | AI活用「修正」列簡素化 — before/after は「却下」のみ |
| 29 | スクショ7枚を具体指定（PC×4、モバイル×iPhone 14 ProMax + SE、横向きRate Limit、a11y） |

### Tier 5: 運用・アクセシビリティ（5件、ADR/READMEで吸収）

| # | 内容 |
|---|------|
| 30 | 色情報のみで状態を伝えない / `aria-live` / `prefers-reduced-motion` |
| 31 | CSP 最低限設定（`next.config.js` headers） |
| 32 | Web Vitals 閾値（LCP<2.5s, INP<200ms, CLS<0.1） |
| 33 | 構造化ログ（`{ kind, message, requestId }`） |
| 34 | `pnpm audit --prod clean` 実行（README に記載） |

### Tier 6: スコープ凍結（2件）

| # | 内容 |
|---|------|
| 35 | render-search-result の全 kind 網羅テスト → **`assertNever` 使用**（runtime exhaustive 不要） |
| 36 | `render-*.tsx` の `server-only` 削除 or `resolve.alias` で stub（テストコスト>安全性） |

### Tier 7: README整合性メタ規則

| # | 内容 |
|---|------|
| 37 | **README短縮版（3行サマリ・3行表）と 設計プラン / ADR の整合性メタ規則** — 短縮版変更時はフル版も同期する旨を `docs/README-sync-rule.md` に明記。読者が「READMEだけ更新されて本体と齟齬」を見ると、設計の一貫性評価が逆に減点に転じるリスクを防ぐ |

---

## 1. アーキテクチャ（軽量レイヤード + Composition Root）

### 1-1. ディレクトリ構造（v4）

```
src/
├── domain/
│   ├── repository/
│   │   ├── repository.ts                  Repository（不変ドメインモデル）
│   │   └── repository.test.ts
│   ├── search/
│   │   ├── search-query.ts                SearchQuery 値オブジェクト
│   │   ├── validation-error.ts          ★: { kind: 'empty' | 'too-long' }
│   │   └── search-query.test.ts
│   └── shared/
│       ├── result.ts                      Result<T, E>
│       └── result.test.ts
│
├── application/
│   ├── ports/
│   │   ├── repository-gateway.ts          interface
│   │   └── gateway-error.ts             ★配置維持
│   ├── types/
│   │   └── search-result.ts             ★: SearchResult 型
│   ├── use-cases/
│   │   ├── _internal/
│   │   │   ├── map-gateway-error.ts
│   │   │   ├── map-gateway-error.test.ts
│   │   │   ├── map-validation-error.ts  ★: ValidationError → invalid-query
│   │   │   └── map-validation-error.test.ts
│   │   ├── search-repositories.ts
│   │   ├── search-repositories.test.ts
│   │   ├── get-repository-detail.ts
│   │   └── get-repository-detail.test.ts
│   └── errors/
│       └── application-error.ts           discriminated union（8 kind）
│
├── infrastructure/
│   └── github/
│       ├── github-repository-gateway.ts
│       ├── github-repository-gateway.test.ts
│       ├── github-api-types.ts            zodスキーマ + 型
│       └── github-api-mapper.ts
│
├── presentation/
│   └── components/
│       ├── search-form.tsx                ★Client（'use client'、useState/useRouter）
│       ├── search-form.test.tsx
│       ├── repository-list.tsx            ★Server
│       ├── repository-card.tsx            ★Server
│       ├── repository-detail.tsx          ★Server
│       ├── empty-state.tsx                ★Server（reason prop）
│       ├── loading-state.tsx              ★Server
│       ├── rate-limit-display.tsx         ★Server: reset時刻表示 + <Link>でRetry
│       ├── error-state.tsx                ★Client（error.tsx内利用前提、reason prop）
│       └── ui/                            ← shadcn/ui 生成物
│
└── app/                                 ← Composition Root + Routing（4層の外側）
    ├── _lib/
    │   ├── container.ts                   factory（server-only削除）
    │   ├── normalize-search-params.ts   ★: q?: string | string[] → string | undefined
    │   ├── render-search-result.tsx     純粋関数（server-only削除、resolve.aliasでstub）
    │   └── render-detail.tsx
    ├── layout.tsx
    ├── page.tsx                            ★Server（5行薄殻）
    ├── repositories/[owner]/[repo]/
    │   └── page.tsx                        ★Server（5行薄殻）
    ├── error.tsx                           ★Client（unstable_retry使用）
    ├── loading.tsx                         ★Server
    ├── not-found.tsx                       ★Server
    └── globals.css                         @import "tailwindcss"

tests/
├── e2e/
│   └── search-flow.spec.ts                 happy + deep link
├── integration/
│   └── app/
│       ├── render-search-result.test.tsx
│       ├── render-detail.test.tsx
│       └── error-boundary.test.tsx         unstable_retry実行確認 + axe
├── fixtures/
│   └── github-api/
│       ├── search-success.json
│       ├── search-empty.json
│       ├── repository-detail.json
│       ├── rate-limit-403.json
│       ├── secondary-rate-limit-403.json
│       ├── forbidden-403.json
│       └── server-error-500.json
└── helpers/
    ├── msw/
    │   ├── handlers.ts
    │   └── server.ts                       node mode + onUnhandledRequest: 'error'
    ├── factories/
    │   ├── repository.ts
    │   └── search-result.ts
    └── test-doubles.ts                     FakeRepositoryGateway
```

### 1-2. 依存方向ルール（最終版）

```
[app (composition root)]  ──→ [application] + [presentation] + [infrastructure] + [domain]
[presentation]            ──→ [application] + [domain (type-only)]  ★v4 明示
[application]             ──→ [domain]
[infrastructure]          ──→ [application/ports] + [domain]
[domain]                  ──→ (nothing)  ← 純粋
```

**ESLint 設定**:
```javascript
// eslint.config.mjs
{
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        {
          // domain は他層全部禁止
          group: ['*/application/*', '*/infrastructure/*', '*/presentation/*', '*/app/*'],
          message: 'domain depends on nothing (path:domain)',
        },
        {
          // application は infra/presentation/app 禁止（domain と ports は OK）
          group: ['*/infrastructure/*', '*/presentation/*', '*/app/*'],
          message: 'application depends only on domain + own ports (path:application)',
        },
        {
          // presentation は infrastructure/app 禁止（application + domain type は OK）
          group: ['*/infrastructure/*', '*/app/*'],
          message: 'presentation depends on application and domain types only (path:presentation)',
          allowTypeImports: true, // domain は type-only でOK
        },
      ],
    }],
    'no-restricted-syntax': ['error', {
      // dangerouslySetInnerHTML 禁止
      selector: 'JSXAttribute[name.name="dangerouslySetInnerHTML"]',
      message: 'dangerouslySetInnerHTML is forbidden (XSS prevention)',
    }],
  },
}
```

### 1-2-1. 実行配置と Composition Root

参照: [reference/nextjs-v16/server-components.md](reference/nextjs-v16/server-components.md), [reference/nextjs-v16/searchparams.md](reference/nextjs-v16/searchparams.md)

**Composition Root**: `app/_lib/container.ts`（factory、`app/page.tsx` から呼ばれる）

```typescript
// app/_lib/container.ts (Server module、server-only依存はやめる)
import { GitHubRepositoryGateway } from '@/infrastructure/github/github-repository-gateway';
import { SearchRepositoriesUseCase } from '@/application/use-cases/search-repositories';
import { GetRepositoryDetailUseCase } from '@/application/use-cases/get-repository-detail';

export function createSearchUseCase() {
  const gateway = new GitHubRepositoryGateway(process.env.GITHUB_TOKEN);
  return new SearchRepositoriesUseCase(gateway);
}

export function createDetailUseCase() {
  const gateway = new GitHubRepositoryGateway(process.env.GITHUB_TOKEN);
  return new GetRepositoryDetailUseCase(gateway);
}
```

```typescript
// app/_lib/normalize-search-params.ts 
export function normalizeSearchParam(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) return value[value.length - 1]; // 最後の値を採用
  return value;
}
```

```typescript
// app/page.tsx (5行薄殻、PageProps ヘルパー使用 = v16新機能)
import { createSearchUseCase } from './_lib/container';
import { renderSearchResult } from './_lib/render-search-result';
import { normalizeSearchParam } from './_lib/normalize-search-params';

export default async function HomePage(props: PageProps<'/'>) {
  const sp = await props.searchParams;
  const q = normalizeSearchParam(sp.q);
  const result = q ? await createSearchUseCase().execute(q) : null;
  return renderSearchResult(q, result);
}
```

```typescript
// app/_lib/render-search-result.tsx (純粋関数、テスト対象)
import { assertNever } from '@/lib/assert-never';

export function renderSearchResult(
  q: string | undefined,
  result: Result<SearchResult, ApplicationError> | null,
): React.ReactNode {
  if (!q || !result) return <EmptyState reason="initial" />;
  if (!result.ok) {
    const error = result.error;
    switch (error.kind) {
      case 'invalid-query':       return <EmptyState reason="invalid-query" />;
      case 'rate-limit':          return <RateLimitDisplay resetAt={error.resetAt} q={q} />;
      case 'forbidden':           return <ErrorState reason="forbidden" detail={error.reason} />;
      case 'not-found':           return <EmptyState reason="no-results" />;
      case 'upstream-error':      return <ErrorState reason="upstream" status={error.status} />;
      case 'malformed-response':  return <ErrorState reason="malformed" />;
      case 'schema-mismatch':     return <ErrorState reason="schema" />;
      case 'network':             return <ErrorState reason="network" />;
      default: assertNever(error); // ★compile-time 網羅性チェック
    }
  }
  if (result.value.items.length === 0) return <EmptyState reason="no-results" />;
  return <RepositoryList items={result.value.items} />;
}
```

### 1-2-2. Server/Client 境界決定表（完成版）

| コンポーネント | Server/Client | 根拠 |
|---|---|---|
| `app/page.tsx` | Server | Composition Root + await fetch |
| `app/repositories/[owner]/[repo]/page.tsx` | Server | 同上 |
| `app/error.tsx` | Client | Next.js仕様、`unstable_retry` prop |
| `app/loading.tsx` | Server | Suspense fallback、純粋表示 |
| `app/not-found.tsx` | Server | 純粋表示 |
| `app/_lib/container.ts` | Server module | factory（server-only パッケージは未使用、reference参照） |
| `app/_lib/normalize-search-params.ts` | Server module | 純粋関数 |
| `app/_lib/render-search-result.tsx` | Server module | 純粋関数 |
| `app/_lib/render-detail.tsx` | Server module | 同上 |
| `presentation/components/search-form.tsx` | Client | useState + useRouter().push |
| `presentation/components/repository-list.tsx` | Server | 純粋表示 |
| `presentation/components/repository-card.tsx` | Server | 純粋表示 |
| `presentation/components/repository-detail.tsx` | Server | 純粋表示 |
| `presentation/components/empty-state.tsx` | Server | reason prop で表示分岐 |
| `presentation/components/loading-state.tsx` | Server | Suspense fallback |
| `presentation/components/rate-limit-display.tsx` | Server | reset時刻表示 + `<Link href="/?q={q}">` でRetry（callbackなし） |
| `presentation/components/error-state.tsx` | Client | `error.tsx` から使われる、`reason` prop |

### 1-3. 主要な型定義

```typescript
// domain/shared/result.ts
export type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export const Result = {
  ok<T>(value: T): Result<T, never> { return { ok: true, value }; },
  err<E>(error: E): Result<never, E> { return { ok: false, error }; },
};

// domain/search/validation-error.ts 
export type ValidationError =
  | { kind: 'empty' }
  | { kind: 'too-long' };

// domain/search/search-query.ts
export class SearchQuery {
  private constructor(readonly value: string) {}

  static create(input: string): Result<SearchQuery, ValidationError> {
    const trimmed = input.trim();
    if (trimmed.length === 0) return Result.err({ kind: 'empty' });
    if (trimmed.length > 256) return Result.err({ kind: 'too-long' });
    return Result.ok(new SearchQuery(trimmed));
  }
}

// domain/repository/repository.ts (不変ドメインモデル)
export type Repository = Readonly<{
  id: number;
  fullName: string;
  owner: Readonly<{ login: string; avatarUrl: string }>;
  description: string | null;
  language: string | null;
  stargazersCount: number;
  watchersCount: number;
  forksCount: number;
  openIssuesCount: number;
  htmlUrl: string;
  updatedAt: Date;
}>;

// application/types/search-result.ts 
export type SearchResult = Readonly<{
  items: ReadonlyArray<Repository>;
  totalCount: number;
  incompleteResults: boolean;
}>;

// application/ports/gateway-error.ts (discriminated union)
export type GatewayError =
  | { kind: 'http-error'; status: number; resource?: 'core' | 'search' }
  | { kind: 'rate-limited'; resetAt: Date; resource: 'core' | 'search' }
  | { kind: 'secondary-rate-limited'; retryAfterSec: number }
  | { kind: 'forbidden'; reason: 'invalid-token' | 'sso-required' | 'unknown' }  // v4: abuse-detection 削除
  | { kind: 'not-found' }
  | { kind: 'malformed-response'; cause: 'json-parse' | 'schema' }
  | { kind: 'network'; cause: unknown };

// application/errors/application-error.ts (discriminated union, 8 kind)
export type ApplicationError =
  | { kind: 'invalid-query'; reason: 'empty' | 'too-long' }       // ValidationError 由来のみ
  | { kind: 'rate-limit'; resetAt: Date; resource: 'core' | 'search' }
  | { kind: 'forbidden'; reason: 'invalid-token' | 'sso-required' | 'unknown' }
  | { kind: 'not-found' }
  | { kind: 'upstream-error'; status: number }   // 422 含む（v4: invalid-query から外す）
  | { kind: 'malformed-response' }
  | { kind: 'schema-mismatch' }
  | { kind: 'network'; cause: unknown };
```

### 1-4. エラーハンドリング規約

参照: [reference/github-api/rate-limits.md](reference/github-api/rate-limits.md)

**境界変換責務**:

```
infrastructure 層
  ├─ catch fetch reject / response.json() throw / zod.safeParse 失敗
  └─ → GatewayError の Result.err() に正規化

application/use-cases/_internal/
  ├─ map-gateway-error.ts: GatewayError → ApplicationError
  └─ map-validation-error.ts: ValidationError → ApplicationError('invalid-query')

application/use-cases/* で Result<T, ApplicationError> を返す
  ↓
app/_lib/render-search-result.tsx で kind に応じて UI 分岐
```

**`map-gateway-error.ts` の変換ルール**:

| GatewayError | ApplicationError |
|--------------|-----------------|
| `http-error{status:422}` | `upstream-error{status:422}` ★v4: invalid-query には変換しない |
| `http-error{status:404}` | `not-found` |
| `http-error{status:500..504}` | `upstream-error{status}` |
| `rate-limited` | `rate-limit{resetAt, resource}` |
| `secondary-rate-limited` | `rate-limit{resetAt: new Date(Date.now() + retryAfterSec*1000), resource: 'search'}` |
| `forbidden{reason}` | `forbidden{reason}` |
| `malformed-response{cause:'json-parse'}` | `malformed-response` |
| `malformed-response{cause:'schema'}` | `schema-mismatch` |
| `network` | `network{cause}` |

**UIマッピング表（discriminated union の価値可視化）**:

| ApplicationError.kind | UI 表示 | Next.js API |
|----------------------|---------|------------|
| `invalid-query` | `<EmptyState reason="invalid-query" />` | なし |
| `rate-limit` | `<RateLimitDisplay resetAt={...} q={q} />` + `<Link href="/?q={q}">` | なし |
| `forbidden` | `<ErrorState reason="forbidden" detail={reason} />` | なし |
| `not-found`（詳細） | `notFound()` 呼び出し → `not-found.tsx` | `notFound()` |
| `not-found`（検索） | `<EmptyState reason="no-results" />` | なし |
| `upstream-error` | `<ErrorState reason="upstream" status={status} />` | なし |
| `malformed-response` | `<ErrorState reason="malformed" />` + console.error | なし |
| `schema-mismatch` | `<ErrorState reason="schema" />` + console.warn + Sentry送信想定 | なし |
| `network` | `<ErrorState reason="network" />` + Retryリンク | なし |

---

## 2. テスト戦略

### 2-0. テスト配置（Cハイブリッド維持）

| テスト種別 | 配置場所 |
|----------|---------|
| ユニット（domain, application, infrastructure） | `*.test.ts` 同一ディレクトリ |
| 結合（components） | `*.test.tsx` 同一ディレクトリ |
| app/_lib helper（render-*, normalize-search-params） | `tests/integration/app/` |
| E2E | `tests/e2e/` |
| フィクスチャ・ヘルパー | `tests/fixtures/`, `tests/helpers/` |

### 2-1. テストピラミッド（目安）

> Mike Cohn の古典的テストピラミッドに準拠しつつ、具体比率はプロジェクト規模で調整。

| 層 | ツール | 用途 |
|----|--------|------|
| ユニット | Vitest | domain, application, infrastructure |
| 結合 | Vitest + Testing Library + MSW (node mode) | components, app/_lib helper |
| E2E | Playwright | ハッピーパス1本 + deep link |

### 2-2. テストケース一覧（最終版）

参照: [reference/testing/msw-v2-node.md](reference/testing/msw-v2-node.md)

#### domain（ユニット）
- `SearchQuery.create("")` → `Result.err({ kind: 'empty' })`
- `SearchQuery.create("a".repeat(257))` → `Result.err({ kind: 'too-long' })`
- `SearchQuery.create("  react  ")` → `Result.ok(SearchQuery("react"))`
- `SearchQuery.create("　")` → `Result.err({ kind: 'empty' })` （全角スペース、`String.prototype.trim()` がU+3000を trim）
- `Result.ok(1)`, `Result.err(...)` 基本動作

#### application（ユニット、FakeGateway 注入）
- `SearchRepositoriesUseCase`:
  - 不正クエリ → `{ kind: 'invalid-query' }`（ValidationError 由来）
  - Gateway Ok → Ok（マッピング検証）
  - Gateway `rate-limited` → `{ kind: 'rate-limit', resource: 'search' }`
  - Gateway `secondary-rate-limited` → `{ kind: 'rate-limit', resetAt: future date }`（変換）
  - Gateway `forbidden(invalid-token)` → `{ kind: 'forbidden', reason: 'invalid-token' }`
  - Gateway `network` → `{ kind: 'network' }`
  - 0件 → 空配列
- `GetRepositoryDetailUseCase`:
  - 存在する → Ok(Repository)
  - Gateway `not-found` → `{ kind: 'not-found' }`
  - Gateway `rate-limited` → `{ kind: 'rate-limit' }`
- `map-gateway-error.ts`: 各 GatewayError → ApplicationError 変換テーブルを網羅
- `map-validation-error.ts`: `ValidationError` → `{ kind: 'invalid-query', reason }` 変換

#### infrastructure（ユニット、fetch モック）— ★ Backend特徴の核
参照: [reference/github-api/rate-limits.md](reference/github-api/rate-limits.md)

- `GitHubRepositoryGateway.search`:
  - 200 + items → Ok(SearchResult)
  - **422 → `{ kind: 'http-error', status: 422 }`**（application で upstream-error に変換）
  - **403 + `x-ratelimit-remaining: 0` + `x-ratelimit-resource: search` → `{ kind: 'rate-limited', resource: 'search' }`**
  - **403 + `retry-after: 60` → `{ kind: 'secondary-rate-limited', retryAfterSec: 60 }`**
  - **403 + `x-ratelimit-remaining: 30`（token系） → `{ kind: 'forbidden', reason: 'unknown' }`** （SSO 判定はベストエフォート）
  - **429 + retry-after → `{ kind: 'secondary-rate-limited' }`**（429 は 403 と同様に rate-limit 系統一）
  - 500/502/503/504 → `{ kind: 'http-error', status }`
  - Content-Type 不正 / JSON.parse 失敗 → `{ kind: 'malformed-response', cause: 'json-parse' }`
  - zod スキーマ検証失敗 → `{ kind: 'malformed-response', cause: 'schema' }`
  - AbortError / timeout → `{ kind: 'network' }`
  - `description: null`, `language: null` → そのまま null 保持
  - `updated_at: ISO string` → `Date` オブジェクト変換
  - 不正な日付文字列 → `{ kind: 'malformed-response', cause: 'schema' }`
  - `SearchQuery("c++")` → URL: `q=c%2B%2B`（URLエンコード）
  - `perPage: 30` → URL: `?per_page=30`（snake_case）
- `GitHubRepositoryGateway.findByOwnerAndRepo`:
  - 200 → Ok(Repository)
  - 404 → `{ kind: 'not-found' }`

#### presentation（結合、MSW node mode）
参照: [reference/nextjs-v16/searchparams.md](reference/nextjs-v16/searchparams.md), [reference/testing/msw-v2-node.md](reference/testing/msw-v2-node.md)

- `<SearchForm />`:
  - `vi.mock('next/navigation')` → `useRouter().push` 監視
  - 入力 + Submit → `push('/?q=入力値')`
  - `c++` 入力 → `push('/?q=c%2B%2B')`
  - 既存値 `?q=react` がある状態で submit → `push('/?q=vue')`
  - 空入力で送信ボタン disabled
  - `"   "` (空白のみ) submit → `push` 呼ばれない
  - 全角スペースのみ submit → `push` 呼ばれない
  - Enter で送信
  - **a11y: `vitest-axe` で違反0**
- `<RepositoryList />`:
  - items 渡すと一覧表示
  - 各カードに star/lang/owner avatar 表示
  - **null フィールド表示**（descriptionがnullでもクラッシュしない）
  - **`description` に `<script>alert(1)</script>` 含む fixture でレンダリング → React 自動エスケープ確認**（XSS）
  - 0件で `<EmptyState />` 表示
- `<RateLimitDisplay />`:
  - `resetAt={future date}` で「あとN分N秒で再試行可能」表示
  - **`<Link href="/?q={q}">` の href 検証**（callbackテスト不要）

#### app/_lib helper（tests/integration/app/）— v4 helper 抽出版
参照: [reference/nextjs-v16/error-handling.md](reference/nextjs-v16/error-handling.md)

- `render-search-result.test.tsx`:
  - `q=undefined, result=null` → `<EmptyState reason="initial" />`
  - happy path → `<RepositoryList items={...} />`
  - 0件 → `<EmptyState reason="no-results" />`
  - 全 ApplicationError.kind を網羅（**`assertNever` で compile-time 保証 → ランタイム exhaustive テスト不要**）
- `render-detail.test.tsx`:
  - happy → `<RepositoryDetail />`
  - `not-found` → `notFound()` throw（`vi.mock('next/navigation')` で監視）
  - `rate-limit` / `forbidden` / `upstream-error` の各分岐
- `error-boundary.test.tsx`:
  - `error.tsx` の `unstable_retry` ボタンクリック → `unstable_retry()` 呼ばれる（v16.2.0+）
  - axe で違反0
- `normalize-search-params.test.ts`:
  - `undefined` → `undefined`
  - `'react'` → `'react'`
  - `['a', 'b']` → `'b'`（最後を採用）

#### URL流入経路カバー（normalize + render に統合）
- `?q=` (空) → `<EmptyState reason="initial" />`
- `?q=%20%20%20` (空白のみエンコード) → SearchQuery が `empty` → `<EmptyState reason="invalid-query" />`
- `?q=` 256文字超 → `<EmptyState reason="invalid-query" />`
- `?q=react&q=vue` (重複) → 最後の値採用（normalizeSearchParam）

#### E2E（Playwright）
- `search-flow.spec.ts` (1本のみ):
  1. `/` 表示
  2. "react" 入力 → submit
  3. URL が `?q=react` に変化
  4. 結果リスト表示（`role="list"` 確認）
  5. 1件目クリック → `/repositories/[owner]/[repo]` 遷移
  6. 詳細ページに `<h1>` または fullName 表示
  7. 直接 `/repositories/notexist123/notexist123` アクセス → not-found 画面（deep link）

### 2-3. テスト設計指針

- **AAA パターン**統一
- **テストダブル**: `FakeRepositoryGateway` を `tests/helpers/test-doubles.ts` に
- **MSW (強化)**:
  - `tests/helpers/msw/server.ts` で `setupServer({ onUnhandledRequest: 'error' })`
  - `vitest.config.ts` の `test.projects` で **component / integration / unit を分離**
  - `beforeEach(() => server.resetHandlers())`
- **factory関数**: `tests/helpers/factories/repository.ts`
- **`assertNever` helper**: `src/lib/assert-never.ts` で compile-time 網羅性チェック

```typescript
// src/lib/assert-never.ts
export function assertNever(x: never): never {
  throw new Error(`Unexpected: ${JSON.stringify(x)}`);
}
```

**カバレッジ目標**:

| 層 | CI必須（下限） | 努力目標 |
|---|---|---|
| domain | 90% | 100% |
| application | 80% | 95% |
| infrastructure | 75% | 90% |
| presentation | 60% | 80% |
| app/_lib helper | 90% | 100% |
| **app/page.tsx** | **計測除外** | — |

`vitest.config.ts` の `coverage.exclude` に `src/app/**/page.tsx` 追加。

### 2-4. Next.js v16 固有のテスト指針

- **Server Component の単体テストは諦める**: 公式非サポート、helper抽出戦略で回避
- **async params/searchParams**: helper に `q: string | undefined` 渡す（Promise 解決済み）
- **MSW node mode**: `setupServer` + `onUnhandledRequest: 'error'`
- **a11y自動テスト**: `vitest-axe`
- **`server-only` 罠**: `app/_lib/*` から `server-only` 削除、stub 不要に簡素化（テストコスト > 安全性の判断）
- **Vitest pool**: `pool: 'forks'`（`server-only` 削除で `pool` 制約緩和）

### 2-5. `vitest.config.ts` 構成（最終版）

```typescript
// vitest.config.ts
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
          setupFiles: ['./vitest.setup.integration.ts'], // MSW + axe
        },
      },
    ],
    coverage: {
      exclude: ['src/app/**/page.tsx', 'src/app/**/layout.tsx'],
    },
  },
});
```

---

## 3. Issue & PR 計画

### 3-1. Issue 一覧（最終版）

> **設計判断で #8↔#9 順序入替（presentation を先、composition root を後 → placeholder 手戻り防止）+ 文書 PR を #11 として分割。ローカル作業手順は別ファイル（`.gitignore` 対象）に分離。**

| # | タイトル | ラベル | 主要成果物 |
|---|---------|--------|-----------|
| 1 | Next.js v16 + TS + Tailwind v4 + ESLint flat config + Prettier + .nvmrc + .env.example + LICENSE(MIT) + .github/{PR,Issue}テンプレ | `type:setup` | scaffold + lint config + LICENSE + テンプレ |
| 2 | shadcn/ui init + components.json + lib/utils.ts | `type:setup` | shadcn 初期化 |
| 3 | GitHub Actions CI（lint/typecheck/test/build）+ vitest.config.ts (test.projects) + coverage thresholds | `type:ci` | CI ワークフロー |
| 4 | domain層 + Result + ValidationError + SearchQuery + Repository + 全ユニットテスト | `type:feat`, `layer:domain` | domain 全部 |
| 5 | application/ports/gateway-error + repository-gateway interface + application/types/search-result + ApplicationError | `type:feat`, `layer:app-types` | 型定義先行 |
| 6 | infrastructure層: GitHub APIクライアント + zod + 14ユニットテスト + fixtures 7本 | `type:feat`, `layer:infra` | infra 全部 + fixtures |
| 7 | application層: 2 UseCase + map-gateway-error + map-validation-error | `type:feat`, `layer:app` | application 全部 |
| 8 | **presentation: shadcn add 5component + search-form/list/card/detail/empty/loading/rate-limit/error-state + 結合テスト + a11y(axe) + CSP** | `type:feat`, `layer:ui` | UI 全部 + tests + a11y |
| 9 | **app/ Composition Root: container.ts + normalize-search-params + render-* helpers + page.tsx 薄殻 + loading/error/not-found + integration tests** | `type:feat`, `layer:app-root` | app/ 全部 |
| 10 | E2E (Playwright) + Vercel デプロイ | `type:feat`, `type:ci` | E2E + 本番デプロイ |
| 11 | README + ADR 3本 + 品質証跡スクショ + Lighthouse | `type:docs` | 最終成果物完成 |

→ 11 Issueで各 PR 小さくレビュー容易、思考のトレースも可視化。

### 3-2. PR 運用

- **ブランチ**: `feat/<番号>-<短名-kebab>` で**統一**（type による分岐はラベルで表現、setup/ci/docs もすべて feat/ プレフィクス）
- **コミット**: Conventional Commits（`feat:`, `fix:`, `chore:`, `test:`, `docs:`, `refactor:`）
- **PR**:
  - Issue を `Closes #N` で紐付け
  - PR タイトル規約: `feat: #N <短文>` / `chore: #N <短文>` / `docs: #N <短文>`
  - テンプレ: 概要 / 変更点 / テスト方針 / スクリーンショット / 設計判断
  - main マージは squash
- **commit message** を「読者に見られる前提」で書く（`WIP`/`fix`/`update` 連発NG）

### 3-3. CI ワークフロー

`.github/workflows/ci.yml`:
- on: `push: branches-ignore: [main]` + `pull_request: branches: [main]`
- permissions: `contents: read`（最小権限）
- jobs:
  - **install**: pnpm install --frozen-lockfile
  - **lint**: ESLint + Prettier check
  - **typecheck**: tsc --noEmit
  - **test**: Vitest run（カバレッジ機械検証）
  - **build**: next build
- E2E はCI から外す（ローカル実行、READMEに明記）

### 3-4. Branch protection なし

- 個人プロジェクトのため未設定
- 自分でPR作成 → CI通過 → squash merge

---

## 4. 技術スタック

| カテゴリ | 採用 | 参照 |
|---------|------|-----|
| Framework | Next.js v16 (App Router) | reference/nextjs-v16/ |
| 言語 | TypeScript (strict) | — |
| UIライブラリ | Tailwind CSS v4 + shadcn/ui | reference/styling/tailwind-v4.md |
| HTTPクライアント | 標準 fetch | reference/github-api/ |
| バリデーション | zod | — |
| テストランナー | Vitest（test.projects、pool: 'forks'） | reference/testing/ |
| コンポーネントテスト | @testing-library/react + jsdom | — |
| HTTPモック | MSW v2 (node server-mode) | reference/testing/msw-v2-node.md |
| a11yテスト | vitest-axe | — |
| E2E | Playwright | — |
| Lint | ESLint flat config (eslint.config.mjs) + no-restricted-imports | — |
| Format | Prettier | — |
| パッケージマネージャ | pnpm v9+ | — |
| Node | v22 LTS | — |

### 4-1. 環境変数と認証戦略
参照: [reference/github-api/rate-limits.md](reference/github-api/rate-limits.md)

- `GITHUB_TOKEN` を **オプショナル**
- **rate limit（GitHub Search APIの実際）**:
  - 未認証: **10 req/min**（search bucket、core の60req/h とは別）
  - 認証済: **30 req/min**
  - 検知: HTTP 403 + `x-ratelimit-remaining: 0` + `x-ratelimit-resource: search`
- **403 の3種類を識別**:
  - `x-ratelimit-remaining: 0` → **rate-limited**
  - `retry-after` 単独 → **secondary-rate-limited**
  - `x-ratelimit-remaining > 0` での 403 → **forbidden**（reason: 'unknown'、SSO/invalid-token区別はベストエフォート）
- **UX**: `x-ratelimit-reset` を Unix秒 → `new Date(reset * 1000)` で「あとN分N秒で再試行可能」 + `<Link href="/?q={q}">` Retry
- `.env.example` に `GITHUB_TOKEN=ghp_xxx_optional` をコメント付きで配置
- `.gitignore` で `.env*.local` 除外確認 + 履歴チェック必須

### 4-2. ランタイム配置

- **Node v22 LTS** + `.nvmrc` + `package.json engines`
- **pnpm v9+** + `packageManager` フィールド
- **Vercel Hobby**（無料）で本番デプロイ（Spending Limit を $0 に）
- 詳細な開発体験設定（`.vscode/`等）は **README の「開発体験」セクション** に移譲

---

## 5. README構成（最重要構成要素）

### 5-1. README 冒頭3画面の情報密度設計

#### 1画面目（〜30行）
1. タイトル + Badges (CI status / Node v22 / License: MIT)
2. **Vercel デプロイURL**（最上部）
3. **3行サマリー**:
   > "Backend Engineer が Next.js v16 初挑戦で実装した GitHub リポジトリ検索アプリ。軽量レイヤード4層 + Composition Root 採用、infra 14異常系テストで Backend経験を活かした境界設計を可視化。"
4. **PCスクショ 1枚**（ヒーロー画像）
5. **Requirements**（Node v22, pnpm v9, Tailwind v4 を明記）

#### 2画面目（30-60行）
1. **モバイルスクショ**（iPhone 14 ProMax + SE 折返し検証 + 横向きRate Limit）
2. **アーキテクチャ Mermaid 図**（4層 + Composition Root の依存方向）
3. プロダクト概要（できること、3-5行）

#### 3画面目（60-90行、設計判断の根拠を示す）
1. **設計思想 3行サマリ**:
   > "軽量レイヤード4層 + Composition Root（Hexagonal Adapter）。fullDDDではなく課題規模に対する適度な複雑度を選択。Backend経験から境界設計（依存方向・型変換責務）を最優先。"
2. **「Backend から見た Next.js」3行版**（v4: 事実ベース、業務で読んだ → TypeScript で類比実装 → 自分の判断）:

   | 業務で読んだ Backend 概念 | TypeScript で書いた対応 | 自分の判断ポイント |
   |---|---|---|
   | Kotlin の sealed class を業務コードで読んだ際、「全パターン網羅で `when` を強制する」型システムを業務で読んで理解した | TypeScript の discriminated union + `assertNever` で類似の網羅保証を `application/errors/application-error.ts` に実装、`app/_lib/render-search-result.tsx` の switch で全 kind を分岐 | エラーの kind を1ヶ所に集約し、UI 分岐忘れを型レベルで防ぐ判断 |
   | Quarkus の `@Inject` を業務で見たときに「依存注入の起点を1ヶ所に集約する」設計に納得感があった | Server Component の `app/_lib/container.ts` を Composition Root として factory 関数集約、`app/page.tsx` から `createSearchUseCase()` 呼び出し | token を server boundary に閉じる判断（`process.env.GITHUB_TOKEN` を Client Bundle に漏らさない） |
   | DDD Repository pattern を書籍/業務コードで読んだ経験 | `RepositoryGateway` interface（application/ports/）+ `GitHubRepositoryGateway`（infrastructure/）に分離 | API 置換時の影響を application/presentation 層に波及させない判断 |

   ※ Kotlin/Quarkus/DDD は業務で「実装を主導した」のではなく「業務コード/書籍で読んだ」レベル。**他言語の概念を引っ張ってきて新しい技術に応用する学習力**を見せる文脈で記述。

3. クイックスタート（短縮版）:
   ```bash
   pnpm create next-app@latest && cd && pnpm dlx shadcn@latest init && pnpm install && pnpm dev
   ```

### 5-2. README 4画面目以降

4. **「制約と判断」表（v4: 3行に削減）**:

   | やったこと | 意図的にやらなかったこと（理由） | **次に潰すリスク順**（continuation plan） |
   |-----------|------------------------------|----------------------------------------|
   | Server Component主体（Client は2箇所のみ） | E2EでRate limitモック（複雑性過大） | **#1 Sentry統合** （本番エラー追跡） |
   | infra層14異常系テスト（rate-limit 3分類含む） | DDDフル形（単一集約ルート、コスト超過） | #2 実APIスモークテスト（schema drift検知） |
   | rate limit UX（search bucket理解 + 3分類） | 全コンポーネント包括テスト（重要部品に絞った） | #3 axe + Lighthouse のCI統合 |

   ※「時間があればやりたかったこと」の詳細は § 末尾の脚注に。

5. **アーキテクチャ詳細**: 4層分離 + Composition Root + 依存方向 + ESLint強制
6. **設計思想**:
   - レイヤード分離を選んだ理由（YAGNI vs 拡張性）
   - フルDDDをやらなかった理由（データ整合性境界がない / 単一集約ルート）
   - Result vs 例外の使い分け
7. **技術スタック選定理由**: Tailwind v4/shadcn/MSW/Vitest/Playwright を選んだ理由
8. **ディレクトリ構造**: 各層の責務、Server/Client 区分（1-2-2 表を引用）
9. **テスト**: 実行方法、カバレッジ現状値、テスト戦略

### 5-3. README 後半

10. **AI活用レポート**（4セクション構成）:

    ### 10-1. 活用方針の宣言
    - **AI に任せた領域**: ボイラープレート（package.json, tsconfig, ESLint設定）、テストコード骨格、ドキュメント下書き、型定義の書き起こし
    - **AI に任せなかった領域**: 設計判断（軽量レイヤード4層採用）、エラーハンドリング規約（Result型 + 境界変換責務）、Server/Client境界、UIマッピング表
    - **責任所在**: **AI 生成物含めて全てのコードの責任は私が持つ**

    ### 10-2. AI 提案の判断基準（一貫した思想）
    - **採用する基準**: 設計判断と一致 + テスト pass + 自分が説明可能
    - **修正する基準**: 動くが「なぜ動くか」を自分が言語化できない箇所は書き換え
    - **却下する基準**: token 漏洩リスク / SSR 利点喪失 / 設計思想と矛盾 / 説明できない

    ### 10-3. 実装中の実例集（実装中のヒアリングで記録、想定では書かない）

    | 種別 | AI が提案 | 私の判断 | 判断理由 |
    |------|----------|---------|---------|
    | 採用 | （実装中に記録） | そのまま採用 | テスト pass + 思想一致 |
    | 修正 | （実装中に記録） | A → A' に書き換え | 〇〇のため |
    | 却下 | （実装中に記録、なければ空欄） | 不採用、別案で書き直し | 〇〇のため |

    > **注**: このセクションは実装中の各 PR ウォークスルー時に「AI 活用ヒアリング」を実施し、`notes/ai-usage-log.md`（ローカル限定）に蓄積した実例から最終 README に転記する。**想定では書かない、事実のみ記録**。

    ### 10-4. 学んだこと（事実ベース、なければ空欄）
    実装中に学んだ事実を記録（想定では書かない）。
    - （実装中のヒアリングで記入）

12. **「今後の拡張案」（設計上 3カテゴリに整理）**:
   - **運用観点**: Sentry / Vercel Analytics / Web Vitals 計測 / CSP 強化 / 構造化ログ
   - **データ層**: ISR を使った検索結果キャッシュ / 実APIスモークテスト
   - **UX**: Server Actions（お気に入り保存）/ Suspense streaming / Parallel Routes（詳細モーダル）/ ダークモード

13. **License**: MIT
14. **Author**: [@akaitigo](https://github.com/akaitigo)
15. **Acknowledgments**: shadcn/ui, Next.js, Vercel, MSW
16. **サポート連絡先**: ryusei1116nakayama@gmail.com（誠意の証拠）
17. **クイックスタート（詳細版、折りたたみ）**:
    ```bash
    pnpm create next-app@latest github-repo-finder \
      --ts --tailwind --eslint --app --src-dir --use-pnpm
    cd github-repo-finder
    pnpm dlx shadcn@latest init
    pnpm dlx shadcn@latest add button input card skeleton alert
    cp .env.example .env.local
    pnpm install
    pnpm dev
    ```

---

## 6. ADR 3本（設計上 Alternatives + Why not now 強化）

### `docs/adr/0001-layered-architecture.md`
- **Status**: Accepted
- **Context**: GitHubリポジトリ検索アプリの設計選択
- **Decision**: 軽量レイヤード4層（domain/application/infrastructure/presentation）+ app(composition root)
- **Consequences**: 拡張性、口頭説明容易、課題規模に対する適度な複雑度
- **Alternatives considered**:
  - フル DDD（Aggregate, Domain Event, Specification, Repository per Aggregate）
  - Clean Architecture（Use Case Interactor + Boundary + Presenter + Controller の4層）
  - Feature-based Architecture（features/search, features/detail）
- **Why not now**:
  - フル DDD: 集約境界が無い（単一エンティティ・単一クエリ）。儀式的になる
  - Clean Architecture: Boundary/Presenter まで分離するとコンポーネントが3倍に
  - Feature-based: 横断概念（Repository, SearchQuery）が多く、layer-based の方が明示的
- **TypeScript type-only import 戦略**（新設、Backend 出身設計上の文脈）:
  - 通常 `import` ではなく `import type { Repository } from '@/domain/repository/repository'` を使い、**ランタイム依存ゼロ**で型のみ共有
  - `presentation` 層が `domain` の型を参照しても layered architecture を破らない
  - ESLint で `allowTypeImports: true` を明示
  - **Kotlin/Java 出身者**: 型と実装が不可分な言語経験から見ると、TypeScript の type-only import は「層分離と型共有の両立」を可能にする独自の武器

### `docs/adr/0002-result-type.md`
- **Status**: Accepted
- **Context**: エラーハンドリング戦略
- **Decision**: 想定内失敗は `Result<T, E>` discriminated union、想定外バグは throw。境界変換責務は `_internal/map-*-error.ts` に集約
- **Consequences**: 型システムでエラー忘れ防止、UI分岐明示、infra層で例外正規化
- **Alternatives considered**:
  - 全例外ハンドリング（throw + try/catch）
  - `neverthrow` ライブラリ
  - Either モナド (fp-ts)
- **Why not now**:
  - 全例外: UI 側で「何が起きうるか」が型に出ない
  - neverthrow / fp-ts: 学習コスト高、シンプルな自前実装で十分
- **3層バリデーション責務分担**:
  | 層 | 責務 |
  |----|------|
  | SearchForm (presentation) | UX: 即時フィードバック、disabled 制御 |
  | page.tsx (composition root) | searchParams 素通し、`q === ''` は initial 表示 |
  | UseCase (application) | 意味: ValidationError → ApplicationError 変換、結果を UI 用 kind に |
  | SearchQuery (domain) | 不変条件: 持てる値の制約 (empty/too-long) |
  - 「Form は UX、UseCase は意味、Domain は不変条件」の3軸で責務分割
  - 同種のバリデーションが3層で行われるが、**意図的な多層防御**と説明する

### `docs/adr/0003-server-component-strategy.md`
- **Status**: Accepted
- **Context**: Next.js v16 App Router での Server/Client 境界 + URL同期戦略
- **Decision**: Server Component 主体、Client は SearchForm + error.tsx のみ。`searchParams` で URL同期（Server Actions 不採用）
- **Consequences**: token client bundle混入防止、SSR/SEO最適、テスト戦略単純化、deep link可能
- **Alternatives considered**:
  - Client Component で `useEffect + fetch`（SWR/TanStack Query）
  - **Server Action**（`<form action={fn}>`）
  - Static Site + クライアント側 fetch
- **Why not now**:
  - Client + SWR: token がclient bundleに漏れる、初期表示で flash
  - **Server Action**: 検索結果は **共有可能性が本質的価値**（URLでシェア可能）。Server Action は副作用操作（お気に入り保存等）に向く。検索は GET セマンティクス
  - Static + client fetch: SEO 不利、deep link で空ページが一瞬出る

---

## 7. AI活用方針（個人の信念として）

### 7-1. AI判断責任原則
**AI生成物の採否判断と責任は自分が持つ**。AIに任せた事実は記述するが、責任を AI に転嫁しない。

### 7-2. 活用範囲
- ボイラープレート → AI生成
- レイヤー間の型定義 → 設計を自分で決め、AI が書き起こし
- テストケース → 自分で観点を決め、AI がコード化
- ドキュメント整理 → AI が下書き、自分が校正

---

## 8. 削除リスト（明文化）

本プロジェクトで**やらないこと**:
- `eslint-plugin-boundaries`（`no-restricted-imports` で代替）
- husky / lint-staged
- Branch protection
- CodeRabbit / Dependabot
- Playwright `error-handling.spec.ts`
- E2E を CI に組み込む
- `useRepositorySearch` hook
- `RepositoryId` 値オブジェクト
- 二重送信防止（`useTransition`）
- ページネーション、ソート、お気に入り、認証
- ISR / Server Actions / Parallel Routes / PPR / React 19 `use()`
- Lighthouse / axe を CI に組み込む（手動1回 + スクショ）
- 全コンポーネント包括テスト
- shadcn 上書き深カスタマイズ
- Sentry / Analytics / Web Vitals 統合（言及のみ）
- snapshot テスト全般
- Bun test 移行
- `bypass()` での実 GitHub API スモークテスト
- `dynamicIO` / `cacheLife` / `cacheTag` の本格活用
- **`forbidden.reason = 'abuse-detection'`**（v4 削除、secondary-rate-limited と重複）
- **render-*.tsx の `server-only`**（v4 削除、テストコスト>安全性）

→ 「制約と判断」3列表 + continuation plan に明記。

---

---

## 9. 各 PR ウォークスルー時の AI 活用ヒアリング

各 PR を実装した後、merge 前のウォークスルーで以下を実施:

```
1. 着手前: 「これから何をするか」+「ここで AI に任せる範囲 / 自分判断する範囲」を AI が宣言
2. 実装: AI がコード+テスト書く
3. ローカル検証: pnpm lint && typecheck && test --coverage && build 全 pass
4. ウォークスルー: 主要ファイル / 設計判断のポイント解説
5. ★ AI 活用ヒアリング: AI が「これは AI 案だが採用/修正/却下」を都度説明 → 担当者にヒアリング → 回答を `notes/ai-usage-log.md` に記録
6. PR 作成 → CI → マージ
```

ヒアリング質問テンプレ:
- 「この設計、自分の言葉で説明できる？」
- 「ここで Backend 経験が活きた点ある？」
- 「ここで初めて触った/詰まった点ある？」
- 「AI 提案を却下/修正したケースあれば、判断基準は？」

→ ログは `notes/ai-usage-log.md`（`.gitignore` で除外）に蓄積、Issue #11 で README の「AI 活用レポート § 10-3, 10-4」に転記する事実ベースの実例を選定。

---

## 10. アクセシビリティ・運用ルール（v4 補足）

- 色情報のみで状態を伝えない（エラーは赤色 + アイコン + テキスト）
- 動的更新（rate-limit カウントダウン）に `aria-live="polite"`
- `prefers-reduced-motion` 対応（Tailwind `motion-safe:` プレフィクス）
- コントラスト比 WCAG AA（4.5:1）以上
- スクリーンリーダー実機確認は今回時間ない → README に「未実施・継続課題」と正直に記載
- **CSP 最低限設定**（`next.config.js` headers）:
  ```javascript
  headers: async () => [{
    source: '/:path*',
    headers: [{
      key: 'Content-Security-Policy',
      value: "default-src 'self'; img-src 'self' https://avatars.githubusercontent.com; connect-src 'self' https://api.github.com; script-src 'self'",
    }],
  }],
  ```
- **構造化ログ**: `console.error({ kind, message, requestId, digest })`
- **Web Vitals 閾値目標**: LCP<2.5s, INP<200ms, CLS<0.1（Lighthouse 1回確認）

---

参照ドキュメント一覧:
- [reference/nextjs-v16/searchparams.md](reference/nextjs-v16/searchparams.md)
- [reference/nextjs-v16/server-components.md](reference/nextjs-v16/server-components.md)
- [reference/nextjs-v16/error-handling.md](reference/nextjs-v16/error-handling.md)
- [reference/github-api/rate-limits.md](reference/github-api/rate-limits.md)
- [reference/styling/tailwind-v4.md](reference/styling/tailwind-v4.md)
- [reference/testing/msw-v2-node.md](reference/testing/msw-v2-node.md)
