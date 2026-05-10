import { describe, it, expect } from "vitest";
import type { ApplicationError } from "./application-error";

describe("ApplicationError 型（8 kind）", () => {
  it("invalid-query kind", () => {
    const e: ApplicationError = { kind: "invalid-query", reason: "empty" };
    expect(e.kind).toBe("invalid-query");
  });

  it("invalid-query は empty | too-long の 2 reason", () => {
    const e1: ApplicationError = { kind: "invalid-query", reason: "empty" };
    const e2: ApplicationError = { kind: "invalid-query", reason: "too-long" };
    expect(e1.reason).toBe("empty");
    expect(e2.reason).toBe("too-long");
  });

  it("rate-limit kind", () => {
    const e: ApplicationError = {
      kind: "rate-limit",
      resetAt: new Date("2026-05-11T00:00:00Z"),
      resource: "search",
    };
    expect(e.kind).toBe("rate-limit");
    expect(e.resource).toBe("search");
  });

  it("forbidden kind は 3 reason", () => {
    const reasons: Array<
      Extract<ApplicationError, { kind: "forbidden" }>["reason"]
    > = ["invalid-token", "sso-required", "unknown"];
    for (const reason of reasons) {
      const e: ApplicationError = { kind: "forbidden", reason };
      expect(e.kind).toBe("forbidden");
    }
  });

  it("not-found kind", () => {
    const e: ApplicationError = { kind: "not-found" };
    expect(e.kind).toBe("not-found");
  });

  it("upstream-error kind", () => {
    const e: ApplicationError = { kind: "upstream-error", status: 500 };
    expect(e.kind).toBe("upstream-error");
    expect(e.status).toBe(500);
  });

  it("malformed-response kind", () => {
    const e: ApplicationError = { kind: "malformed-response" };
    expect(e.kind).toBe("malformed-response");
  });

  it("schema-mismatch kind", () => {
    const e: ApplicationError = { kind: "schema-mismatch" };
    expect(e.kind).toBe("schema-mismatch");
  });

  it("network kind", () => {
    const e: ApplicationError = { kind: "network", cause: new Error("DNS") };
    expect(e.kind).toBe("network");
  });
});
