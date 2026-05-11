# ADR 0001: 軽量レイヤード4層アーキテクチャの採用

## Status

Accepted (2026-05-11)

## Context

GitHub リポジトリ検索という小規模 SPA に対して、どの程度の構造化を行うかを決める必要があった。選択肢:
- 単一ファイル / Next.js scaffold まま (構造化なし)
- 軽量レイヤード (4 層 + Composition Root)
- フル DDD (集約ルート、リポジトリ、ドメインサービス)
- Clean Architecture (Use Case Interactor、Boundary、Entity、Gateway)
- Feature-based (機能単位でファイルを束ねる)

評価軸:
- 説明可能性: 各層の責務が一意に説明できるか
- テスト容易性: 各層を分離してテストできるか
- 過剰設計回避: 課題規模 (検索機能 1 つ) に見合うか
- 拡張性: 将来 API 置換 (REST → GraphQL) で影響を最小化できるか

## Decision

**軽量レイヤード4層 + Composition Root** を採用する。

```
[app (Composition Root)] → application + presentation + infrastructure + domain
[presentation]           → application + domain (type-only)
[application]            → domain
[infrastructure]         → application/ports + domain
[domain]                 → (nothing) 純粋
```

### 各層の責務

| 層 | 責務 | 例 |
|----|------|-----|
| domain | 純粋ロジック・値オブジェクト・型 | Repository, SearchQuery, Result, ValidationError |
| application | UseCase + 境界変換 (port + map-*) | SearchRepositoriesUseCase, mapGatewayError, GatewayError, ApplicationError |
| infrastructure | 外部 IO (GitHub API) + adapter | GitHubRepositoryGateway, zod schema, parseRateLimitError |
| presentation | UI コンポーネント (純粋表示) | RepositoryCard, SearchForm, ErrorState |
| app (composition root) | DI 配線 + page.tsx 薄殻 + render-* helper | container.ts, render-search-result.tsx |

### 機械強制

ESLint `no-restricted-imports` で依存方向違反をコンパイル前に検知:
- domain は他層から完全独立
- application は infra/presentation/app 参照禁止
- infrastructure は application/use-cases / errors 参照禁止 (ports のみ可)
- presentation は infrastructure / app 参照禁止

## Consequences

### Positive

- **影響範囲を絞れる**: GitHub API 仕様変更 → infrastructure 層のみ修正で完結
- **テスト戦略が層ごとに整理**: domain は純粋 unit、application は Fake Gateway 注入、presentation は a11y 含む結合
- **「変換責務がどこにあるか」が一意**: GatewayError → ApplicationError は `_internal/map-gateway-error.ts` に集約
- **新メンバーの理解コスト低**: 各 .ts ファイルを見れば責務が判別可能 (ディレクトリ構造で表現)

### Negative

- **小規模アプリにはやや過剰**: 検索 1 機能で 4 層 + Composition Root は overkill 気味
- **ディレクトリ階層が深い**: src/application/use-cases/_internal/map-gateway-error.ts のようなパス
- **TypeScript の型のみのファイル**が多くなる (port interface, error union)

## Alternatives Considered

### フル DDD (集約ルート / Repository / DomainService)

却下理由 (Why not now):
- データ整合性境界 (集約ルート) が存在しない (検索結果は read-only)
- DomainService に積むビジネスロジックが薄い (バリデーションは値オブジェクト内で完結)
- 学習コスト > 規模に対するメリット

### Clean Architecture (Boundary / Use Case Interactor)

却下理由:
- Boundary interface を Use Case 単位で定義する手間 vs 課題規模で見合わない
- TypeScript では interface だけで Boundary パターンの大部分が表現可能 (本採用案で代替)

### Feature-based (機能単位ファイル束ね)

却下理由:
- 検索機能 1 つしかない → 「機能単位」が単一ディレクトリになり、層分離の利点を失う
- 機能追加時に同じ層のコードが分散 (cross-cutting concerns の所在不明)

### 構造化なし (scaffold まま / 単一ファイル)

却下理由:
- 依存方向 / 型変換責務という設計判断が可視化できない
- テスト戦略が立てられない (全部 page.tsx に書くと async Server Component で test 不可能)

## TypeScript type-only import 戦略 (補記)

各層の boundary 型は `import type { ... }` で参照:
- presentation の `import type { Repository } from "@/domain/repository/repository"` は **型情報のみ**、ランタイム依存なし
- ESLint の `no-restricted-imports` は import を制限するが、`type` 修飾子があれば「型としての参照」を許可するルールも追加可能 (今後の拡張)

## 参考

- 実装: `src/{domain,application,infrastructure,presentation,app}/`
- 機械強制: `eslint.config.mjs`
- 依存方向図: README の Architecture セクション
