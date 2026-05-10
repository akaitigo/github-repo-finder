/**
 * SearchQuery のバリデーションエラー。
 * domain 層の型なので、application/presentation で UI 分岐に使う場合は
 * map-validation-error.ts (application/use-cases/_internal/) で
 * ApplicationError へ変換する。
 */
export type ValidationError =
  | { readonly kind: "empty" }
  | { readonly kind: "too-long" };
