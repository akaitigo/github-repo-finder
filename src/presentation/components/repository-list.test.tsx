import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { RepositoryList } from "./repository-list";
import { buildRepository } from "@/../tests/helpers/factories/repository";

describe("RepositoryList", () => {
  it("items を全件表示し、件数を出す", () => {
    const items = [
      buildRepository({ id: 1, fullName: "facebook/react" }),
      buildRepository({ id: 2, fullName: "vercel/next.js" }),
    ];
    render(<RepositoryList items={items} totalCount={2} />);
    expect(screen.getByText(/2 件のリポジトリ/)).toBeInTheDocument();
    expect(screen.getByText("facebook/react")).toBeInTheDocument();
    expect(screen.getByText("vercel/next.js")).toBeInTheDocument();
  });

  it("0 件なら EmptyState を表示", () => {
    render(<RepositoryList items={[]} totalCount={0} />);
    expect(
      screen.getByText("検索結果が見つかりませんでした"),
    ).toBeInTheDocument();
  });

  it("ul role='list' で a11y 担保", () => {
    const items = [buildRepository({ id: 1 })];
    render(<RepositoryList items={items} totalCount={1} />);
    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("XSS: item の description に <script> を含めても React 自動エスケープ", () => {
    const malicious = '<script>alert("xss")</script>';
    const items = [
      buildRepository({ id: 1, description: malicious, fullName: "evil/repo" }),
    ];
    const { container } = render(
      <RepositoryList items={items} totalCount={1} />,
    );
    expect(container.querySelector("script")).toBeNull();
    expect(screen.getByText(malicious)).toBeInTheDocument();
  });

  it("a11y: 違反 0", async () => {
    const items = [
      buildRepository({ id: 1, fullName: "a/b" }),
      buildRepository({ id: 2, fullName: "c/d" }),
    ];
    const { container } = render(
      <RepositoryList items={items} totalCount={2} />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
