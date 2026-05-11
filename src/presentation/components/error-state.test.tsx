import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { ErrorState, type ErrorStateReason } from "./error-state";

describe("ErrorState", () => {
  const reasons: ErrorStateReason[] = [
    "invalid-query-empty",
    "invalid-query-too-long",
    "forbidden-invalid-token",
    "forbidden-sso-required",
    "forbidden-unknown",
    "upstream-error",
    "malformed-response",
    "schema-mismatch",
    "network",
  ];

  it("各 reason ごとに固有のタイトルを表示", () => {
    const titles: Record<ErrorStateReason, string> = {
      "invalid-query-empty": "検索ワードを入力してください",
      "invalid-query-too-long": "検索ワードが長すぎます",
      "forbidden-invalid-token": "認証に失敗しました",
      "forbidden-sso-required": "SAML SSO 認証が必要です",
      "forbidden-unknown": "アクセスが拒否されました",
      "upstream-error": "GitHub API のエラーが発生しました",
      "malformed-response": "想定外のレスポンスが返却されました",
      "schema-mismatch": "GitHub API の応答仕様が変更されました",
      network: "通信エラーが発生しました",
    };
    for (const reason of reasons) {
      const { unmount } = render(<ErrorState reason={reason} />);
      expect(screen.getByText(titles[reason])).toBeInTheDocument();
      unmount();
    }
  });

  it("upstream-error: status を渡すと HTTP 番号が本文に出る", () => {
    render(<ErrorState reason="upstream-error" status={500} />);
    expect(screen.getByText(/HTTP 500/)).toBeInTheDocument();
  });

  it("ホームリンク: q なし → /、q あり → /?q={q} (URLエンコード)", () => {
    const { rerender } = render(<ErrorState reason="network" />);
    expect(screen.getByRole("link", { name: "ホームに戻る" })).toHaveAttribute(
      "href",
      "/",
    );
    rerender(<ErrorState reason="network" q="c++" />);
    expect(screen.getByRole("link", { name: "ホームに戻る" })).toHaveAttribute(
      "href",
      "/?q=c%2B%2B",
    );
  });

  it("role='alert' で screen reader に即時通知", () => {
    render(<ErrorState reason="network" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("a11y: 違反 0 (全 reason)", async () => {
    for (const reason of reasons) {
      const { container, unmount } = render(<ErrorState reason={reason} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
      unmount();
    }
  });
});
