import { z } from "zod";

/**
 * GitHub Search API のレスポンス形状を zod スキーマで定義。
 *
 * 設計判断:
 * - snake_case で API のキーをそのまま受け取る（mapper で camelCase に変換）
 * - description / language は API 仕様で null 可能
 * - updated_at は ISO 8601 文字列、mapper で Date に変換
 * - 不要なフィールド（node_id 等）は zod スキーマに含めず、未知キーは無視（v4 デフォルト）
 *
 * schema drift 検知:
 * - safeParse 失敗時は GatewayError('malformed-response', cause: 'schema') を返す
 * - GitHub API のスキーマ変更を CI で検知できる
 */
export const RepositoryResponseSchema = z.object({
  id: z.number(),
  full_name: z.string(),
  owner: z.object({
    login: z.string(),
    avatar_url: z.url(),
  }),
  description: z.string().nullable(),
  language: z.string().nullable(),
  stargazers_count: z.number(),
  watchers_count: z.number(),
  forks_count: z.number(),
  open_issues_count: z.number(),
  html_url: z.url(),
  updated_at: z.iso.datetime({ offset: true }),
});

export const SearchResponseSchema = z.object({
  total_count: z.number(),
  incomplete_results: z.boolean(),
  items: z.array(RepositoryResponseSchema),
});

export type RepositoryResponse = z.infer<typeof RepositoryResponseSchema>;
export type SearchResponse = z.infer<typeof SearchResponseSchema>;
