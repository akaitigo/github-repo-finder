import { assertNever } from "@/lib/assert-never";
import type { ValidationError } from "@/domain/search/validation-error";
import type { ApplicationError } from "@/application/errors/application-error";

/**
 * ValidationError → ApplicationError('invalid-query') の境界変換。
 *
 * 設計判断:
 * - 変換責務をこの関数に集約（domain → app の変換口を一意に）
 * - assertNever で全 ValidationError kind の網羅をコンパイル時に保証
 * - 「invalid-query」kind は domain ValidationError 由来のみ（infra 422 は upstream-error に倒す、map-gateway-error 参照）
 *
 * 変換ルール:
 * - empty → invalid-query{reason: 'empty'}
 * - too-long → invalid-query{reason: 'too-long'}
 */
export function mapValidationError(
  error: ValidationError,
): Extract<ApplicationError, { kind: "invalid-query" }> {
  switch (error.kind) {
    case "empty":
      return { kind: "invalid-query", reason: "empty" };
    case "too-long":
      return { kind: "invalid-query", reason: "too-long" };
    default:
      return assertNever(error);
  }
}
