import { describe, it, expect } from "vitest";
import type { SearchResult } from "./search-result";
import type { Repository } from "@/domain/repository/repository";

describe("SearchResult 型", () => {
  it("空 items でも構築可能", () => {
    const result: SearchResult = {
      items: [],
      totalCount: 0,
      incompleteResults: false,
    };
    expect(result.items).toHaveLength(0);
    expect(result.totalCount).toBe(0);
    expect(result.incompleteResults).toBe(false);
  });

  it("複数 items を持つ", () => {
    const repo: Repository = {
      id: 1,
      fullName: "facebook/react",
      owner: { login: "facebook", avatarUrl: "https://example.com/a.png" },
      description: "A library",
      language: "JavaScript",
      stargazersCount: 100,
      watchersCount: 50,
      forksCount: 30,
      openIssuesCount: 10,
      htmlUrl: "https://github.com/facebook/react",
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    };
    const result: SearchResult = {
      items: [repo],
      totalCount: 1,
      incompleteResults: false,
    };
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.fullName).toBe("facebook/react");
  });

  it("incompleteResults: true（GitHub timeout 時）", () => {
    const result: SearchResult = {
      items: [],
      totalCount: 1000,
      incompleteResults: true,
    };
    expect(result.incompleteResults).toBe(true);
  });
});
