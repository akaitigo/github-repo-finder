import { describe, it, expect } from "vitest";
import { assertNever } from "./assert-never";

describe("assertNever", () => {
  it("throws when called with any value", () => {
    expect(() => assertNever({} as never)).toThrow();
  });

  it("error message contains the value (JSON)", () => {
    try {
      assertNever({ kind: "unknown" } as never);
      throw new Error("should have thrown");
    } catch (error) {
      expect((error as Error).message).toContain("unknown");
      expect((error as Error).message).toContain("assertNever");
    }
  });

  it("returns never type (compile-time check)", () => {
    // 型レベルチェック: assertNever の戻り値は never なので、
    // switch の default で呼ぶと残りの case が unreachable と推論される
    type Kind = "a" | "b";
    const f = (k: Kind): number => {
      switch (k) {
        case "a":
          return 1;
        case "b":
          return 2;
        default:
          // ここで assertNever を呼ぶことで、Kind に新しい case を追加した時に
          // コンパイルエラーになる（exhaustive check）
          return assertNever(k);
      }
    };
    expect(f("a")).toBe(1);
    expect(f("b")).toBe(2);
  });
});
