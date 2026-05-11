import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("initial → 「リポジトリを検索」表示", () => {
    render(<EmptyState reason="initial" />);
    expect(screen.getByText("リポジトリを検索")).toBeInTheDocument();
  });

  it("no-results → 「検索結果が見つかりませんでした」表示", () => {
    render(<EmptyState reason="no-results" />);
    expect(
      screen.getByText("検索結果が見つかりませんでした"),
    ).toBeInTheDocument();
  });

  it("invalid-query → 「検索ワードが無効です」表示", () => {
    render(<EmptyState reason="invalid-query" />);
    expect(screen.getByText("検索ワードが無効です")).toBeInTheDocument();
  });

  it("role='status' で screen reader に通知", () => {
    render(<EmptyState reason="initial" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("a11y: 違反 0 (initial / no-results / invalid-query)", async () => {
    for (const reason of ["initial", "no-results", "invalid-query"] as const) {
      const { container, unmount } = render(<EmptyState reason={reason} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
      unmount();
    }
  });
});
