import { notFound } from "next/navigation";
import type { Result } from "@/domain/shared/result";
import type { Repository } from "@/domain/repository/repository";
import type { ApplicationError } from "@/application/errors/application-error";
import { assertNever } from "@/lib/assert-never";
import { RepositoryDetail } from "@/presentation/components/repository-detail";
import { RateLimitDisplay } from "@/presentation/components/rate-limit-display";
import { ErrorState } from "@/presentation/components/error-state";

/**
 * GetRepositoryDetailUseCase の Result を React Element に変換する純粋関数。
 *
 * 設計判断:
 * - **`not-found` は Next.js の `notFound()` を呼ぶ**（404 ページ表示、SEO 適切）
 * - rate-limit / forbidden / upstream / network は ErrorState または RateLimitDisplay で表示
 * - assertNever で ApplicationError 8 kind の網羅性をコンパイル時保証
 *
 * Note: `invalid-query` kind は本 use case (詳細取得) では発生しないが、
 * ApplicationError union の網羅性のため switch case を持つ
 */
export interface RenderDetailProps {
  result: Result<Repository, ApplicationError>;
  fallbackQ?: string;
}

export function renderDetail({
  result,
  fallbackQ = "",
}: RenderDetailProps): React.ReactElement {
  if (result.ok) {
    return <RepositoryDetail repository={result.value} />;
  }

  const error = result.error;
  switch (error.kind) {
    case "not-found":
      notFound();
    case "rate-limit":
      return <RateLimitDisplay resetAt={error.resetAt} q={fallbackQ} />;
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
          q={fallbackQ}
        />
      );
    case "upstream-error":
      return (
        <ErrorState
          reason="upstream-error"
          status={error.status}
          q={fallbackQ}
        />
      );
    case "malformed-response":
      return <ErrorState reason="malformed-response" q={fallbackQ} />;
    case "schema-mismatch":
      return <ErrorState reason="schema-mismatch" q={fallbackQ} />;
    case "network":
      return <ErrorState reason="network" q={fallbackQ} />;
    case "invalid-query":
      // 詳細取得では発生しない、ApplicationError union 網羅のため
      return (
        <ErrorState
          reason={
            error.reason === "empty"
              ? "invalid-query-empty"
              : "invalid-query-too-long"
          }
          q={fallbackQ}
        />
      );
    default:
      return assertNever(error);
  }
}
