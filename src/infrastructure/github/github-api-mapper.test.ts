import { describe, it, expect } from "vitest";
import { toRepository } from "./github-api-mapper";
import type { RepositoryResponse } from "./github-api-types";

const baseResponse: RepositoryResponse = {
  id: 10270250,
  full_name: "facebook/react",
  owner: {
    login: "facebook",
    avatar_url: "https://avatars.githubusercontent.com/u/69631?v=4",
  },
  description: "The library for web and native user interfaces.",
  language: "JavaScript",
  stargazers_count: 232000,
  watchers_count: 6700,
  forks_count: 47500,
  open_issues_count: 870,
  html_url: "https://github.com/facebook/react",
  updated_at: "2026-05-10T12:34:56Z",
};

describe("toRepository (mapper)", () => {
  it("snake_case を camelCase に変換", () => {
    const repo = toRepository(baseResponse);
    expect(repo.fullName).toBe("facebook/react");
    expect(repo.owner.avatarUrl).toBe(
      "https://avatars.githubusercontent.com/u/69631?v=4",
    );
    expect(repo.stargazersCount).toBe(232000);
    expect(repo.watchersCount).toBe(6700);
    expect(repo.forksCount).toBe(47500);
    expect(repo.openIssuesCount).toBe(870);
    expect(repo.htmlUrl).toBe("https://github.com/facebook/react");
  });

  it("updated_at の ISO 文字列を Date に変換", () => {
    const repo = toRepository(baseResponse);
    expect(repo.updatedAt).toBeInstanceOf(Date);
    expect(repo.updatedAt.toISOString()).toBe("2026-05-10T12:34:56.000Z");
  });

  it("description: null をそのまま保持", () => {
    const repo = toRepository({ ...baseResponse, description: null });
    expect(repo.description).toBeNull();
  });

  it("language: null をそのまま保持（空リポ等）", () => {
    const repo = toRepository({ ...baseResponse, language: null });
    expect(repo.language).toBeNull();
  });

  it("description / language の両方が null でも変換可能", () => {
    const repo = toRepository({
      ...baseResponse,
      description: null,
      language: null,
    });
    expect(repo.description).toBeNull();
    expect(repo.language).toBeNull();
  });

  it("id を識別子として保持", () => {
    const repo = toRepository(baseResponse);
    expect(repo.id).toBe(10270250);
  });
});
