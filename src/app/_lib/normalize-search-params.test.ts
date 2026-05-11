import { describe, it, expect } from "vitest";
import { normalizeSearchParam } from "./normalize-search-params";

describe("normalizeSearchParam", () => {
  it("string → そのまま返す", () => {
    expect(normalizeSearchParam("react")).toBe("react");
  });

  it("undefined → undefined", () => {
    expect(normalizeSearchParam(undefined)).toBeUndefined();
  });

  it("string[] → 最後の値を返す（HTTP 慣習）", () => {
    expect(normalizeSearchParam(["a", "b", "c"])).toBe("c");
  });

  it("空配列 → undefined", () => {
    expect(normalizeSearchParam([])).toBeUndefined();
  });

  it("単一要素配列 → その要素", () => {
    expect(normalizeSearchParam(["only"])).toBe("only");
  });
});
