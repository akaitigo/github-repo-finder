import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mapGatewayError } from "./map-gateway-error";
import type { GatewayError } from "@/application/ports/gateway-error";

describe("mapGatewayError (GatewayError → ApplicationError)", () => {
  it("http-error{status:422} → upstream-error{status:422}", () => {
    const input: GatewayError = { kind: "http-error", status: 422 };
    expect(mapGatewayError(input)).toEqual({
      kind: "upstream-error",
      status: 422,
    });
  });

  it("http-error{status:500} → upstream-error{status:500}", () => {
    const input: GatewayError = { kind: "http-error", status: 500 };
    expect(mapGatewayError(input)).toEqual({
      kind: "upstream-error",
      status: 500,
    });
  });

  it("rate-limited → rate-limit (resetAt と resource を引き継ぎ)", () => {
    const resetAt = new Date("2026-05-11T00:00:00Z");
    const input: GatewayError = {
      kind: "rate-limited",
      resetAt,
      resource: "search",
    };
    expect(mapGatewayError(input)).toEqual({
      kind: "rate-limit",
      resetAt,
      resource: "search",
    });
  });

  it("rate-limited resource:core → rate-limit resource:core", () => {
    const resetAt = new Date("2026-05-11T00:00:00Z");
    const input: GatewayError = {
      kind: "rate-limited",
      resetAt,
      resource: "core",
    };
    const result = mapGatewayError(input);
    if (result.kind !== "rate-limit") throw new Error("kind mismatch");
    expect(result.resource).toBe("core");
  });

  describe("secondary-rate-limited → rate-limit (resetAt = now + retryAfterSec*1000)", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-05-11T00:00:00Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("retryAfterSec:60 → resetAt = now + 60s, resource:'search' に統一", () => {
      const input: GatewayError = {
        kind: "secondary-rate-limited",
        retryAfterSec: 60,
      };
      const result = mapGatewayError(input);
      expect(result).toEqual({
        kind: "rate-limit",
        resetAt: new Date("2026-05-11T00:01:00Z"),
        resource: "search",
      });
    });

    it("retryAfterSec:0 → resetAt = now", () => {
      const input: GatewayError = {
        kind: "secondary-rate-limited",
        retryAfterSec: 0,
      };
      const result = mapGatewayError(input);
      if (result.kind !== "rate-limit") throw new Error("kind mismatch");
      expect(result.resetAt.getTime()).toBe(Date.now());
    });
  });

  it("forbidden{reason:'invalid-token'} → forbidden{reason:'invalid-token'}", () => {
    const input: GatewayError = {
      kind: "forbidden",
      reason: "invalid-token",
    };
    expect(mapGatewayError(input)).toEqual({
      kind: "forbidden",
      reason: "invalid-token",
    });
  });

  it("forbidden{reason:'sso-required'} → forbidden{reason:'sso-required'}", () => {
    const input: GatewayError = { kind: "forbidden", reason: "sso-required" };
    expect(mapGatewayError(input)).toEqual({
      kind: "forbidden",
      reason: "sso-required",
    });
  });

  it("forbidden{reason:'unknown'} → forbidden{reason:'unknown'}", () => {
    const input: GatewayError = { kind: "forbidden", reason: "unknown" };
    expect(mapGatewayError(input)).toEqual({
      kind: "forbidden",
      reason: "unknown",
    });
  });

  it("not-found → not-found", () => {
    const input: GatewayError = { kind: "not-found" };
    expect(mapGatewayError(input)).toEqual({ kind: "not-found" });
  });

  it("malformed-response{cause:'json-parse'} → malformed-response", () => {
    const input: GatewayError = {
      kind: "malformed-response",
      cause: "json-parse",
    };
    expect(mapGatewayError(input)).toEqual({ kind: "malformed-response" });
  });

  it("malformed-response{cause:'schema'} → schema-mismatch", () => {
    const input: GatewayError = {
      kind: "malformed-response",
      cause: "schema",
    };
    expect(mapGatewayError(input)).toEqual({ kind: "schema-mismatch" });
  });

  it("network → network (cause を引き継ぎ)", () => {
    const cause = new Error("DNS lookup failed");
    const input: GatewayError = { kind: "network", cause };
    expect(mapGatewayError(input)).toEqual({ kind: "network", cause });
  });
});
