import { describe, it, expect } from "vitest";
import type { GatewayError } from "./gateway-error";

describe("GatewayError 型", () => {
  it("http-error kind", () => {
    const e: GatewayError = { kind: "http-error", status: 500 };
    expect(e.kind).toBe("http-error");
    expect(e.status).toBe(500);
  });

  it("http-error kind with optional resource", () => {
    const e: GatewayError = {
      kind: "http-error",
      status: 422,
      resource: "search",
    };
    if (e.kind === "http-error") {
      expect(e.resource).toBe("search");
    }
  });

  it("rate-limited kind", () => {
    const e: GatewayError = {
      kind: "rate-limited",
      resetAt: new Date("2026-05-11T00:00:00Z"),
      resource: "search",
    };
    expect(e.kind).toBe("rate-limited");
  });

  it("secondary-rate-limited kind", () => {
    const e: GatewayError = {
      kind: "secondary-rate-limited",
      retryAfterSec: 60,
    };
    expect(e.retryAfterSec).toBe(60);
  });

  it("forbidden kind (3 reasons)", () => {
    const reasons: GatewayError["kind"] extends "forbidden"
      ? never
      : Array<Extract<GatewayError, { kind: "forbidden" }>["reason"]> = [
      "invalid-token",
      "sso-required",
      "unknown",
    ];
    for (const reason of reasons) {
      const e: GatewayError = { kind: "forbidden", reason };
      expect(e.kind).toBe("forbidden");
    }
  });

  it("not-found kind", () => {
    const e: GatewayError = { kind: "not-found" };
    expect(e.kind).toBe("not-found");
  });

  it("malformed-response kind (2 causes)", () => {
    const e1: GatewayError = {
      kind: "malformed-response",
      cause: "json-parse",
    };
    const e2: GatewayError = { kind: "malformed-response", cause: "schema" };
    expect(e1.cause).toBe("json-parse");
    expect(e2.cause).toBe("schema");
  });

  it("network kind", () => {
    const e: GatewayError = {
      kind: "network",
      cause: new Error("DNS lookup failed"),
    };
    expect(e.kind).toBe("network");
  });
});
