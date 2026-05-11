import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  GitHubRepositoryGateway,
  parseRateLimitError,
  parseForbiddenReason,
  type FetchLike,
} from "./github-repository-gateway";
import { SearchQuery } from "@/domain/search/search-query";
import searchSuccess from "@/../tests/fixtures/github-api/search-success.json";
import searchEmpty from "@/../tests/fixtures/github-api/search-empty.json";
import repositoryDetail from "@/../tests/fixtures/github-api/repository-detail.json";
import rateLimit403 from "@/../tests/fixtures/github-api/rate-limit-403.json";
import secondaryRateLimit403 from "@/../tests/fixtures/github-api/secondary-rate-limit-403.json";
import forbidden403 from "@/../tests/fixtures/github-api/forbidden-403.json";
import serverError500 from "@/../tests/fixtures/github-api/server-error-500.json";

function buildResponse(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response {
  const status = init.status ?? 200;
  const headers = new Headers(init.headers ?? {});
  if (!headers.has("Content-Type"))
    headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(body), { status, headers });
}

function unwrapQuery(input: string): SearchQuery {
  const r = SearchQuery.create(input);
  if (!r.ok) throw new Error("test setup: invalid query");
  return r.value;
}

describe("GitHubRepositoryGateway.search — happy path", () => {
  let fetchMock: ReturnType<typeof vi.fn<FetchLike>>;
  let gateway: GitHubRepositoryGateway;

  beforeEach(() => {
    fetchMock = vi.fn<FetchLike>();
    gateway = new GitHubRepositoryGateway({ fetchImpl: fetchMock });
  });

  it("200 + items → Ok(SearchResult)", async () => {
    fetchMock.mockResolvedValueOnce(buildResponse(searchSuccess));
    const result = await gateway.search(unwrapQuery("react"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.totalCount).toBe(2);
    expect(result.value.items).toHaveLength(2);
    expect(result.value.items[0]?.fullName).toBe("facebook/react");
    expect(result.value.items[0]?.stargazersCount).toBe(232000);
    expect(result.value.items[0]?.updatedAt).toBeInstanceOf(Date);
  });

  it("200 + items: [] → Ok(empty)", async () => {
    fetchMock.mockResolvedValueOnce(buildResponse(searchEmpty));
    const result = await gateway.search(unwrapQuery("xxxxxxxxxxxx"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.totalCount).toBe(0);
    expect(result.value.items).toHaveLength(0);
  });
});

describe("GitHubRepositoryGateway.search — URL / headers", () => {
  let fetchMock: ReturnType<typeof vi.fn<FetchLike>>;

  beforeEach(() => {
    fetchMock = vi.fn<FetchLike>();
  });

  it("デフォルト perPage=30, page=1 を URL に含める", async () => {
    fetchMock.mockResolvedValueOnce(buildResponse(searchEmpty));
    const gateway = new GitHubRepositoryGateway({ fetchImpl: fetchMock });
    await gateway.search(unwrapQuery("react"));
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain("per_page=30");
    expect(url).toContain("page=1");
    expect(url).toContain("q=react");
  });

  it("options.perPage / options.page を URL に反映", async () => {
    fetchMock.mockResolvedValueOnce(buildResponse(searchEmpty));
    const gateway = new GitHubRepositoryGateway({ fetchImpl: fetchMock });
    await gateway.search(unwrapQuery("react"), { perPage: 50, page: 2 });
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain("per_page=50");
    expect(url).toContain("page=2");
  });

  it("c++ を URL エンコードして q=c%2B%2B にする", async () => {
    fetchMock.mockResolvedValueOnce(buildResponse(searchEmpty));
    const gateway = new GitHubRepositoryGateway({ fetchImpl: fetchMock });
    await gateway.search(unwrapQuery("c++"));
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain("q=c%2B%2B");
    expect(url).not.toContain("q=c++");
  });

  it("token 未指定時は Authorization ヘッダなし", async () => {
    fetchMock.mockResolvedValueOnce(buildResponse(searchEmpty));
    const gateway = new GitHubRepositoryGateway({ fetchImpl: fetchMock });
    await gateway.search(unwrapQuery("react"));
    const init = fetchMock.mock.calls[0]?.[1];
    const headers = init?.headers as Record<string, string>;
    expect(headers["Authorization"]).toBeUndefined();
    expect(headers["Accept"]).toBe("application/vnd.github+json");
    expect(headers["X-GitHub-Api-Version"]).toBe("2022-11-28");
  });

  it("token 指定時は Authorization: Bearer を付ける", async () => {
    fetchMock.mockResolvedValueOnce(buildResponse(searchEmpty));
    const gateway = new GitHubRepositoryGateway({
      fetchImpl: fetchMock,
      token: "test-token-not-real-xxxx",
    });
    await gateway.search(unwrapQuery("react"));
    const init = fetchMock.mock.calls[0]?.[1];
    const headers = init?.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer test-token-not-real-xxxx");
  });

  it("空文字 token は付けない", async () => {
    fetchMock.mockResolvedValueOnce(buildResponse(searchEmpty));
    const gateway = new GitHubRepositoryGateway({
      fetchImpl: fetchMock,
      token: "",
    });
    await gateway.search(unwrapQuery("react"));
    const init = fetchMock.mock.calls[0]?.[1];
    const headers = init?.headers as Record<string, string>;
    expect(headers["Authorization"]).toBeUndefined();
  });

  it("cache: 'no-store' を指定（検索結果は常に最新）", async () => {
    fetchMock.mockResolvedValueOnce(buildResponse(searchEmpty));
    const gateway = new GitHubRepositoryGateway({ fetchImpl: fetchMock });
    await gateway.search(unwrapQuery("react"));
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.cache).toBe("no-store");
  });
});

describe("GitHubRepositoryGateway.search — HTTP error", () => {
  let fetchMock: ReturnType<typeof vi.fn<FetchLike>>;
  let gateway: GitHubRepositoryGateway;

  beforeEach(() => {
    fetchMock = vi.fn<FetchLike>();
    gateway = new GitHubRepositoryGateway({ fetchImpl: fetchMock });
  });

  it("422 → http-error{status:422}", async () => {
    fetchMock.mockResolvedValueOnce(
      buildResponse({ message: "Validation Failed" }, { status: 422 }),
    );
    const result = await gateway.search(unwrapQuery("react"));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ kind: "http-error", status: 422 });
  });

  it.each([500, 502, 503, 504])(
    "%d → http-error{status:%d}",
    async (status) => {
      fetchMock.mockResolvedValueOnce(
        buildResponse(serverError500, { status }),
      );
      const result = await gateway.search(unwrapQuery("react"));
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toEqual({ kind: "http-error", status });
    },
  );

  it("400 → http-error{status:400}", async () => {
    fetchMock.mockResolvedValueOnce(
      buildResponse({ message: "Bad Request" }, { status: 400 }),
    );
    const result = await gateway.search(unwrapQuery("react"));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ kind: "http-error", status: 400 });
  });
});

describe("GitHubRepositoryGateway.search — 403 / 429 三分類", () => {
  let fetchMock: ReturnType<typeof vi.fn<FetchLike>>;
  let gateway: GitHubRepositoryGateway;

  beforeEach(() => {
    fetchMock = vi.fn<FetchLike>();
    gateway = new GitHubRepositoryGateway({ fetchImpl: fetchMock });
  });

  it("403 + x-ratelimit-remaining:0 + resource:search → rate-limited{resource:'search'}", async () => {
    fetchMock.mockResolvedValueOnce(
      buildResponse(rateLimit403, {
        status: 403,
        headers: {
          "x-ratelimit-remaining": "0",
          "x-ratelimit-reset": "1781000000",
          "x-ratelimit-resource": "search",
        },
      }),
    );
    const result = await gateway.search(unwrapQuery("react"));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("rate-limited");
    if (result.error.kind !== "rate-limited") return;
    expect(result.error.resource).toBe("search");
    expect(result.error.resetAt.getTime()).toBe(1781000000 * 1000);
  });

  it("403 + remaining:0 + resource:core → rate-limited{resource:'core'}", async () => {
    fetchMock.mockResolvedValueOnce(
      buildResponse(rateLimit403, {
        status: 403,
        headers: {
          "x-ratelimit-remaining": "0",
          "x-ratelimit-reset": "1781000000",
          "x-ratelimit-resource": "core",
        },
      }),
    );
    const result = await gateway.search(unwrapQuery("react"));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("rate-limited");
    if (result.error.kind !== "rate-limited") return;
    expect(result.error.resource).toBe("core");
  });

  it("403 + retry-after:60 → secondary-rate-limited{retryAfterSec:60}", async () => {
    fetchMock.mockResolvedValueOnce(
      buildResponse(secondaryRateLimit403, {
        status: 403,
        headers: { "retry-after": "60" },
      }),
    );
    const result = await gateway.search(unwrapQuery("react"));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({
      kind: "secondary-rate-limited",
      retryAfterSec: 60,
    });
  });

  it("403 + remaining:'5' (>0) + body{personal access token} → forbidden{reason:'invalid-token'}", async () => {
    fetchMock.mockResolvedValueOnce(
      buildResponse(forbidden403, {
        status: 403,
        headers: { "x-ratelimit-remaining": "5" },
      }),
    );
    const result = await gateway.search(unwrapQuery("react"));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({
      kind: "forbidden",
      reason: "invalid-token",
    });
  });

  it("403 ヘッダ無し + body{personal access token} → forbidden{reason:'invalid-token'}", async () => {
    fetchMock.mockResolvedValueOnce(
      buildResponse(forbidden403, { status: 403 }),
    );
    const result = await gateway.search(unwrapQuery("react"));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({
      kind: "forbidden",
      reason: "invalid-token",
    });
  });

  it("403 + body{Bad credentials} → forbidden{reason:'invalid-token'}", async () => {
    fetchMock.mockResolvedValueOnce(
      buildResponse(
        { message: "Bad credentials" },
        { status: 403, headers: { "x-ratelimit-remaining": "5" } },
      ),
    );
    const result = await gateway.search(unwrapQuery("react"));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({
      kind: "forbidden",
      reason: "invalid-token",
    });
  });

  it("403 + body{SAML enforcement} → forbidden{reason:'sso-required'}", async () => {
    fetchMock.mockResolvedValueOnce(
      buildResponse(
        {
          message:
            "Resource protected by organization SAML enforcement. You must grant your OAuth token access to this organization.",
        },
        { status: 403, headers: { "x-ratelimit-remaining": "5" } },
      ),
    );
    const result = await gateway.search(unwrapQuery("react"));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({
      kind: "forbidden",
      reason: "sso-required",
    });
  });

  it("403 + body{admin rights} → forbidden{reason:'unknown'} (scope 不足)", async () => {
    fetchMock.mockResolvedValueOnce(
      buildResponse(
        { message: "Must have admin rights to Repository." },
        { status: 403, headers: { "x-ratelimit-remaining": "5" } },
      ),
    );
    const result = await gateway.search(unwrapQuery("react"));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ kind: "forbidden", reason: "unknown" });
  });

  it("403 + body 解析失敗 → forbidden{reason:'unknown'} (フォールバック)", async () => {
    const broken = new Response("not-a-json{", {
      status: 403,
      headers: {
        "x-ratelimit-remaining": "5",
        "Content-Type": "application/json",
      },
    });
    fetchMock.mockResolvedValueOnce(broken);
    const result = await gateway.search(unwrapQuery("react"));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ kind: "forbidden", reason: "unknown" });
  });

  it("403 + X-GitHub-SSO ヘッダ → forbidden{reason:'sso-required'} (公式ヘッダ最優先)", async () => {
    fetchMock.mockResolvedValueOnce(
      buildResponse(
        { message: "Must have admin rights to Repository." },
        {
          status: 403,
          headers: {
            "x-ratelimit-remaining": "5",
            "x-github-sso": "required; url=https://github.com/orgs/example/sso",
          },
        },
      ),
    );
    const result = await gateway.search(unwrapQuery("react"));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({
      kind: "forbidden",
      reason: "sso-required",
    });
  });

  it("403 + X-GitHub-SSO 空文字 → forbidden{reason:'sso-required'} (ヘッダ存在のみで判定)", async () => {
    fetchMock.mockResolvedValueOnce(
      buildResponse(forbidden403, {
        status: 403,
        headers: {
          "x-ratelimit-remaining": "5",
          "x-github-sso": "",
        },
      }),
    );
    const result = await gateway.search(unwrapQuery("react"));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({
      kind: "forbidden",
      reason: "sso-required",
    });
  });

  it("429 + retry-after → secondary-rate-limited", async () => {
    fetchMock.mockResolvedValueOnce(
      buildResponse(
        { message: "Too Many Requests" },
        { status: 429, headers: { "retry-after": "30" } },
      ),
    );
    const result = await gateway.search(unwrapQuery("react"));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({
      kind: "secondary-rate-limited",
      retryAfterSec: 30,
    });
  });

  it("429 + remaining:0 → rate-limited（公式が 429 でも primary を返すと明記）", async () => {
    fetchMock.mockResolvedValueOnce(
      buildResponse(
        { message: "Too Many Requests" },
        {
          status: 429,
          headers: {
            "x-ratelimit-remaining": "0",
            "x-ratelimit-reset": "1781000000",
            "x-ratelimit-resource": "search",
          },
        },
      ),
    );
    const result = await gateway.search(unwrapQuery("react"));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("rate-limited");
  });
});

describe("GitHubRepositoryGateway.search — レスポンス破損", () => {
  let fetchMock: ReturnType<typeof vi.fn<FetchLike>>;
  let gateway: GitHubRepositoryGateway;

  beforeEach(() => {
    fetchMock = vi.fn<FetchLike>();
    gateway = new GitHubRepositoryGateway({ fetchImpl: fetchMock });
  });

  it("JSON.parse 失敗 → malformed-response{cause:'json-parse'}", async () => {
    const broken = new Response("not-a-json{", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
    fetchMock.mockResolvedValueOnce(broken);
    const result = await gateway.search(unwrapQuery("react"));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({
      kind: "malformed-response",
      cause: "json-parse",
    });
  });

  it("zod schema 失敗 → malformed-response{cause:'schema'}", async () => {
    fetchMock.mockResolvedValueOnce(
      buildResponse({
        total_count: "not-a-number",
        incomplete_results: false,
        items: [],
      }),
    );
    const result = await gateway.search(unwrapQuery("react"));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({
      kind: "malformed-response",
      cause: "schema",
    });
  });

  it("不正な updated_at → malformed-response{cause:'schema'}", async () => {
    fetchMock.mockResolvedValueOnce(
      buildResponse({
        total_count: 1,
        incomplete_results: false,
        items: [
          {
            ...searchSuccess.items[0],
            updated_at: "invalid-date-string",
          },
        ],
      }),
    );
    const result = await gateway.search(unwrapQuery("react"));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({
      kind: "malformed-response",
      cause: "schema",
    });
  });
});

describe("GitHubRepositoryGateway.search — network", () => {
  let fetchMock: ReturnType<typeof vi.fn<FetchLike>>;
  let gateway: GitHubRepositoryGateway;

  beforeEach(() => {
    fetchMock = vi.fn<FetchLike>();
    gateway = new GitHubRepositoryGateway({ fetchImpl: fetchMock });
  });

  it("fetch reject (DNS) → network", async () => {
    const dnsError = new Error("getaddrinfo ENOTFOUND api.github.com");
    fetchMock.mockRejectedValueOnce(dnsError);
    const result = await gateway.search(unwrapQuery("react"));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("network");
    if (result.error.kind !== "network") return;
    expect(result.error.cause).toBe(dnsError);
  });

  it("AbortError (timeout) → network", async () => {
    const abortError = new Error("The operation was aborted");
    abortError.name = "AbortError";
    fetchMock.mockRejectedValueOnce(abortError);
    const result = await gateway.search(unwrapQuery("react"));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("network");
    if (result.error.kind !== "network") return;
    expect(result.error.cause).toBe(abortError);
  });
});

describe("GitHubRepositoryGateway.findByOwnerAndRepo", () => {
  let fetchMock: ReturnType<typeof vi.fn<FetchLike>>;
  let gateway: GitHubRepositoryGateway;

  beforeEach(() => {
    fetchMock = vi.fn<FetchLike>();
    gateway = new GitHubRepositoryGateway({ fetchImpl: fetchMock });
  });

  it("200 → Ok(Repository)（description/language null も保持）", async () => {
    fetchMock.mockResolvedValueOnce(buildResponse(repositoryDetail));
    const result = await gateway.findByOwnerAndRepo("facebook", "react");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.fullName).toBe("facebook/react");
    expect(result.value.description).toBeNull();
    expect(result.value.language).toBeNull();
    expect(result.value.updatedAt).toBeInstanceOf(Date);
  });

  it("404 → not-found", async () => {
    fetchMock.mockResolvedValueOnce(
      buildResponse({ message: "Not Found" }, { status: 404 }),
    );
    const result = await gateway.findByOwnerAndRepo("nonexistent", "repo");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ kind: "not-found" });
  });

  it("URL は owner/repo を正しくエンコード", async () => {
    fetchMock.mockResolvedValueOnce(
      buildResponse({ message: "Not Found" }, { status: 404 }),
    );
    await gateway.findByOwnerAndRepo("user space", "repo+name");
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain("/repos/user%20space/repo%2Bname");
  });

  it("403 + retry-after → secondary-rate-limited", async () => {
    fetchMock.mockResolvedValueOnce(
      buildResponse(secondaryRateLimit403, {
        status: 403,
        headers: { "retry-after": "10" },
      }),
    );
    const result = await gateway.findByOwnerAndRepo("facebook", "react");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({
      kind: "secondary-rate-limited",
      retryAfterSec: 10,
    });
  });

  it("403 + body{personal access token} → forbidden{reason:'invalid-token'}", async () => {
    fetchMock.mockResolvedValueOnce(
      buildResponse(forbidden403, {
        status: 403,
        headers: { "x-ratelimit-remaining": "5" },
      }),
    );
    const result = await gateway.findByOwnerAndRepo("facebook", "react");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({
      kind: "forbidden",
      reason: "invalid-token",
    });
  });

  it("403 + body{SAML enforcement} → forbidden{reason:'sso-required'}", async () => {
    fetchMock.mockResolvedValueOnce(
      buildResponse(
        {
          message: "Resource protected by organization SAML enforcement.",
        },
        { status: 403, headers: { "x-ratelimit-remaining": "5" } },
      ),
    );
    const result = await gateway.findByOwnerAndRepo("facebook", "react");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({
      kind: "forbidden",
      reason: "sso-required",
    });
  });

  it("403 + body{admin rights} → forbidden{reason:'unknown'}", async () => {
    fetchMock.mockResolvedValueOnce(
      buildResponse(
        { message: "Must have admin rights to Repository." },
        { status: 403, headers: { "x-ratelimit-remaining": "5" } },
      ),
    );
    const result = await gateway.findByOwnerAndRepo("facebook", "react");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ kind: "forbidden", reason: "unknown" });
  });

  it("403 + body 解析失敗 → forbidden{reason:'unknown'}", async () => {
    const broken = new Response("not-a-json{", {
      status: 403,
      headers: {
        "x-ratelimit-remaining": "5",
        "Content-Type": "application/json",
      },
    });
    fetchMock.mockResolvedValueOnce(broken);
    const result = await gateway.findByOwnerAndRepo("facebook", "react");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ kind: "forbidden", reason: "unknown" });
  });

  it("500 → http-error{status:500}", async () => {
    fetchMock.mockResolvedValueOnce(
      buildResponse(serverError500, { status: 500 }),
    );
    const result = await gateway.findByOwnerAndRepo("facebook", "react");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ kind: "http-error", status: 500 });
  });

  it("zod schema 失敗 → malformed-response{cause:'schema'}", async () => {
    fetchMock.mockResolvedValueOnce(
      buildResponse({ id: "not-a-number", full_name: "x/y" }),
    );
    const result = await gateway.findByOwnerAndRepo("facebook", "react");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({
      kind: "malformed-response",
      cause: "schema",
    });
  });
});

describe("parseRateLimitError (helper)", () => {
  it("status 200 → null（rate-limit エラーではない）", () => {
    const r = new Response("", { status: 200 });
    expect(parseRateLimitError(r)).toBeNull();
  });

  it("status 500 → null（rate-limit エラーではない）", () => {
    const r = new Response("", { status: 500 });
    expect(parseRateLimitError(r)).toBeNull();
  });

  it("retry-after が非数値 → 数値判定をスキップして次の優先度へ", () => {
    const r = new Response("", {
      status: 403,
      headers: { "retry-after": "not-a-number" },
    });
    const result = parseRateLimitError(r);
    expect(result?.kind).toBe("forbidden");
  });

  it("retry-after: 0 → secondary-rate-limited{retryAfterSec:0}", () => {
    const r = new Response("", {
      status: 403,
      headers: { "retry-after": "0" },
    });
    expect(parseRateLimitError(r)).toEqual({
      kind: "secondary-rate-limited",
      retryAfterSec: 0,
    });
  });

  it("retry-after: 99999 → 3600 で clamp（防御的、UI表示時間の暴走防止）", () => {
    const r = new Response("", {
      status: 403,
      headers: { "retry-after": "99999" },
    });
    expect(parseRateLimitError(r)).toEqual({
      kind: "secondary-rate-limited",
      retryAfterSec: 3600,
    });
  });

  it("403 + remaining:0 だが reset ヘッダ欠落 → forbidden（フォールバック設計）", () => {
    const r = new Response("", {
      status: 403,
      headers: { "x-ratelimit-remaining": "0" },
    });
    expect(parseRateLimitError(r)).toEqual({
      kind: "forbidden",
      reason: "unknown",
    });
  });

  it("403 + remaining:0 だが reset:NaN → forbidden（フォールバック設計）", () => {
    const r = new Response("", {
      status: 403,
      headers: {
        "x-ratelimit-remaining": "0",
        "x-ratelimit-reset": "not-a-number",
      },
    });
    expect(parseRateLimitError(r)).toEqual({
      kind: "forbidden",
      reason: "unknown",
    });
  });
});

describe("GitHubRepositoryGateway.search — defensive input clamp", () => {
  let fetchMock: ReturnType<typeof vi.fn<FetchLike>>;
  let gateway: GitHubRepositoryGateway;

  beforeEach(() => {
    fetchMock = vi.fn<FetchLike>();
    gateway = new GitHubRepositoryGateway({ fetchImpl: fetchMock });
  });

  it("perPage: 999 → 100 で clamp（GitHub API 上限）", async () => {
    fetchMock.mockResolvedValueOnce(buildResponse(searchEmpty));
    await gateway.search(unwrapQuery("react"), { perPage: 999 });
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain("per_page=100");
  });

  it("perPage: 0 → 1 で clamp", async () => {
    fetchMock.mockResolvedValueOnce(buildResponse(searchEmpty));
    await gateway.search(unwrapQuery("react"), { perPage: 0 });
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain("per_page=1");
  });

  it("page: 0 → 1 で clamp", async () => {
    fetchMock.mockResolvedValueOnce(buildResponse(searchEmpty));
    await gateway.search(unwrapQuery("react"), { page: 0 });
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain("page=1");
  });

  it("perPage: 30.7 → 30 に truncate", async () => {
    fetchMock.mockResolvedValueOnce(buildResponse(searchEmpty));
    await gateway.search(unwrapQuery("react"), { perPage: 30.7 });
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain("per_page=30");
  });
});

describe("parseForbiddenReason (helper)", () => {
  it("body: null → unknown", () => {
    expect(parseForbiddenReason(null)).toBe("unknown");
  });

  it("body: undefined → unknown", () => {
    expect(parseForbiddenReason(undefined)).toBe("unknown");
  });

  it("body: 文字列 → unknown", () => {
    expect(parseForbiddenReason("plain text")).toBe("unknown");
  });

  it("body: { message: 数値 } → unknown", () => {
    expect(parseForbiddenReason({ message: 123 })).toBe("unknown");
  });

  it("body: { message: 'Bad credentials' } → invalid-token", () => {
    expect(parseForbiddenReason({ message: "Bad credentials" })).toBe(
      "invalid-token",
    );
  });

  it("body: { message: 'Token expired' } → invalid-token", () => {
    expect(parseForbiddenReason({ message: "Token expired" })).toBe(
      "invalid-token",
    );
  });

  it("body: { message: 'Resource not accessible by personal access token' } → invalid-token", () => {
    expect(
      parseForbiddenReason({
        message: "Resource not accessible by personal access token.",
      }),
    ).toBe("invalid-token");
  });

  it("body: { message: 'Requires authentication' } → invalid-token", () => {
    expect(parseForbiddenReason({ message: "Requires authentication" })).toBe(
      "invalid-token",
    );
  });

  it("body: { message: 'SAML enforcement' } → sso-required", () => {
    expect(
      parseForbiddenReason({
        message:
          "Resource protected by organization SAML enforcement. Grant access.",
      }),
    ).toBe("sso-required");
  });

  it("body: { message: 'single sign-on' } → sso-required", () => {
    expect(
      parseForbiddenReason({
        message: "single sign-on configuration required",
      }),
    ).toBe("sso-required");
  });

  it("body: { message: 'single sign on' } (ハイフンなし) → sso-required", () => {
    expect(
      parseForbiddenReason({
        message: "single sign on required for organization",
      }),
    ).toBe("sso-required");
  });

  it("body: { message: 'SSO enforcement' } → sso-required", () => {
    expect(
      parseForbiddenReason({ message: "SSO enforcement is enabled" }),
    ).toBe("sso-required");
  });

  it("body: { message: 'Must have admin rights' } → unknown (scope 不足)", () => {
    expect(
      parseForbiddenReason({
        message: "Must have admin rights to Repository.",
      }),
    ).toBe("unknown");
  });

  it("大文字小文字を無視（'BAD CREDENTIALS' → invalid-token）", () => {
    expect(parseForbiddenReason({ message: "BAD CREDENTIALS" })).toBe(
      "invalid-token",
    );
  });
});
