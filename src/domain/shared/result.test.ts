import { describe, it, expect } from "vitest";
import { Result } from "./result";

describe("Result", () => {
  describe("Result.ok", () => {
    it("returns a success Result with the given value", () => {
      const r = Result.ok(42);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.value).toBe(42);
      }
    });

    it("works with object values", () => {
      const obj = { name: "react" };
      const r = Result.ok(obj);
      if (r.ok) {
        expect(r.value).toBe(obj);
      }
    });

    it("works with undefined value", () => {
      const r = Result.ok(undefined);
      expect(r.ok).toBe(true);
    });

    it("works with null value", () => {
      const r = Result.ok(null);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.value).toBeNull();
      }
    });
  });

  describe("Result.err", () => {
    it("returns a failure Result with the given error", () => {
      const r = Result.err({ kind: "invalid" as const });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.error.kind).toBe("invalid");
      }
    });

    it("works with string errors", () => {
      const r = Result.err("error message");
      if (!r.ok) {
        expect(r.error).toBe("error message");
      }
    });
  });

  describe("type narrowing", () => {
    it("narrows value when ok is true", () => {
      const r: Result<number, string> = Result.ok(10);
      if (r.ok) {
        // TypeScript は r.value を number に絞り込む
        expect(typeof r.value).toBe("number");
        expect(r.value + 1).toBe(11);
      } else {
        // 到達不能
        expect.fail("should not reach here");
      }
    });

    it("narrows error when ok is false", () => {
      const r: Result<number, string> = Result.err("failed");
      if (!r.ok) {
        // TypeScript は r.error を string に絞り込む
        expect(typeof r.error).toBe("string");
        expect(r.error.length).toBeGreaterThan(0);
      } else {
        expect.fail("should not reach here");
      }
    });
  });
});
