import type { Result } from "@/domain/shared/result";
import type { ApplicationError } from "@/application/errors/application-error";
import type { SearchResult } from "@/application/types/search-result";
import { assertNever } from "@/lib/assert-never";
import { RepositoryList } from "@/presentation/components/repository-list";
import { EmptyState } from "@/presentation/components/empty-state";
import { RateLimitDisplay } from "@/presentation/components/rate-limit-display";
import { ErrorState } from "@/presentation/components/error-state";

/**
 * SearchUseCase の Result を React Element に変換する純粋関数。
 *
 * 設計判断:
 * - **page.tsx を 5 行薄殻に保つ戦略**: page.tsx の async Server Component が Vitest 公式非対応のため、
 *   分岐ロジックを本 helper に抽出して個別テスト（render-search-result.test.tsx で 8 kind 全パス）
 * - assertNever で ApplicationError 8 kind の網羅性をコンパイル時保証
 * - q (検索ワード) を必要な分岐 (rate-limit / error-state) に渡し、Retry リンクを生成
 */
export interface RenderSearchResultProps {
  result: Result<SearchResult, ApplicationError>;
  q: string;
}

export function renderSearchResult({
  result,
  q,
}: RenderSearchResultProps): React.ReactElement {
  if (result.ok) {
    return (
      <RepositoryList
        items={result.value.items}
        totalCount={result.value.totalCount}
        q={q}
      />
    );
  }

  const error = result.error;
  switch (error.kind) {
    case "invalid-query":
      return (
        <ErrorState
          reason={
            error.reason === "empty"
              ? "invalid-query-empty"
              : "invalid-query-too-long"
          }
          q={q}
        />
      );
    case "rate-limit":
      return <RateLimitDisplay resetAt={error.resetAt} q={q} />;
    case "forbidden":
      return (
        <ErrorState
          reason={
            error.reason === "invalid-token"
              ? "forbidden-invalid-token"
              : error.reason === "sso-required"
                ? "forbidden-sso-required"
                : "forbidden-unknown"
          }
          q={q}
        />
      );
    case "not-found":
      return <EmptyState reason="no-results" />;
    case "upstream-error":
      return <ErrorState reason="upstream-error" status={error.status} q={q} />;
    case "malformed-response":
      return <ErrorState reason="malformed-response" q={q} />;
    case "schema-mismatch":
      return <ErrorState reason="schema-mismatch" q={q} />;
    case "network":
      return <ErrorState reason="network" q={q} />;
    default:
      return assertNever(error);
  }
}
