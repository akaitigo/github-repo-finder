# Issue #4: domain層 + 全ユニットテスト

> **設計意図**: ビジネスロジックの**純粋な核**を作る。`Result<T, E>` で例外を排し、`SearchQuery` 値オブジェクトで「不正な状態を持てない型」を実現。後続全層が依存する基盤、フレームワーク非依存。

## 目的
ビジネスロジックの基盤となる domain 層を実装。`Result<T, E>` 型、`SearchQuery` 値オブジェクト、`Repository` 不変ドメインモデル、`ValidationError` を定義。後続 application/infrastructure 層が依存する純粋ロジック。

## 完了条件
- [ ] `src/domain/shared/result.ts` — `Result<T, E>` 型 + `Result.ok` / `Result.err` helper
- [ ] `src/domain/shared/result.test.ts` — 基本動作テスト
- [ ] `src/domain/search/validation-error.ts` — `ValidationError = { kind: 'empty' | 'too-long' }` 型
- [ ] `src/domain/search/search-query.ts` — `SearchQuery` 値オブジェクト（`create()` で trim + length 検証 + Result 返却）
- [ ] `src/domain/search/search-query.test.ts` — 5+ ケース（`""` / `"a".repeat(257)` / `"  react  "` / `"　"` 全角空白 / 正常）
- [ ] `src/domain/repository/repository.ts` — `Repository` Readonly 型（id/fullName/owner/description/language/各種count/htmlUrl/updatedAt）
- [ ] `src/domain/repository/repository.test.ts` — 型のみのため最小限（インスタンス生成テスト）
- [ ] `src/lib/assert-never.ts` — switch exhaustive 用 helper
- [ ] domain のカバレッジ 90%（CI 必須）/ 100%（努力目標）達成
- [ ] `pnpm test --project unit` 全 pass

## 非スコープ
- application 層の use case（→ Issue #7）
- infrastructure 層の API クライアント（→ Issue #6）
- presentation の React コンポーネント（→ Issue #8）

### 明示却下事項（積極的にやらない）
- **`neverthrow` / `fp-ts` (Either モナド)**: 学習コスト高、シンプルな自前実装で十分（ADR 0002 で記載）
- **`RepositoryId` 値オブジェクト**: GitHub API の `id: number` で十分、振る舞いも不変条件もないため YAGNI
- **`Repository` を「Entity」と呼ぶ**: 不変ドメインモデル、リッチドメインを目指さない
- **`SearchQuery` 以外の VO 量産**: 単一エンティティ・単一クエリの課題規模で過剰

## 依存Issue
- 先行: #3 (CI が動く前提)
- 後続: #5, #6, #7（各層から domain を import）

## 関連 reference
- `reference/tooling/eslint-flat-config.md`（依存方向ルール、domain は他層import 禁止）
- `reference/nextjs-v16/server-components.md`（`Repository` 型を Server Component の props として使う前提、type-only import）

## ラベル
- `type:feat`, `layer:domain`

## ブランチ名
`feat/4-domain-layer`

## 実装メモ

### 最初の1ファイル
**`src/domain/shared/result.ts`** から:
```typescript
export type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export const Result = {
  ok<T>(value: T): Result<T, never> { return { ok: true, value }; },
  err<E>(error: E): Result<never, E> { return { ok: false, error }; },
};
```
**理由**: 後続の `SearchQuery.create()` / 全 use case / 全 gateway が `Result` を返すため、最初に定義しないと型エラーで進めない。

### 設計判断
- `Result<T, never>` の型推論動作を確認（`Result.ok(1)` の型が `Result<number, never>` になる）
- `String.prototype.trim()` は U+3000（全角スペース）を trim する → `SearchQuery.create("　")` で `empty` 確認
- `SearchQuery` のコンストラクタは private、`create()` static method 経由のみ
- `Repository` は型のみ、振る舞いなし（不変ドメインモデル、Entity と呼ばない）
- `assertNever` は switch exhaustive 用、後続 #9 で使用

## CI 担保範囲（Issue 完了時点）

このPRが merge された時点で CI が**初めて以下を機械検証**:
- **domain 純粋ロジック** が壊れたら CI で落ちる（カバレッジ 90% 以上必須）
- **`SearchQuery` の不変条件**（empty/too-long 拒否）が壊れたら CI で落ちる
- **依存方向ルール**: domain が他層を import すると ESLint で落ちる
- **`Result<T, E>` の型推論**: typecheck で保証

→ ビジネスロジックの核完成、後続全層の依存元として準備完了
