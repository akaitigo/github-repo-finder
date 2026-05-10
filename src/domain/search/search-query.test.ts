import { describe, it, expect } from "vitest";
import { SearchQuery } from "./search-query";

describe("SearchQuery.create", () => {
  describe("空入力の拒否", () => {
    it("空文字は empty で拒否", () => {
      const result = SearchQuery.create("");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe("empty");
      }
    });

    it("半角スペースのみは empty で拒否（trim 後空）", () => {
      const result = SearchQuery.create("   ");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe("empty");
      }
    });

    it("全角スペース（U+3000）のみも empty で拒否", () => {
      // String.prototype.trim() は U+3000 も対象
      const result = SearchQuery.create("　　　");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe("empty");
      }
    });

    it("タブと改行のみも empty で拒否", () => {
      const result = SearchQuery.create("\t\n\r");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe("empty");
      }
    });
  });

  describe("長さ制限", () => {
    it("257 文字は too-long で拒否", () => {
      const result = SearchQuery.create("a".repeat(257));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe("too-long");
      }
    });

    it("256 文字（境界）は受け入れる", () => {
      const input = "a".repeat(256);
      const result = SearchQuery.create(input);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.value).toBe(input);
      }
    });

    it("MAX_LENGTH 定数は 256", () => {
      expect(SearchQuery.MAX_LENGTH).toBe(256);
    });
  });

  describe("正常系", () => {
    it("シンプルなキーワード", () => {
      const result = SearchQuery.create("react");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.value).toBe("react");
      }
    });

    it("前後の空白を trim する", () => {
      const result = SearchQuery.create("  react  ");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.value).toBe("react");
      }
    });

    it("中間の空白は保持する", () => {
      const result = SearchQuery.create("react hooks");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.value).toBe("react hooks");
      }
    });

    it("特殊文字を含むキーワード（GitHub 検索構文）", () => {
      const result = SearchQuery.create("language:typescript stars:>1000");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.value).toBe("language:typescript stars:>1000");
      }
    });

    it("全角文字を含むキーワード", () => {
      const result = SearchQuery.create("リポジトリ検索");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.value).toBe("リポジトリ検索");
      }
    });

    it("`+` を含むキーワード（c++ 等）", () => {
      const result = SearchQuery.create("c++");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.value).toBe("c++");
      }
    });
  });
});
