import { Result, type Result as ResultType } from "@/domain/shared/result";
import type { Repository } from "@/domain/repository/repository";
import type { ApplicationError } from "@/application/errors/application-error";
import type { RepositoryGateway } from "@/application/ports/repository-gateway";
import { mapGatewayError } from "./_internal/map-gateway-error";

/**
 * GetRepositoryDetailUseCase: owner/repo 指定で単一リポジトリ詳細を取得。
 *
 * 設計判断:
 * - constructor で `RepositoryGateway` を注入（DI、テスト容易性）
 * - GatewayError は `map-gateway-error.ts` で ApplicationError に変換
 * - 検証は infra 層の URLエンコード + GitHub API 側に委ね、本層は変換責務のみ
 *
 * 流れ:
 *   owner / repo string
 *     → gateway.findByOwnerAndRepo()
 *       → GatewayError なら mapGatewayError → not-found / rate-limit / forbidden / etc
 *     → Repository を Ok で返す
 */
export class GetRepositoryDetailUseCase {
  constructor(private readonly gateway: RepositoryGateway) {}

  async execute(
    owner: string,
    repo: string,
  ): Promise<ResultType<Repository, ApplicationError>> {
    const result = await this.gateway.findByOwnerAndRepo(owner, repo);
    if (!result.ok) {
      return Result.err(mapGatewayError(result.error));
    }
    return Result.ok(result.value);
  }
}
