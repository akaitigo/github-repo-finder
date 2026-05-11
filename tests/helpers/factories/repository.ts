import type { Repository } from "@/domain/repository/repository";

/**
 * Repository テストデータ生成 factory。
 * デフォルト値を上書きして任意のリポジトリを生成。
 *
 * test-doubles.ts の makeRepository と同等だが、presentation 結合テストで
 * tests/helpers/factories/* を専用 import パスとして用意。
 */
export function buildRepository(
  overrides: Partial<Repository> = {},
): Repository {
  return {
    id: 1,
    fullName: "facebook/react",
    owner: {
      login: "facebook",
      avatarUrl: "https://avatars.githubusercontent.com/u/69631?v=4",
    },
    description: "A library",
    language: "JavaScript",
    stargazersCount: 100,
    watchersCount: 50,
    forksCount: 30,
    openIssuesCount: 10,
    htmlUrl: "https://github.com/facebook/react",
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}
