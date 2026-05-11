import { Result, type Result as ResultType } from "@/domain/shared/result";
import { SearchQuery } from "@/domain/search/search-query";
import type { ApplicationError } from "@/application/errors/application-error";
import type {
  RepositoryGateway,
  SearchOptions,
} from "@/application/ports/repository-gateway";
import type { SearchResult } from "@/application/types/search-result";
import { mapGatewayError } from "./_internal/map-gateway-error";
import { mapValidationError } from "./_internal/map-validation-error";

/**
 * SearchRepositoriesUseCase: ユーザー入力からリポジトリ検索結果を取得するユースケース。
 *
 * 設計判断:
 * - constructor で `RepositoryGateway` を注入（依存性逆転、テストで FakeRepositoryGateway 注入可能）
 * - 入力 string を `SearchQuery.create()` で domain 値オブジェクトに昇格
 * - ValidationError は `map-validation-error.ts` で `invalid-query` に変換
 * - GatewayError は `map-gateway-error.ts` で ApplicationError に変換
 * - 全結果は `Result<SearchResult, ApplicationError>` で返す（throw しない）
 *
 * 流れ:
 *   raw input string
 *     → SearchQuery.create() (domain validation)
 *       → ValidationError なら mapValidationError → invalid-query
 *     → gateway.search()
 *       → GatewayError なら mapGatewayError → upstream-error/rate-limit/etc
 *     → SearchResult を Ok で返す
 */
export class SearchRepositoriesUseCase {
  constructor(private readonly gateway: RepositoryGateway) {}

  async execute(
    rawQuery: string,
    options?: SearchOptions,
  ): Promise<ResultType<SearchResult, ApplicationError>> {
    const queryResult = SearchQuery.create(rawQuery);
    if (!queryResult.ok) {
      return Result.err(mapValidationError(queryResult.error));
    }

    const gatewayResult = await this.gateway.search(queryResult.value, options);
    if (!gatewayResult.ok) {
      return Result.err(mapGatewayError(gatewayResult.error));
    }

    return Result.ok(gatewayResult.value);
  }
}
