import type { Repository } from "@/domain/repository/repository";
import type { RepositoryResponse } from "./github-api-types";

/**
 * GitHub API レスポンス → domain `Repository` への変換。
 *
 * 変換ルール:
 * - snake_case → camelCase
 * - updated_at (ISO 8601 string) → Date オブジェクト
 * - description / language の null はそのまま保持
 *
 * 設計判断:
 * - 純粋関数として切り出し、gateway の中で直接書かない（テスト容易性）
 * - zod safeParse 通過後の `RepositoryResponse` 型を入力にする（型安全）
 * - new Date() は ISO 文字列なら必ず成功する（zod の datetime バリデーション通過済）
 */
export function toRepository(response: RepositoryResponse): Repository {
  return {
    id: response.id,
    fullName: response.full_name,
    owner: {
      login: response.owner.login,
      avatarUrl: response.owner.avatar_url,
    },
    description: response.description,
    language: response.language,
    stargazersCount: response.stargazers_count,
    watchersCount: response.watchers_count,
    forksCount: response.forks_count,
    openIssuesCount: response.open_issues_count,
    htmlUrl: response.html_url,
    updatedAt: new Date(response.updated_at),
  };
}
