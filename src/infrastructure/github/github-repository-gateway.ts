import type { Repository } from "@/domain/repository/repository";
import { Result, type Result as ResultType } from "@/domain/shared/result";
import type { SearchQuery } from "@/domain/search/search-query";
import type { GatewayError } from "@/application/ports/gateway-error";
import type {
  RepositoryGateway,
  SearchOptions,
} from "@/application/ports/repository-gateway";
import type { SearchResult } from "@/application/types/search-result";
import {
  RepositoryResponseSchema,
  SearchResponseSchema,
} from "./github-api-types";
import { toRepository } from "./github-api-mapper";

const GITHUB_API_BASE = "https://api.github.com";
const ACCEPT_HEADER = "application/vnd.github+json";
const API_VERSION = "2022-11-28";

/**
 * GitHub API への fetch を抽象化する型（テスト時の差し替え用）。
 * グローバル fetch の signature と一致させる。
 */
export type FetchLike = typeof fetch;

export interface GitHubRepositoryGatewayDeps {
  /** GitHub Personal Access Token（未指定なら未認証 fetch、search bucket: 10 req/min） */
  readonly token?: string;
  /** テスト時に vi.fn() で差し替え可能な fetch 実装 */
  readonly fetchImpl?: FetchLike;
}

/**
 * GitHub Search API を呼び出す `RepositoryGateway` 実装。
 *
 * 設計判断:
 * - 標準 `fetch` を使用（@octokit/rest 不採用、依存削減 + Next.js キャッシュ統合）
 * - REST `/search/repositories` を使用（GraphQL 不要）
 * - 自動リトライしない（rate limit 時はユーザー操作 `<Link>` Retry に委ねる）
 * - 403/429 を 3 分類:
 *   - retry-after あり → secondary-rate-limited
 *   - x-ratelimit-remaining: 0 → rate-limited
 *   - 上記以外（remaining > 0） → forbidden
 * - zod でレスポンス検証 → schema drift を検知
 */
export class GitHubRepositoryGateway implements RepositoryGateway {
  private readonly token: string | undefined;
  private readonly fetchImpl: FetchLike;

  constructor(deps: GitHubRepositoryGatewayDeps = {}) {
    this.token = deps.token;
    this.fetchImpl = deps.fetchImpl ?? fetch;
  }

  async search(
    query: SearchQuery,
    options?: SearchOptions,
  ): Promise<ResultType<SearchResult, GatewayError>> {
    const params = new URLSearchParams({
      q: query.value,
      per_page: String(options?.perPage ?? 30),
      page: String(options?.page ?? 1),
    });
    const url = `${GITHUB_API_BASE}/search/repositories?${params.toString()}`;

    const fetchResult = await this.safeFetch(url);
    if (!fetchResult.ok) return fetchResult;

    const response = fetchResult.value;

    const rateLimitErr = parseRateLimitError(response);
    if (rateLimitErr !== null) return Result.err(rateLimitErr);

    if (!response.ok) {
      return Result.err({ kind: "http-error", status: response.status });
    }

    const jsonResult = await safeJson(response);
    if (!jsonResult.ok) return jsonResult;

    const parsed = SearchResponseSchema.safeParse(jsonResult.value);
    if (!parsed.success) {
      return Result.err({ kind: "malformed-response", cause: "schema" });
    }

    return Result.ok({
      items: parsed.data.items.map(toRepository),
      totalCount: parsed.data.total_count,
      incompleteResults: parsed.data.incomplete_results,
    });
  }

  async findByOwnerAndRepo(
    owner: string,
    repo: string,
  ): Promise<ResultType<Repository, GatewayError>> {
    const url = `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

    const fetchResult = await this.safeFetch(url);
    if (!fetchResult.ok) return fetchResult;

    const response = fetchResult.value;

    const rateLimitErr = parseRateLimitError(response);
    if (rateLimitErr !== null) return Result.err(rateLimitErr);

    if (response.status === 404) {
      return Result.err({ kind: "not-found" });
    }
    if (!response.ok) {
      return Result.err({ kind: "http-error", status: response.status });
    }

    const jsonResult = await safeJson(response);
    if (!jsonResult.ok) return jsonResult;

    const parsed = RepositoryResponseSchema.safeParse(jsonResult.value);
    if (!parsed.success) {
      return Result.err({ kind: "malformed-response", cause: "schema" });
    }

    return Result.ok(toRepository(parsed.data));
  }

  private async safeFetch(
    url: string,
  ): Promise<ResultType<Response, GatewayError>> {
    try {
      const response = await this.fetchImpl(url, {
        headers: this.buildHeaders(),
        cache: "no-store",
      });
      return Result.ok(response);
    } catch (e: unknown) {
      return Result.err({ kind: "network", cause: e });
    }
  }

  private buildHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      Accept: ACCEPT_HEADER,
      "X-GitHub-Api-Version": API_VERSION,
    };
    if (this.token !== undefined && this.token !== "") {
      headers["Authorization"] = `Bearer ${this.token}`;
    }
    return headers;
  }
}

/**
 * 403/429 を 3 分類して GatewayError に変換するヘルパ。
 *
 * 判定優先順位:
 * 1. retry-after ヘッダあり → secondary-rate-limited（公式が abuse detection で必ず返す）
 * 2. x-ratelimit-remaining: 0 → rate-limited（primary、resetAt 表示用）
 * 3. それ以外（remaining > 0 で 403/429）→ forbidden（待っても直らない、ユーザー操作要）
 *
 * 公式 docs: https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
 */
export function parseRateLimitError(response: Response): GatewayError | null {
  if (response.status !== 403 && response.status !== 429) return null;

  const retryAfterRaw = response.headers.get("retry-after");
  if (retryAfterRaw !== null) {
    const retryAfterSec = Number.parseInt(retryAfterRaw, 10);
    if (Number.isFinite(retryAfterSec) && retryAfterSec >= 0) {
      return { kind: "secondary-rate-limited", retryAfterSec };
    }
  }

  const remainingRaw = response.headers.get("x-ratelimit-remaining");
  const remaining =
    remainingRaw === null ? NaN : Number.parseInt(remainingRaw, 10);
  const resetRaw = response.headers.get("x-ratelimit-reset");
  const resetUnix = resetRaw === null ? NaN : Number.parseInt(resetRaw, 10);

  if (remaining === 0 && Number.isFinite(resetUnix)) {
    const resourceRaw = response.headers.get("x-ratelimit-resource");
    const resource =
      resourceRaw === "core" || resourceRaw === "search"
        ? resourceRaw
        : "search";
    return {
      kind: "rate-limited",
      resetAt: new Date(resetUnix * 1000),
      resource,
    };
  }

  return { kind: "forbidden", reason: "unknown" };
}

async function safeJson(
  response: Response,
): Promise<ResultType<unknown, GatewayError>> {
  try {
    const json: unknown = await response.json();
    return Result.ok(json);
  } catch {
    return Result.err({ kind: "malformed-response", cause: "json-parse" });
  }
}
