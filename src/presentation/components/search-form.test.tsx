import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { SearchForm } from "./search-form";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

describe("SearchForm", () => {
  beforeEach(() => {
    pushMock.mockClear();
  });

  it("入力 + Submit → router.push('/?q=react')", async () => {
    const user = userEvent.setup();
    render(<SearchForm />);
    await user.type(screen.getByRole("searchbox"), "react");
    await user.click(screen.getByRole("button", { name: "検索" }));
    expect(pushMock).toHaveBeenCalledWith("/?q=react");
  });

  it("c++ 入力 → router.push('/?q=c%2B%2B') (URL エンコード)", async () => {
    const user = userEvent.setup();
    render(<SearchForm />);
    await user.type(screen.getByRole("searchbox"), "c++");
    await user.click(screen.getByRole("button", { name: "検索" }));
    expect(pushMock).toHaveBeenCalledWith("/?q=c%2B%2B");
  });

  it("空文字 submit → push 呼ばれない", async () => {
    const user = userEvent.setup();
    render(<SearchForm />);
    await user.click(screen.getByRole("button", { name: "検索" }));
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("空白のみ submit → push 呼ばれない", async () => {
    const user = userEvent.setup();
    render(<SearchForm />);
    await user.type(screen.getByRole("searchbox"), "   ");
    await user.click(screen.getByRole("button", { name: "検索" }));
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("初期値が initialQuery で渡される", () => {
    render(<SearchForm initialQuery="react language:typescript" />);
    expect(screen.getByRole("searchbox")).toHaveValue(
      "react language:typescript",
    );
  });

  it("role='search' + aria-label で a11y 担保", () => {
    render(<SearchForm />);
    expect(screen.getByRole("search")).toHaveAttribute(
      "aria-label",
      "リポジトリ検索",
    );
  });

  it("a11y: 違反 0", async () => {
    const { container } = render(<SearchForm initialQuery="react" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
