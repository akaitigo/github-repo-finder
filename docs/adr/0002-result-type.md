# ADR 0002: Result<T, E> + discriminated union によるエラーハンドリング

## Status

Accepted (2026-05-11)

## Context

JavaScript / TypeScript の標準は throw/catch でのエラー伝播。これを採用すると以下の課題:
- 「どの関数が何を throw するか」が型に現れない (silent failure)
- catch 漏れがコンパイル時に検出できない
- UI での分岐 (rate-limit / forbidden / network 等) を switch で書く際、網羅性が保証されない

選択肢:
- 標準 throw/catch
- `Result<T, E>` 型 (Rust 由来、TypeScript で discriminated union として実装可能)
- `Either<L, R>` モナド (`fp-ts` ライブラリ)
- Try / Promise.allSettled パターン

評価軸:
- 型安全性: エラーケースが型に現れるか
- 網羅性保証: switch 抜け漏れをコンパイル時に検出できるか
- 学習コスト: チームで採用しやすいか
- ライブラリ依存: 標準機能で完結するか

## Decision

**`Result<T, E>` 自前実装 + `discriminated union` + `assertNever`** を採用する。

```typescript
// src/domain/shared/result.ts
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const Result = {
  ok<T>(value: T): Result<T, never> { return { ok: true, value }; },
  err<E>(error: E): Result<never, E> { return { ok: false, error }; },
} as const;
```

エラー型は discriminated union:

```typescript
// src/application/errors/application-error.ts
export type ApplicationError =
  | { readonly kind: "invalid-query"; readonly reason: "empty" | "too-long" }
  | { readonly kind: "rate-limit"; readonly resetAt: Date; readonly resource: "core" | "search" }
  | { readonly kind: "forbidden"; readonly reason: "invalid-token" | "sso-required" | "unknown" }
  | { readonly kind: "not-found" }
  | { readonly kind: "upstream-error"; readonly status: number }
  | { readonly kind: "malformed-response" }
  | { readonly kind: "schema-mismatch" }
  | { readonly kind: "network"; readonly cause: unknown };
```

UI 分岐は switch + `assertNever`:

```typescript
switch (error.kind) {
  case "rate-limit": return <RateLimitDisplay ... />;
  case "forbidden": return <ErrorState reason="forbidden-..." />;
  // ... 全 8 kind ...
  default: assertNever(error); // kind 追加忘れでコンパイルエラー
}
```

## Consequences

### Positive

- **エラーケースが型に現れる**: 関数シグネチャ `Promise<Result<SearchResult, ApplicationError>>` を見れば失敗ケースが明白
- **switch 網羅性をコンパイル時保証**: kind 追加時、`assertNever` を呼ぶ default が型エラーを出す
- **catch 不要**: try/catch のネストが消え、純粋関数として境界変換 (`mapGatewayError`) を書ける
- **ライブラリ依存なし**: 標準 TypeScript 構文のみ、bundle size 増加ゼロ
- **テスト容易性**: `Result.ok(value)` / `Result.err(error)` で任意の状態を生成可能

### Negative

- **`if (!result.ok) return result.error` のような boilerplate** が散在 (慣れれば気にならない)
- **既存の throw/catch ライブラリとの境界** で変換が必要 (例: `fetch` の reject → `Result.err({ kind: "network", cause })`)
- **Async 系の `Promise<Result<T, E>>` の操作子** が標準で未提供 (map / flatMap が欲しくなる)

## Alternatives Considered

### 標準 throw/catch

却下理由 (Why not now):
- 「どの関数が何を throw するか」が型に出ない
- catch 漏れがコンパイル時に検出不可能 → ランタイム例外で page.tsx が落ちるリスク

### `fp-ts` の `Either<L, R>` モナド

却下理由:
- 学習コスト > メリット (チーム前提なし、本人にとって fp-ts 経験浅い)
- chain / map / fold のメソッド呼び出しが TypeScript 標準より verbose
- bundle size 増加 (~30KB)
- TypeScript の型推論との相性が `Result<T, E>` 自前実装より複雑

### Try / Promise.allSettled パターン

却下理由:
- 「想定内失敗」と「想定外バグ」の境界が曖昧 (両方 throw に倒すと混在)
- 本案では「想定内失敗 = Result.err、想定外バグ = throw」と境界明確化

## 3 層バリデーション責務分担 (補記)

入力値の検証は 3 層に分担:

| 層 | 責務 | 例 |
|----|------|-----|
| **Form** (presentation) | UX 向上目的 (placeholder / maxLength / required) | `<input maxLength={256} />` |
| **UseCase** (application) | 業務ルール (空文字排除、長さ制限の確定検証) | `SearchQuery.create(input)` |
| **Domain** (domain) | 不変条件 (値オブジェクト構築時の型保証) | `SearchQuery` private constructor + static create |

→ Form は「軽い UX 担保」、UseCase は「明示的なバリデーション結果 (ValidationError)」、Domain は「型レベルで不正値を拒否」。各層で責務を分けることで「どの層を直せば修正できるか」が一意。

## 参考

- 実装: `src/domain/shared/result.ts`, `src/lib/assert-never.ts`
- 利用例: `src/application/use-cases/_internal/map-gateway-error.ts`, `src/app/_lib/render-search-result.tsx`
