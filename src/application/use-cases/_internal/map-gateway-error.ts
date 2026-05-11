import { assertNever } from "@/lib/assert-never";
import type { GatewayError } from "@/application/ports/gateway-error";
import type { ApplicationError } from "@/application/errors/application-error";

/**
 * GatewayError → ApplicationError の境界変換。
 *
 * 設計判断:
 * - 変換責務をこの関数に集約（「どこで infra → app の変換が起きるか」が一意）
 * - assertNever で全 GatewayError kind の網羅をコンパイル時に保証
 * - secondary-rate-limited は rate-limit に統一（UI 側で同じ Retry 表示）
 * - malformed-response の cause は ApplicationError の異なる kind に振り分け
 *   (json-parse → malformed-response, schema → schema-mismatch)
 *
 * 変換ルール:
 * - http-error → upstream-error（422 含む、domain ValidationError 由来のみが invalid-query）
 * - rate-limited → rate-limit
 * - secondary-rate-limited → rate-limit (resetAt = now + retryAfterSec*1000, resource: 'search')
 * - forbidden → forbidden（reason: invalid-token / sso-required / unknown を保持）
 * - not-found → not-found
 * - malformed-response{cause:'json-parse'} → malformed-response
 * - malformed-response{cause:'schema'} → schema-mismatch
 * - network → network（cause を引き継ぎ）
 */
export function mapGatewayError(error: GatewayError): ApplicationError {
  switch (error.kind) {
    case "http-error":
      return { kind: "upstream-error", status: error.status };
    case "rate-limited":
      return {
        kind: "rate-limit",
        resetAt: error.resetAt,
        resource: error.resource,
      };
    case "secondary-rate-limited":
      return {
        kind: "rate-limit",
        resetAt: new Date(Date.now() + error.retryAfterSec * 1000),
        resource: "search",
      };
    case "forbidden":
      return { kind: "forbidden", reason: error.reason };
    case "not-found":
      return { kind: "not-found" };
    case "malformed-response":
      return error.cause === "json-parse"
        ? { kind: "malformed-response" }
        : { kind: "schema-mismatch" };
    case "network":
      return { kind: "network", cause: error.cause };
    default:
      return assertNever(error);
  }
}
