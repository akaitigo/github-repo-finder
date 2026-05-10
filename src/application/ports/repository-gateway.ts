import type { Repository } from "@/domain/repository/repository";
import type { Result } from "@/domain/shared/result";
import type { SearchQuery } from "@/domain/search/search-query";
import type { SearchResult } from "@/application/types/search-result";
import type { GatewayError } from "./gateway-error";

/**
 * SearchOptions: 検索リクエストのオプション。
 * - perPage: 1ページあたりの件数（GitHub API デフォルト 30、最大 100）
 * - page: ページ番号（1始まり）
 */
export type SearchOptions = Readonly<{
  perPage?: number;
  page?: number;
}>;

/**
 * RepositoryGateway: GitHub リポジトリへのアクセスを抽象化する port。
 *
 * 設計判断:
 * - infrastructure 層の `GitHubRepositoryGateway` が実装する（Issue #6）
 * - application 層は本 interface だけに依存（依存性逆転）
 * - 結果は Result<T, GatewayError> で表現（throw しない）
 * - テスト時は FakeRepositoryGateway を注入（Issue #7）
 */
export interface RepositoryGateway {
  /**
   * GitHub Search API でリポジトリを検索。
   * @param query 検証済の SearchQuery（domain 値オブジェクト）
   * @param options ページング指定
   */
  search(
    query: SearchQuery,
    options?: SearchOptions,
  ): Promise<Result<SearchResult, GatewayError>>;

  /**
   * owner/repo 指定で単一リポジトリを取得。
   * @param owner オーナー名（owner/repo の owner 部分）
   * @param repo リポジトリ名（owner/repo の repo 部分）
   */
  findByOwnerAndRepo(
    owner: string,
    repo: string,
  ): Promise<Result<Repository, GatewayError>>;
}
