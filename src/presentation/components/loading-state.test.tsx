import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { LoadingState } from "./loading-state";

describe("LoadingState", () => {
  it("role='status' + aria-live='polite' で読み込みを通知", () => {
    render(<LoadingState />);
    const status = screen.getByRole("status");
    expect(status).toBeInTheDocument();
    expect(status).toHaveAttribute("aria-live", "polite");
  });

  it("Skeleton を 3 つ表示", () => {
    const { container } = render(<LoadingState />);
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons).toHaveLength(3);
  });

  it("a11y: 違反 0", async () => {
    const { container } = render(<LoadingState />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
