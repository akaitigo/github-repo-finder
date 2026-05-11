import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { RepositoryCard } from "./repository-card";
import { buildRepository } from "@/../tests/helpers/factories/repository";

describe("RepositoryCard", () => {
  it("fullName / star / fork / issue を表示", () => {
    render(
      <RepositoryCard
        repository={buildRepository({
          fullName: "vercel/next.js",
          stargazersCount: 130000,
          forksCount: 28000,
          openIssuesCount: 2700,
        })}
      />,
    );
    expect(screen.getByText("vercel/next.js")).toBeInTheDocument();
    expect(screen.getByText("130,000")).toBeInTheDocument();
    expect(screen.getByText("28,000")).toBeInTheDocument();
    expect(screen.getByText("2,700")).toBeInTheDocument();
  });

  it("language が null なら言語表示を出さない", () => {
    render(<RepositoryCard repository={buildRepository({ language: null })} />);
    // "JavaScript" のような言語表記がないことを確認
    expect(screen.queryByText("JavaScript")).not.toBeInTheDocument();
  });

  it("description が null なら説明表示を出さない", () => {
    const { container } = render(
      <RepositoryCard
        repository={buildRepository({
          description: null,
          fullName: "test/repo",
        })}
      />,
    );
    const description = container.querySelector(
      '[data-slot="card-description"]',
    );
    expect(description).toBeNull();
  });

  it("XSS: description に <script> 含む文字列が React 自動エスケープで安全表示", () => {
    const malicious = "<script>alert(1)</script>";
    const { container } = render(
      <RepositoryCard
        repository={buildRepository({ description: malicious })}
      />,
    );
    // script タグが DOM に挿入されていない（エスケープされてテキストとして表示）
    expect(container.querySelector("script")).toBeNull();
    // テキストとして表示されている
    expect(screen.getByText(malicious)).toBeInTheDocument();
  });

  it("詳細ページへの内部リンクを生成", () => {
    render(
      <RepositoryCard
        repository={buildRepository({ fullName: "facebook/react" })}
      />,
    );
    const link = screen.getByRole("link", { name: "facebook/react" });
    expect(link).toHaveAttribute("href", "/repositories/facebook/react");
  });

  it("a11y: 違反 0", async () => {
    const { container } = render(
      <RepositoryCard repository={buildRepository()} />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
