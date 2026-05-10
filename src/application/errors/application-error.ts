/**
 * ApplicationError: application 層が presentation 層に返す失敗の discriminated union（8 kind）。
 *
 * 設計判断:
 * - GatewayError → ApplicationError の変換は `_internal/map-gateway-error.ts` に集約（Issue #7）
 * - ValidationError → ApplicationError('invalid-query') の変換は `_internal/map-validation-error.ts` に集約
 * - presentation 層は本型の各 kind を switch + assertNever で網羅的に分岐（Issue #9 render-* helper）
 *
 * 変換ルール（map-gateway-error.ts で実装）:
 * - GatewayError.http-error{422 等} → upstream-error{status}（domain ValidationError 由来のみが invalid-query）
 * - GatewayError.rate-limited → rate-limit
 * - GatewayError.secondary-rate-limited → rate-limit（resetAt = now + retryAfterSec で統一）
 * - GatewayError.malformed-response{cause:'json-parse'} → malformed-response
 * - GatewayError.malformed-response{cause:'schema'} → schema-mismatch
 * - GatewayError.network → network
 * - GatewayError.forbidden / not-found → 同名でスルー
 */
export type ApplicationError =
  /** SearchQuery のバリデーション失敗（ValidationError 由来のみ） */
  | { readonly kind: "invalid-query"; readonly reason: "empty" | "too-long" }
  /** GitHub API rate limit（待てば直る） */
  | {
      readonly kind: "rate-limit";
      readonly resetAt: Date;
      readonly resource: "core" | "search";
    }
  /** 403 だが rate limit でない（待っても直らない、ユーザー操作要） */
  | {
      readonly kind: "forbidden";
      readonly reason: "invalid-token" | "sso-required" | "unknown";
    }
  /** リソース不在（404） */
  | { readonly kind: "not-found" }
  /** GitHub API の HTTP エラー（4xx/5xx、422 含む） */
  | { readonly kind: "upstream-error"; readonly status: number }
  /** Content-Type 不正 / JSON.parse 失敗 */
  | { readonly kind: "malformed-response" }
  /** zod schema 検証失敗（GitHub API スキーマドリフト） */
  | { readonly kind: "schema-mismatch" }
  /** ネットワーク失敗 */
  | { readonly kind: "network"; readonly cause: unknown };
