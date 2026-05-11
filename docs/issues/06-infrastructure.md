# Issue #6: infrastructure (GitHub APIクライアント) + 14異常系テスト

> **設計意図**: 外部 API 境界の堅牢性を網羅する層。GitHub Search API の rate-limit 3分類（rate/secondary/forbidden）、5xx 系、JSON破損、schema drift、URLエンコードなど14種類の異常系をテストで保証。

## 目的
GitHub Search API へのアクセス実装。`RepositoryGateway` interface を実装、zod でレスポンス検証、14種類の異常系（rate-limit 3分類、HTTP 4xx/5xx、JSON破損、schema drift、null フィールド、URLエンコード）を網羅的にテスト。

## 完了条件
- [ ] `src/infrastructure/github/github-api-types.ts` — zod スキーマ（`SearchResponseSchema`, `RepositoryResponseSchema`）
- [ ] `src/infrastructure/github/github-api-mapper.ts` — GitHub API レスポンス → domain `Repository` 変換（snake_case → camelCase、`updated_at` → Date、null 保持）
- [ ] `src/infrastructure/github/github-repository-gateway.ts` — `RepositoryGateway` 実装、403/429 の3分類ロジック、URLエンコード、headers
- [ ] `src/infrastructure/github/github-repository-gateway.test.ts` — 14+ 異常系テスト
- [ ] `tests/fixtures/github-api/*.json` — 7本（search-success / search-empty / repository-detail / rate-limit-403 / secondary-rate-limit-403 / forbidden-403 / server-error-500）
- [ ] infra のカバレッジ 75%（CI 必須）/ 90%（努力目標）達成
- [ ] `pnpm test --project unit` 全 pass

## テストケース 14+
- 200 + items → Ok(SearchResult)
- 422 → http-error{status:422}
- 403 + x-ratelimit-remaining:0 + x-ratelimit-resource:search → rate-limited{resource:search}
- 403 + retry-after:60 → secondary-rate-limited{retryAfterSec:60}
- 403 + x-ratelimit-remaining > 0 → forbidden{reason:'unknown'}
- 429 + retry-after → secondary-rate-limited
- 500/502/503/504 → http-error{status}
- Content-Type 不正 / JSON.parse 失敗 → malformed-response{cause:'json-parse'}
- zod schema 失敗 → malformed-response{cause:'schema'}
- AbortError / network失敗 → network
- description: null, language: null → null 保持
- updated_at ISO → Date 変換、不正日付 → `malformed-response{cause:'schema'}` （application層で `schema-mismatch` に変換される）
- SearchQuery("c++") → URL: q=c%2B%2B
- perPage: 30 → URL: ?per_page=30
- findByOwnerAndRepo: 200/404 ハッピーパスと not-found

## 非スコープ
- application 層 use case（→ Issue #7）
- MSW 統合テスト（→ Issue #8）— infra は `vi.fn()` で fetch モック

### 明示却下事項（積極的にやらない）
- **`@octokit/rest` ライブラリ採用**: 標準 fetch で十分、依存削減 + Next.js キャッシュ統合
- **GraphQL API 採用**: `/search/repositories` REST エンドポイントで要件を完全に満たす
- **MSW を infra テストで使用**: `vi.fn()` でレスポンス偽装で十分、MSW は #8 結合テスト用
- **rate limit retry の自動リトライ**: ユーザー操作（`<Link>` Retry）に委ねる、自動リトライは無限ループリスク

## 依存Issue
- 先行: #5 (ports/types)
- 後続: #7 (use case が gateway に依存)

## 関連 reference
- `reference/github-api/search-repositories.md`
- `reference/github-api/rate-limits.md`
- `reference/github-api/error-responses.md`

## ラベル
- `type:feat`, `layer:infra`

## ブランチ名
`feat/6-infrastructure`

## 実装メモ

### 最初の1ファイル
**`src/infrastructure/github/github-api-types.ts`** から zod スキーマ:
```typescript
import { z } from 'zod';
export const RepositoryResponseSchema = z.object({
  id: z.number(), full_name: z.string(),
  owner: z.object({ login: z.string(), avatar_url: z.string().url() }),
  description: z.string().nullable(),
  language: z.string().nullable(),
  stargazers_count: z.number(),
  watchers_count: z.number(),
  forks_count: z.number(),
  open_issues_count: z.number(),
  html_url: z.string().url(),
  updated_at: z.string().datetime(),
});
export const SearchResponseSchema = z.object({
  total_count: z.number(),
  incomplete_results: z.boolean(),
  items: z.array(RepositoryResponseSchema),
});
```
**理由**: zod スキーマが gateway 実装と mapper の起点、最初に定義して後続を駆動。

### 設計判断
- `fetch` は `cache: 'no-store'`（v15+ デフォルト、検索結果は常に最新）
- `Authorization: Bearer ${process.env.GITHUB_TOKEN}` を token あれば付与
- ヘッダ確認: `x-ratelimit-remaining`, `x-ratelimit-reset`, `x-ratelimit-resource`, `retry-after`
- `parseRateLimitHeaders()` helper を切り出すと testability 向上
- fetch モックは `vi.fn()` でレスポンス偽装（MSW は #8 で結合テスト用）
- 不正日付は `malformed-response{cause:'schema'}` を返す（application で `schema-mismatch` に変換）

## CI 担保範囲（Issue 完了時点）

このPRが merge された時点で CI が**初めて以下を機械検証**:
- **GitHub API の HTTP 異常系14種類** が壊れたら CI で落ちる
- **rate limit 3分類（rate/secondary/forbidden）の判別ロジック** が壊れたら CI で落ちる
- **zod schema 検証**（schema drift 検知）が壊れたら CI で落ちる
- **URLエンコード**（`c++` → `c%2B%2B`）が壊れたら CI で落ちる
- **null フィールド処理**（description/language）が壊れたら CI で落ちる
- infra カバレッジ 75% 以上必須

→ 外部 API 境界の堅牢性が機械保証、Backend特徴の核完成
