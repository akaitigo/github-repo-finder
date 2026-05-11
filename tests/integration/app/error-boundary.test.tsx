import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import ErrorPage from "@/app/error";

describe("ErrorPage (Error Boundary)", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("title / description を表示", () => {
    const error = Object.assign(new Error("boom"), { digest: "abc123" });
    render(<ErrorPage error={error} reset={vi.fn()} />);
    expect(
      screen.getByText("予期しないエラーが発生しました"),
    ).toBeInTheDocument();
  });

  it("再試行ボタンクリックで reset() が呼ばれる", async () => {
    const reset = vi.fn();
    const error = Object.assign(new Error("boom"), { digest: "abc123" });
    const user = userEvent.setup();
    render(<ErrorPage error={error} reset={reset} />);
    await user.click(screen.getByRole("button", { name: "再試行" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("error.digest を console.error にのみ出力（UI には出さない）", () => {
    const consoleErrorSpy = vi.spyOn(console, "error");
    const error = Object.assign(new Error("boom"), { digest: "abc123" });
    render(<ErrorPage error={error} reset={vi.fn()} />);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[ErrorBoundary]",
      "abc123",
      "boom",
    );
    expect(screen.queryByText("abc123")).not.toBeInTheDocument();
    expect(screen.queryByText("boom")).not.toBeInTheDocument();
  });

  it("role='alert' で screen reader に即時通知", () => {
    const error = Object.assign(new Error("boom"), { digest: "abc123" });
    render(<ErrorPage error={error} reset={vi.fn()} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("a11y: 違反 0", async () => {
    const error = Object.assign(new Error("boom"), { digest: "abc123" });
    const { container } = render(<ErrorPage error={error} reset={vi.fn()} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
