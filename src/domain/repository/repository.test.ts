import { describe, it, expect } from "vitest";
import type { Repository } from "./repository";

describe("Repository", () => {
  it("全フィールドを持つインスタンスを構築できる", () => {
    const repo: Repository = {
      id: 10270250,
      fullName: "facebook/react",
      owner: {
        login: "facebook",
        avatarUrl: "https://avatars.githubusercontent.com/u/69631?v=4",
      },
      description: "The library for web and native user interfaces.",
      language: "JavaScript",
      stargazersCount: 230000,
      watchersCount: 6800,
      forksCount: 47000,
      openIssuesCount: 950,
      htmlUrl: "https://github.com/facebook/react",
      updatedAt: new Date("2026-05-10T00:00:00Z"),
    };
    expect(repo.fullName).toBe("facebook/react");
    expect(repo.owner.login).toBe("facebook");
    expect(repo.stargazersCount).toBe(230000);
  });

  it("description / language は null 許容", () => {
    const repo: Repository = {
      id: 1,
      fullName: "user/empty",
      owner: { login: "user", avatarUrl: "https://example.com/a.png" },
      description: null,
      language: null,
      stargazersCount: 0,
      watchersCount: 0,
      forksCount: 0,
      openIssuesCount: 0,
      htmlUrl: "https://github.com/user/empty",
      updatedAt: new Date(),
    };
    expect(repo.description).toBeNull();
    expect(repo.language).toBeNull();
  });

  it("updatedAt は Date インスタンス", () => {
    const repo: Repository = {
      id: 1,
      fullName: "x/y",
      owner: { login: "x", avatarUrl: "z" },
      description: null,
      language: null,
      stargazersCount: 0,
      watchersCount: 0,
      forksCount: 0,
      openIssuesCount: 0,
      htmlUrl: "z",
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    };
    expect(repo.updatedAt).toBeInstanceOf(Date);
    expect(repo.updatedAt.getUTCFullYear()).toBe(2026);
  });
});
