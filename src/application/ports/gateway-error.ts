/**
 * GatewayError: infrastructure 層が application 層に返す失敗の discriminated union。
 *
 * 設計判断:
 * - infrastructure → application の境界変換責務を 1 箇所（map-gateway-error.ts、Issue #7 で実装）に集約
 * - throw せず Result<T, GatewayError> で返す（型レベルでエラー扱い強制）
 * - GitHub API の現実に合わせた kind 設計（403 を 3分類: rate-limited / secondary / forbidden）
 *
 * ヘッダ判別ロジック（infrastructure 層で実装、Issue #6）:
 * - x-ratelimit-remaining: 0 → rate-limited
 * - retry-after 単独 → secondary-rate-limited
 * - x-ratelimit-remaining > 0 で 403 → forbidden
 */
export type GatewayError =
  /** HTTP エラー（400/422/500 等）、status を持つ */
  | {
      readonly kind: "http-error";
      readonly status: number;
      readonly resource?: "core" | "search";
    }
  /** Primary rate limit (search bucket: 10/min 未認証, 30/min 認証) */
  | {
      readonly kind: "rate-limited";
      readonly resetAt: Date;
      readonly resource: "core" | "search";
    }
  /** Secondary rate limit (abuse detection、retry-after で復帰) */
  | { readonly kind: "secondary-rate-limited"; readonly retryAfterSec: number }
  /** 403 だが rate limit でない（invalid token / SSO / forbidden） */
  | {
      readonly kind: "forbidden";
      readonly reason: "invalid-token" | "sso-required" | "unknown";
    }
  /** 404 */
  | { readonly kind: "not-found" }
  /** Content-Type 不正 / JSON.parse 失敗 / zod schema 失敗 */
  | {
      readonly kind: "malformed-response";
      readonly cause: "json-parse" | "schema";
    }
  /** ネットワーク失敗（DNS / connect / abort / timeout） */
  | { readonly kind: "network"; readonly cause: unknown };
