import { GitHubRepositoryGateway } from "@/infrastructure/github/github-repository-gateway";
import { SearchRepositoriesUseCase } from "@/application/use-cases/search-repositories";
import { GetRepositoryDetailUseCase } from "@/application/use-cases/get-repository-detail";

/**
 * Composition Root: アプリケーション全体の DI 配線を集約する factory。
 *
 * 設計判断:
 * - **`process.env.GITHUB_TOKEN` は本ファイル経由でのみ参照**（token 漏洩防止の単一窓口）
 * - **`import 'server-only'` 不採用**: テストコスト > 安全性、token 保護は ESLint コードレビューで担保
 *   （設計プラン Tier 6 の判断、ADR 0003 と整合）
 * - factory 関数を export することで、page.tsx は `createSearchUseCase()` を呼ぶだけで完結
 * - GitHubRepositoryGateway は Singleton ではなく毎回 new（stateless、コスト低）
 *
 * 注意:
 * - 本ファイルは Server Component / Server Action / Route Handler からのみ import 可
 * - Client Component (`'use client'`) からの import は ESLint で禁止しないが、
 *   レビューで弾く運用（process.env.* が Client Bundle に含まれない設計を維持）
 */

function getToken(): string | undefined {
  const token = process.env.GITHUB_TOKEN;
  return token !== undefined && token.length > 0 ? token : undefined;
}

export function createSearchUseCase(): SearchRepositoriesUseCase {
  const gateway = new GitHubRepositoryGateway({ token: getToken() });
  return new SearchRepositoriesUseCase(gateway);
}

export function createDetailUseCase(): GetRepositoryDetailUseCase {
  const gateway = new GitHubRepositoryGateway({ token: getToken() });
  return new GetRepositoryDetailUseCase(gateway);
}
