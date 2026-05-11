import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Result } from "@/domain/shared/result";
import { SearchRepositoriesUseCase } from "./search-repositories";
import {
  FakeRepositoryGateway,
  makeRepository,
} from "@/../tests/helpers/test-doubles";

describe("SearchRepositoriesUseCase.execute", () => {
  let fake: FakeRepositoryGateway;
  let useCase: SearchRepositoriesUseCase;

  beforeEach(() => {
    fake = new FakeRepositoryGateway();
    useCase = new SearchRepositoriesUseCase(fake);
  });

  describe("入力バリデーション (ValidationError → invalid-query)", () => {
    it("空文字 → invalid-query{reason:'empty'}", async () => {
      const result = await useCase.execute("");
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toEqual({ kind: "invalid-query", reason: "empty" });
      expect(fake.lastSearchCall).toBeNull();
    });

    it("空白のみ → invalid-query{reason:'empty'}", async () => {
      const result = await useCase.execute("   ");
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toEqual({ kind: "invalid-query", reason: "empty" });
    });

    it("256 字超 → invalid-query{reason:'too-long'}", async () => {
      const result = await useCase.execute("a".repeat(257));
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toEqual({
        kind: "invalid-query",
        reason: "too-long",
      });
      expect(fake.lastSearchCall).toBeNull();
    });
  });

  describe("Gateway 成功 → Ok(SearchResult)", () => {
    it("検索結果あり → Ok（items 含む）", async () => {
      const repo = makeRepository({ fullName: "vercel/next.js" });
      fake.searchResult = Result.ok({
        items: [repo],
        totalCount: 1,
        incompleteResults: false,
      });

      const result = await useCase.execute("react");
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.items).toHaveLength(1);
      expect(result.value.items[0]?.fullName).toBe("vercel/next.js");
      expect(result.value.totalCount).toBe(1);
    });

    it("検索結果 0 件 → Ok（空配列）", async () => {
      fake.searchResult = Result.ok({
        items: [],
        totalCount: 0,
        incompleteResults: false,
      });

      const result = await useCase.execute("xxxxxxxxxxxxxxx");
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.items).toHaveLength(0);
      expect(result.value.totalCount).toBe(0);
    });

    it("validated query が gateway に渡される (trim 済)", async () => {
      await useCase.execute("  react  ");
      expect(fake.lastSearchCall?.query.value).toBe("react");
    });

    it("options が gateway に渡される", async () => {
      await useCase.execute("react", { perPage: 50, page: 2 });
      expect(fake.lastSearchCall?.options).toEqual({ perPage: 50, page: 2 });
    });
  });

  describe("Gateway エラー → mapGatewayError 経由で ApplicationError", () => {
    it("rate-limited → rate-limit", async () => {
      const resetAt = new Date("2026-05-11T00:00:00Z");
      fake.searchResult = Result.err({
        kind: "rate-limited",
        resetAt,
        resource: "search",
      });

      const result = await useCase.execute("react");
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toEqual({
        kind: "rate-limit",
        resetAt,
        resource: "search",
      });
    });

    describe("secondary-rate-limited → rate-limit (resetAt = now + retryAfterSec*1000)", () => {
      beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-05-11T00:00:00Z"));
      });
      afterEach(() => {
        vi.useRealTimers();
      });

      it("retryAfterSec:60 → resetAt = now + 60s, resource:'search'", async () => {
        fake.searchResult = Result.err({
          kind: "secondary-rate-limited",
          retryAfterSec: 60,
        });

        const result = await useCase.execute("react");
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error).toEqual({
          kind: "rate-limit",
          resetAt: new Date("2026-05-11T00:01:00Z"),
          resource: "search",
        });
      });
    });

    it("forbidden{reason:'invalid-token'} → forbidden{reason:'invalid-token'}", async () => {
      fake.searchResult = Result.err({
        kind: "forbidden",
        reason: "invalid-token",
      });

      const result = await useCase.execute("react");
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toEqual({
        kind: "forbidden",
        reason: "invalid-token",
      });
    });

    it("forbidden{reason:'unknown'} → forbidden{reason:'unknown'}", async () => {
      fake.searchResult = Result.err({ kind: "forbidden", reason: "unknown" });

      const result = await useCase.execute("react");
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toEqual({ kind: "forbidden", reason: "unknown" });
    });

    it("http-error{status:500} → upstream-error{status:500}", async () => {
      fake.searchResult = Result.err({ kind: "http-error", status: 500 });

      const result = await useCase.execute("react");
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toEqual({ kind: "upstream-error", status: 500 });
    });

    it("malformed-response{cause:'json-parse'} → malformed-response", async () => {
      fake.searchResult = Result.err({
        kind: "malformed-response",
        cause: "json-parse",
      });

      const result = await useCase.execute("react");
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toEqual({ kind: "malformed-response" });
    });

    it("malformed-response{cause:'schema'} → schema-mismatch", async () => {
      fake.searchResult = Result.err({
        kind: "malformed-response",
        cause: "schema",
      });

      const result = await useCase.execute("react");
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toEqual({ kind: "schema-mismatch" });
    });

    it("network → network (cause 引き継ぎ)", async () => {
      const cause = new Error("ECONNREFUSED");
      fake.searchResult = Result.err({ kind: "network", cause });

      const result = await useCase.execute("react");
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toEqual({ kind: "network", cause });
    });

    it("not-found → not-found (search でも理論上 404 通せる)", async () => {
      fake.searchResult = Result.err({ kind: "not-found" });

      const result = await useCase.execute("react");
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toEqual({ kind: "not-found" });
    });
  });
});
