/**
 * searchParams 正規化 seam。
 *
 * Next.js v15+ の searchParams は `string | string[] | undefined` を返す
 * （重複キー `?q=a&q=b` がある場合に配列）。
 *
 * 設計判断:
 * - 重複キー時は最後の値を採用（HTTP の慣習に合わせる）
 * - undefined はそのまま undefined
 *
 * 使用箇所:
 *   const sp = await searchParams;
 *   const q = normalizeSearchParam(sp.q);
 */
export function normalizeSearchParam(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) return value[value.length - 1];
  return value;
}
