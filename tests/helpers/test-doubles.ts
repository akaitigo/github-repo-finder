import { Result, type Result as ResultType } from "@/domain/shared/result";
import type { Repository } from "@/domain/repository/repository";
import type { SearchQuery } from "@/domain/search/search-query";
import type { GatewayError } from "@/application/ports/gateway-error";
import type {
  RepositoryGateway,
  SearchOptions,
} from "@/application/ports/repository-gateway";
import type { SearchResult } from "@/application/types/search-result";

/**
 * テスト用の RepositoryGateway 実装。
 *
 * 設計判断:
 * - search / findByOwnerAndRepo の戻り値を任意に注入可能
 * - 呼び出し履歴を記録（lastSearchCall / lastFindCall）して assertion 可能
 * - GatewayError 全 kind を返却テストできるため、UseCase の各分岐を検証可能
 *
 * 使い方:
 *   const fake = new FakeRepositoryGateway();
 *   fake.searchResult = Result.ok({ items: [], totalCount: 0, incompleteResults: false });
 *   const useCase = new SearchRepositoriesUseCase(fake);
 */
export class FakeRepositoryGateway implements RepositoryGateway {
  searchResult: ResultType<SearchResult, GatewayError> = Result.ok({
    items: [],
    totalCount: 0,
    incompleteResults: false,
  });
  findResult: ResultType<Repository, GatewayError> = Result.err({
    kind: "not-found",
  });

  lastSearchCall: { query: SearchQuery; options?: SearchOptions } | null = null;
  lastFindCall: { owner: string; repo: string } | null = null;

  search(
    query: SearchQuery,
    options?: SearchOptions,
  ): Promise<ResultType<SearchResult, GatewayError>> {
    this.lastSearchCall = { query, options };
    return Promise.resolve(this.searchResult);
  }

  findByOwnerAndRepo(
    owner: string,
    repo: string,
  ): Promise<ResultType<Repository, GatewayError>> {
    this.lastFindCall = { owner, repo };
    return Promise.resolve(this.findResult);
  }
}

/**
 * Repository テストデータ生成ヘルパ。デフォルト値を上書きして任意のリポジトリを生成。
 */
export function makeRepository(
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
