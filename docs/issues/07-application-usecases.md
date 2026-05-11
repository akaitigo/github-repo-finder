# Issue #7: application層 (UseCase + map-* 変換)

> **設計意図**: ユースケース層と境界変換責務を実装。`GatewayError → ApplicationError` を `_internal/map-gateway-error.ts` に集約、`ValidationError → ApplicationError` を `map-validation-error.ts` に集約することで、変換責務の所在が一意になる（説明場面で説明しやすい）。

## 目的
`SearchRepositoriesUseCase` / `GetRepositoryDetailUseCase` を実装、`GatewayError → ApplicationError` と `ValidationError → ApplicationError` の変換責務を `_internal/map-*-error.ts` に集約。FakeGateway 注入でテスト容易性確保。

## 完了条件
- [ ] `src/application/use-cases/_internal/map-gateway-error.ts` — `GatewayError → ApplicationError` 変換（422 → upstream-error、cause → 2 kind 等）
- [ ] `src/application/use-cases/_internal/map-gateway-error.test.ts` — 全 GatewayError kind を ApplicationError にマップする網羅テスト
- [ ] `src/application/use-cases/_internal/map-validation-error.ts` — `ValidationError → ApplicationError('invalid-query')` 変換
- [ ] `src/application/use-cases/_internal/map-validation-error.test.ts` — empty / too-long の変換テスト
- [ ] `src/application/use-cases/search-repositories.ts` — UseCase（`SearchQuery.create()` → `gateway.search()` → 結果変換）
- [ ] `src/application/use-cases/search-repositories.test.ts` — FakeGateway 注入で 6+ 分岐テスト
- [ ] `src/application/use-cases/get-repository-detail.ts` — UseCase（`gateway.findByOwnerAndRepo()` → 結果変換）
- [ ] `src/application/use-cases/get-repository-detail.test.ts` — 3+ 分岐テスト
- [ ] `tests/helpers/test-doubles.ts` — `FakeRepositoryGateway` クラス（テスト時 GatewayError 注入可能）
- [ ] application カバレッジ 80%（CI 必須）/ 95%（努力目標）達成

## 主要テストケース
- SearchRepositoriesUseCase:
  - 不正クエリ（empty）→ `{ kind: 'invalid-query', reason: 'empty' }`
  - 不正クエリ（too-long）→ `{ kind: 'invalid-query', reason: 'too-long' }`
  - Gateway Ok → Ok（マッピング検証）
  - Gateway rate-limited → `{ kind: 'rate-limit', resetAt: Date, resource: 'search' }`
  - Gateway secondary-rate-limited → `{ kind: 'rate-limit', resetAt: new Date(Date.now() + retryAfterSec*1000), resource: 'search' }` 統一
  - Gateway forbidden(unknown) → `{ kind: 'forbidden', reason: 'unknown' }`
  - Gateway network → `{ kind: 'network', cause }`
  - 0件 → 空配列
- GetRepositoryDetailUseCase:
  - 存在する → Ok(Repository)
  - Gateway not-found → `{ kind: 'not-found' }`
  - Gateway rate-limited → `{ kind: 'rate-limit', resetAt: Date, resource: 'search' }`

## 非スコープ
- composition root / page.tsx（→ Issue #9）
- UI コンポーネント（→ Issue #8）

### 明示却下事項（積極的にやらない）
- **Either モナド (`fp-ts`) 採用**: `Result<T, E>` で十分、学習コスト見合わず（ADR 0002）
- **Try / Promise.allSettled パターン**: 想定内失敗は `Result`、想定外バグは throw の境界明確化
- **UseCase に business logic 層を厚く積む**: 「単一ユースケース = 単一クエリ呼び出し」の課題規模
- **`map-gateway-error.ts` を public API として export**: `_internal/` プレフィクスで application 内部実装と明示

## 依存Issue
- 先行: #5 (ports/types), #6 (gateway 実装)
- 後続: #8 (UI が UseCase の SearchResult 型を props 経由で受ける), #9 (composition root が UseCase を呼ぶ)

## 関連 reference
- `reference/github-api/error-responses.md`

## ラベル
- `type:feat`, `layer:app`

## ブランチ名
`feat/7-application-usecases`

## 実装メモ

### 最初の1ファイル
**`src/application/use-cases/_internal/map-gateway-error.ts`** から:
```typescript
import { assertNever } from '@/lib/assert-never';
export function mapGatewayError(error: GatewayError): ApplicationError {
  switch (error.kind) {
    case 'http-error':
      // 422 含めて全て upstream-error に倒す（型レベル整合）
      return { kind: 'upstream-error', status: error.status };
    case 'rate-limited':
      return { kind: 'rate-limit', resetAt: error.resetAt, resource: error.resource };
    case 'secondary-rate-limited':
      return { kind: 'rate-limit', resetAt: new Date(Date.now() + error.retryAfterSec * 1000), resource: 'search' };
    case 'forbidden':
      return { kind: 'forbidden', reason: error.reason };
    case 'not-found':
      return { kind: 'not-found' };
    case 'malformed-response':
      return error.cause === 'json-parse'
        ? { kind: 'malformed-response' }
        : { kind: 'schema-mismatch' };
    case 'network':
      return { kind: 'network', cause: error.cause };
    default: assertNever(error);
  }
}
```
**理由**: 変換責務を1関数に集約、テストで網羅性を保証。後続 UseCase はこれを呼ぶだけ。

### 次の1ファイル
**`tests/helpers/test-doubles.ts`** に `FakeRepositoryGateway` クラス。UseCase テストで GatewayError 任意注入可能。

### 設計判断
- UseCase はクラス（`constructor(gateway: RepositoryGateway)`）、constructor 注入で DI を表現
- `SearchQuery.create(rawQuery)` を UseCase 内で呼び、`ValidationError` を `map-validation-error.ts` で変換
- `gateway.search()` の `Result` を受けて `map-gateway-error.ts` で変換
- 422 は `invalid-query` ではなく `upstream-error` に倒す（domain ValidationError 由来のみが `invalid-query`）
- `secondary-rate-limited` は `rate-limit` に統一変換（UI 側で同じ Retry 表示）

## CI 担保範囲（Issue 完了時点）

このPRが merge された時点で CI が**初めて以下を機械検証**:
- **UseCase の各分岐ロジック**（成功/不正クエリ/rate-limit/forbidden/network/0件） が壊れたら CI で落ちる
- **`map-gateway-error` の網羅性**（全 GatewayError kind → ApplicationError）が `assertNever` で compile-time 保証
- **`map-validation-error`**（empty/too-long → invalid-query）が壊れたら CI で落ちる
- **`FakeRepositoryGateway` 経由のテスト** が application 層を分離検証
- application カバレッジ 80% 以上必須

→ ビジネスロジックと境界変換責務が完成、UI 側との結線準備完了
