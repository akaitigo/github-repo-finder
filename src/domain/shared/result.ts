/**
 * Result<T, E>: 成功 (ok) と失敗 (err) を型レベルで表現する discriminated union。
 *
 * 設計判断:
 * - 想定内の失敗（バリデーションエラー、API rate limit 等）は Result で表現
 * - 想定外のバグや不変条件破壊は throw（プログラマミス）
 * - 例外より型システム経由の方がエラー忘れを防げる
 *
 * 使用例:
 *   function parse(s: string): Result<number, 'invalid'> {
 *     const n = Number(s);
 *     return Number.isNaN(n) ? Result.err('invalid') : Result.ok(n);
 *   }
 */
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const Result = {
  ok<T>(value: T): Result<T, never> {
    return { ok: true, value };
  },
  err<E>(error: E): Result<never, E> {
    return { ok: false, error };
  },
} as const;
