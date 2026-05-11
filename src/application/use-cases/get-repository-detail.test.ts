import { describe, it, expect, beforeEach } from "vitest";
import { Result } from "@/domain/shared/result";
import { GetRepositoryDetailUseCase } from "./get-repository-detail";
import {
  FakeRepositoryGateway,
  makeRepository,
} from "@/../tests/helpers/test-doubles";

describe("GetRepositoryDetailUseCase.execute", () => {
  let fake: FakeRepositoryGateway;
  let useCase: GetRepositoryDetailUseCase;

  beforeEach(() => {
    fake = new FakeRepositoryGateway();
    useCase = new GetRepositoryDetailUseCase(fake);
  });

  it("Gateway Ok → Ok(Repository)", async () => {
    const repo = makeRepository({
      fullName: "vercel/next.js",
      description: null,
      language: null,
    });
    fake.findResult = Result.ok(repo);

    const result = await useCase.execute("vercel", "next.js");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.fullName).toBe("vercel/next.js");
    expect(result.value.description).toBeNull();
    expect(result.value.language).toBeNull();
    expect(fake.lastFindCall).toEqual({ owner: "vercel", repo: "next.js" });
  });

  it("Gateway not-found → not-found", async () => {
    fake.findResult = Result.err({ kind: "not-found" });

    const result = await useCase.execute("ghost", "nonexistent");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ kind: "not-found" });
  });

  it("Gateway rate-limited → rate-limit", async () => {
    const resetAt = new Date("2026-05-11T00:00:00Z");
    fake.findResult = Result.err({
      kind: "rate-limited",
      resetAt,
      resource: "search",
    });

    const result = await useCase.execute("facebook", "react");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({
      kind: "rate-limit",
      resetAt,
      resource: "search",
    });
  });

  it("Gateway forbidden{reason:'sso-required'} → forbidden", async () => {
    fake.findResult = Result.err({ kind: "forbidden", reason: "sso-required" });

    const result = await useCase.execute("private-org", "secret-repo");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({
      kind: "forbidden",
      reason: "sso-required",
    });
  });

  it("Gateway http-error{status:500} → upstream-error{status:500}", async () => {
    fake.findResult = Result.err({ kind: "http-error", status: 500 });

    const result = await useCase.execute("facebook", "react");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ kind: "upstream-error", status: 500 });
  });

  it("Gateway network → network", async () => {
    const cause = new Error("ETIMEDOUT");
    fake.findResult = Result.err({ kind: "network", cause });

    const result = await useCase.execute("facebook", "react");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ kind: "network", cause });
  });
});
