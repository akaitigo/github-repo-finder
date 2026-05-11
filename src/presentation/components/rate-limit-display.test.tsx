import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { RateLimitDisplay } from "./rate-limit-display";

describe("RateLimitDisplay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-11T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resetAt から残り時間を「N 分 N 秒」表示", () => {
    const resetAt = new Date("2026-05-11T00:01:30Z"); // 90 秒後
    render(<RateLimitDisplay resetAt={resetAt} q="react" />);
    expect(screen.getByTestId("rate-limit-countdown")).toHaveTextContent(
      "1 分 30 秒",
    );
  });

  it("resetAt が過去なら 0 分 0 秒", () => {
    const resetAt = new Date("2026-05-10T00:00:00Z"); // 過去
    render(<RateLimitDisplay resetAt={resetAt} q="react" />);
    expect(screen.getByTestId("rate-limit-countdown")).toHaveTextContent(
      "0 分 0 秒",
    );
  });

  it("Retry リンク href は /?q={q} 形式 (URLエンコード済)", () => {
    const resetAt = new Date("2026-05-11T00:01:00Z");
    render(<RateLimitDisplay resetAt={resetAt} q="c++" />);
    const link = screen.getByRole("link", { name: "もう一度検索する" });
    expect(link).toHaveAttribute("href", "/?q=c%2B%2B");
  });

  it("role='status' + aria-live='polite' で screen reader に通知", () => {
    render(
      <RateLimitDisplay resetAt={new Date("2026-05-11T00:01:00Z")} q="react" />,
    );
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
  });

  it("a11y: 違反 0", async () => {
    // axe は内部で setTimeout を使うため real timers に戻す
    vi.useRealTimers();
    const { container } = render(
      <RateLimitDisplay resetAt={new Date("2026-05-11T00:01:00Z")} q="react" />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
