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
 * - 403/429 を 3 分類（{@link parseRateLimitError} 参照、フォールバック挙動も明記）:
 *   - retry-after あり → secondary-rate-limited（retryAfterSec は 1 時間で clamp）
 *   - x-ratelimit-remaining: 0 かつ reset ヘッダあり → rate-limited
 *   - 上記以外（remaining > 0 / reset 欠落 / NaN） → forbidden
 * - per_page / page は防御的に clamp（per_page: 1〜100、page: 1〜）
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
    // 防御: GitHub Search API の per_page 上限 100、page 下限 1 を defensive clamp
    // 上位層の入力検証に依存せず、不正値をここで吸収する（Issue #6 設計判断）
    const perPage = Math.min(
      100,
      Math.max(1, Math.trunc(options?.perPage ?? 30)),
    );
    const page = Math.max(1, Math.trunc(options?.page ?? 1));
    const params = new URLSearchParams({
      q: query.value,
      per_page: String(perPage),
      page: String(page),
    });
    const url = `${GITHUB_API_BASE}/search/repositories?${params.toString()}`;

    const fetchResult = await this.safeFetch(url);
    if (!fetchResult.ok) return fetchResult;

    const response = fetchResult.value;

    const rateLimitErr = parseRateLimitError(response);
    if (rateLimitErr !== null) {
      return Result.err(await enrichForbiddenReason(response, rateLimitErr));
    }

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
    if (rateLimitErr !== null) {
      return Result.err(await enrichForbiddenReason(response, rateLimitErr));
    }

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

const RETRY_AFTER_MAX_SEC = 3600;

/**
 * 403/429 を 3 分類して GatewayError に変換するヘルパ。
 *
 * 判定優先順位:
 * 1. retry-after ヘッダあり → secondary-rate-limited（公式が abuse detection で必ず返す）
 * 2. x-ratelimit-remaining: 0 かつ x-ratelimit-reset あり → rate-limited（primary、resetAt 表示用）
 * 3. 上記以外 → forbidden（待っても直らない、ユーザー操作要）
 *
 * フォールバック挙動:
 * - retry-after が非数値 → 次の優先度（remaining 判定）に進む
 * - remaining: 0 だが reset ヘッダ欠落 → forbidden にフォールバック
 *   （UI で「待ち時間」を出せないため待機誘導しない、操作誘導に倒す）
 * - remaining > 0 / NaN → forbidden（invalid-token / SSO の可能性が高い）
 *
 * 防御的処理:
 * - retry-after の値は 1 時間 ({@link RETRY_AFTER_MAX_SEC} 秒) で clamp
 *   （GitHub が異常値を返した場合に UI の表示時間が暴走しない）
 *
 * 公式 docs: https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
 */
export function parseRateLimitError(response: Response): GatewayError | null {
  if (response.status !== 403 && response.status !== 429) return null;

  const retryAfterRaw = response.headers.get("retry-after");
  if (retryAfterRaw !== null) {
    const retryAfterSec = Number.parseInt(retryAfterRaw, 10);
    if (Number.isFinite(retryAfterSec) && retryAfterSec >= 0) {
      return {
        kind: "secondary-rate-limited",
        retryAfterSec: Math.min(retryAfterSec, RETRY_AFTER_MAX_SEC),
      };
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

/**
 * forbidden GatewayError の reason を「ヘッダ + body」で詳細化する。
 *
 * 処理優先順位:
 * 1. baseError が forbidden 以外 → そのまま返す（変換不要）
 * 2. `X-GitHub-SSO` ヘッダ存在 → sso-required を即確定（公式ヘッダ優先、body 表記揺れに非依存）
 * 3. body の message を {@link parseForbiddenReason} で判定（補助的な解析）
 * 4. body 解析失敗 → reason: 'unknown' にフォールバック
 *
 * 設計判断:
 * - **公式ヘッダ (X-GitHub-SSO) を最優先**: body 文言は localize / 仕様変更で揺れ得るが、ヘッダは API 契約
 * - parseRateLimitError と分離（同期 vs 非同期、責務の分離）
 * - response.clone() で body 2 度読み回避（呼び出し元の後続読み取りを保護）
 *
 * 参考: SAML SSO 強制時の 403 では `X-GitHub-SSO` ヘッダが返される
 * https://docs.github.com/en/enterprise-cloud@latest/authentication/authenticating-with-saml-single-sign-on/authorizing-a-personal-access-token-for-use-with-saml-single-sign-on
 */
async function enrichForbiddenReason(
  response: Response,
  baseError: GatewayError,
): Promise<GatewayError> {
  if (baseError.kind !== "forbidden") return baseError;

  // 公式ヘッダで sso-required を即確定（body 表記揺れに非依存）
  if (response.headers.get("x-github-sso") !== null) {
    return { kind: "forbidden", reason: "sso-required" };
  }

  const cloned = response.clone();
  const jsonResult = await safeJson(cloned);
  const reason = jsonResult.ok
    ? parseForbiddenReason(jsonResult.value)
    : "unknown";
  return { kind: "forbidden", reason };
}

/**
 * 403 レスポンス body の message から forbidden の reason を判定。
 *
 * 判定優先順位:
 * 1. SAML / SSO / single sign-on 関連 → sso-required（org SSO enforcement）
 * 2. Bad credentials / token expired / invalid token / personal access token / requires authentication → invalid-token
 * 3. それ以外 → unknown（scope 不足、admin 権限不足等）
 *
 * 参考: GitHub API の 403 message 例
 * - "Resource not accessible by personal access token." → invalid-token
 * - "Bad credentials" → invalid-token
 * - "Resource protected by organization SAML enforcement..." → sso-required
 * - "Must have admin rights to Repository." → unknown
 *
 * 設計判断:
 * - 大文字小文字を無視するため lower で比較
 * - body が { message: string } 形でない場合は unknown
 */
export function parseForbiddenReason(
  body: unknown,
): "invalid-token" | "sso-required" | "unknown" {
  if (typeof body !== "object" || body === null) return "unknown";
  const message = (body as Record<string, unknown>).message;
  if (typeof message !== "string") return "unknown";

  const lower = message.toLowerCase();

  if (
    lower.includes("saml enforcement") ||
    lower.includes("single sign-on") ||
    lower.includes("single sign on") ||
    lower.includes("sso enforcement")
  ) {
    return "sso-required";
  }

  if (
    lower.includes("bad credentials") ||
    lower.includes("token expired") ||
    lower.includes("invalid token") ||
    lower.includes("personal access token") ||
    lower.includes("requires authentication")
  ) {
    return "invalid-token";
  }

  return "unknown";
}
