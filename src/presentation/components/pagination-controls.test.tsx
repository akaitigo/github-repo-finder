import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { PaginationControls } from "./pagination-controls";

describe("PaginationControls", () => {
  it("totalPages=1 なら何も表示しない", () => {
    const { container } = render(
      <PaginationControls q="react" currentPage={1} totalCount={10} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("totalPages=2 で現在ページ 1 → 「前へ」disabled / 「次へ」有効", () => {
    render(<PaginationControls q="react" currentPage={1} totalCount={60} />);
    const prev = screen.getByRole("button", { name: /前へ/ });
    expect(prev).toBeDisabled();
    const next = screen.getByRole("link", { name: /次のページ（2ページ目）/ });
    expect(next).toHaveAttribute("href", "/?q=react&page=2");
    expect(next).toHaveAttribute("rel", "next");
  });

  it("最終ページ → 「次へ」disabled / 「前へ」有効", () => {
    render(<PaginationControls q="react" currentPage={2} totalCount={60} />);
    const next = screen.getByRole("button", { name: /次へ/ });
    expect(next).toBeDisabled();
    const prev = screen.getByRole("link", { name: /前のページ（1ページ目）/ });
    // page=1 は省略
    expect(prev).toHaveAttribute("href", "/?q=react");
  });

  it("中間ページ → 前/次 両方有効", () => {
    render(<PaginationControls q="react" currentPage={2} totalCount={120} />);
    const prev = screen.getByRole("link", { name: /前のページ（1ページ目）/ });
    const next = screen.getByRole("link", { name: /次のページ（3ページ目）/ });
    expect(prev).toHaveAttribute("href", "/?q=react");
    expect(next).toHaveAttribute("href", "/?q=react&page=3");
  });

  it("現在ページ表示: 「2 / 4」", () => {
    render(<PaginationControls q="react" currentPage={2} totalCount={120} />);
    expect(
      screen.getByLabelText("2ページ目（全4ページ中）"),
    ).toBeInTheDocument();
    expect(screen.getByText("2 / 4")).toBeInTheDocument();
  });

  it("GitHub API 制約: 1000 件超でも最大 34 ページに clamp", () => {
    // totalCount=10000 / perPage=30 = 333 → 34 で clamp
    render(<PaginationControls q="react" currentPage={1} totalCount={10000} />);
    expect(screen.getByText("1 / 34")).toBeInTheDocument();
  });

  it("perPage カスタム指定で総ページ数が変わる", () => {
    render(
      <PaginationControls
        q="react"
        currentPage={1}
        totalCount={100}
        perPage={50}
      />,
    );
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
  });

  it("c++ のような特殊文字を URL エンコード", () => {
    render(<PaginationControls q="c++" currentPage={1} totalCount={60} />);
    const next = screen.getByRole("link", { name: /次のページ/ });
    expect(next).toHaveAttribute("href", "/?q=c%2B%2B&page=2");
  });

  it("nav 要素に aria-label", () => {
    render(<PaginationControls q="react" currentPage={1} totalCount={60} />);
    expect(
      screen.getByRole("navigation", { name: "検索結果のページネーション" }),
    ).toBeInTheDocument();
  });

  it("a11y: 違反 0", async () => {
    const { container } = render(
      <PaginationControls q="react" currentPage={2} totalCount={120} />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
