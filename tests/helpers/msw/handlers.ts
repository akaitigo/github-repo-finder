import { http, HttpResponse } from "msw";
import searchSuccess from "@/../tests/fixtures/github-api/search-success.json";
import searchEmpty from "@/../tests/fixtures/github-api/search-empty.json";
import rateLimit403 from "@/../tests/fixtures/github-api/rate-limit-403.json";

/**
 * MSW handlers for integration tests.
 *
 * 用途: presentation 結合テストで infrastructure 層の fetch を mock する際の handler セット。
 *
 * 設計判断:
 * - MSW v2 (http.* API) を使用
 * - fixtures は infra テストと共有 (tests/fixtures/github-api/)
 * - 各 handler は呼び出されない検索 query 等は MSW v2 の onUnhandledRequest:'error' で検出
 */

export const successHandlers = [
  http.get("https://api.github.com/search/repositories", () => {
    return HttpResponse.json(searchSuccess);
  }),
];

export const emptyHandlers = [
  http.get("https://api.github.com/search/repositories", () => {
    return HttpResponse.json(searchEmpty);
  }),
];

export const rateLimitHandlers = [
  http.get("https://api.github.com/search/repositories", () => {
    return HttpResponse.json(rateLimit403, {
      status: 403,
      headers: {
        "x-ratelimit-remaining": "0",
        "x-ratelimit-reset": "1781000000",
        "x-ratelimit-resource": "search",
      },
    });
  }),
];
