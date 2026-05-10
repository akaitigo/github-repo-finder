# Issue #5: application/ports + types

> **設計意図**: infrastructure と application の**境界契約**を先に定義。`GatewayError` と `ApplicationError` を明示的に分離し、変換責務を `_internal/map-*` に閉じ込める設計の起点。後続 #6 (infra) と #7 (use case) が並行実装可能。

## 目的
infrastructure と application の境界を定義する型・interface 層。`GatewayError`、`RepositoryGateway` interface、`SearchResult` 型を先行定義し、Issue #6 (infra) と #7 (use case) の並行実装を可能にする。

## 完了条件
- [ ] `src/application/ports/gateway-error.ts` — `GatewayError` discriminated union（http-error / rate-limited / secondary-rate-limited / forbidden / not-found / malformed-response / network）
- [ ] `src/application/ports/repository-gateway.ts` — `RepositoryGateway` interface（`search()` / `findByOwnerAndRepo()`）
- [ ] `src/application/types/search-result.ts` — `SearchResult = Readonly<{ items: readonly Repository[]; totalCount: number; incompleteResults: boolean }>` 型
- [ ] `src/application/errors/application-error.ts` — `ApplicationError` discriminated union（8 kind: invalid-query / rate-limit / forbidden / not-found / upstream-error / malformed-response / schema-mismatch / network）
- [ ] `pnpm typecheck` 全 pass（型定義のみなのでテストは最小）

## 非スコープ
- 実装（→ Issue #6, #7）
- map-* 変換ロジック（→ Issue #7）

### 明示却下事項（積極的にやらない）
- **`GatewayError` と `ApplicationError` を統合**: 境界変換責務を消すと「どこで変換が起きるか」が不明瞭、説明場面で詰まる
- **`forbidden.reason = 'abuse-detection'`**: `secondary-rate-limited` と重複、削除
- **`http-error{status}` を kind ごとに細分化**（invalid-query-syntax / server-error / unexpected-http）: status 番号で判別可能、union 肥大化を避ける
- **interface の代わりに class を ports に置く**: テスト時の Fake 実装が複雑化

## 依存Issue
- 先行: #4 (domain)
- 後続: #6 (infra で interface を実装)、#7 (use case で interface に依存)

## 関連 reference
- `reference/github-api/error-responses.md`
- `reference/github-api/rate-limits.md`

## ラベル
- `type:feat`, `layer:app-types`

## ブランチ名
`feat/5-app-types-ports`

## 実装メモ

### 最初の1ファイル
**`src/application/ports/gateway-error.ts`** から:
```typescript
export type GatewayError =
  | { kind: 'http-error'; status: number; resource?: 'core' | 'search' }
  | { kind: 'rate-limited'; resetAt: Date; resource: 'core' | 'search' }
  | { kind: 'secondary-rate-limited'; retryAfterSec: number }
  | { kind: 'forbidden'; reason: 'invalid-token' | 'sso-required' | 'unknown' }
  | { kind: 'not-found' }
  | { kind: 'malformed-response'; cause: 'json-parse' | 'schema' }
  | { kind: 'network'; cause: unknown };
```
**理由**: GatewayError が #6 (infra) と #7 (UseCase) の両方の契約。最初に定義すると並行実装可能。

### 設計判断
- ApplicationError から `forbidden.reason='abuse-detection'` は **削除**（`secondary-rate-limited` と重複のため）
- `forbidden.reason` は `'invalid-token' | 'sso-required' | 'unknown'` の3つ（公式に `X-GitHub-SSO` ヘッダ言及無いため `unknown` を fallback）
- `GatewayError` は `application/ports/` に配置（infra が依存する契約）
- `SearchResult.items` は `readonly Repository[]`（不変保証）
- `Repository` は domain から type-only import（`import type { Repository } from '@/domain/repository/repository'`）

## CI 担保範囲（Issue 完了時点）

このPRが merge された時点で CI が**初めて以下を機械検証**:
- **`GatewayError` / `ApplicationError` / `SearchResult` の型定義** が壊れたら typecheck で落ちる
- **境界契約の存在**（`RepositoryGateway` interface）が typecheck で保証
- 実行ロジックなしのため test カバレッジ対象外

→ #6 (infra) と #7 (use case) が並行実装可能な状態
