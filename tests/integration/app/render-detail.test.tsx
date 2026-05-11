import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Result } from "@/domain/shared/result";
import { renderDetail } from "@/app/_lib/render-detail";
import { buildRepository } from "@/../tests/helpers/factories/repository";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

describe("renderDetail", () => {
  it("Ok(Repository) → RepositoryDetail を描画", () => {
    const repo = buildRepository({
      fullName: "facebook/react",
      stargazersCount: 232000,
    });
    render(renderDetail({ result: Result.ok(repo) }));
    expect(screen.getByText("facebook/react")).toBeInTheDocument();
    expect(screen.getByText("232,000")).toBeInTheDocument();
  });

  it("not-found → notFound() 呼び出し（throw）", () => {
    expect(() =>
      renderDetail({ result: Result.err({ kind: "not-found" } as const) }),
    ).toThrow("NEXT_NOT_FOUND");
  });

  it("rate-limit → RateLimitDisplay を描画", () => {
    const result = Result.err({
      kind: "rate-limit",
      resetAt: new Date("2026-05-11T00:01:00Z"),
      resource: "search",
    } as const);
    render(renderDetail({ result }));
    expect(
      screen.getByText("GitHub API のレート制限に達しました"),
    ).toBeInTheDocument();
  });

  it("forbidden{invalid-token} → ErrorState", () => {
    const result = Result.err({
      kind: "forbidden",
      reason: "invalid-token",
    } as const);
    render(renderDetail({ result }));
    expect(screen.getByText("認証に失敗しました")).toBeInTheDocument();
  });

  it("upstream-error{500} → ErrorState", () => {
    const result = Result.err({
      kind: "upstream-error",
      status: 500,
    } as const);
    render(renderDetail({ result }));
    expect(
      screen.getByText("GitHub API のエラーが発生しました"),
    ).toBeInTheDocument();
  });

  it("network → ErrorState", () => {
    const result = Result.err({
      kind: "network",
      cause: new Error("ETIMEDOUT"),
    } as const);
    render(renderDetail({ result }));
    expect(screen.getByText("通信エラーが発生しました")).toBeInTheDocument();
  });

  it("malformed-response → ErrorState", () => {
    const result = Result.err({ kind: "malformed-response" } as const);
    render(renderDetail({ result }));
    expect(
      screen.getByText("想定外のレスポンスが返却されました"),
    ).toBeInTheDocument();
  });

  it("schema-mismatch → ErrorState", () => {
    const result = Result.err({ kind: "schema-mismatch" } as const);
    render(renderDetail({ result }));
    expect(
      screen.getByText("GitHub API の応答仕様が変更されました"),
    ).toBeInTheDocument();
  });

  it("forbidden{sso-required} → ErrorState (SAML SSO 認証が必要です)", () => {
    const result = Result.err({
      kind: "forbidden",
      reason: "sso-required",
    } as const);
    render(renderDetail({ result }));
    expect(screen.getByText("SAML SSO 認証が必要です")).toBeInTheDocument();
  });

  it("forbidden{unknown} → ErrorState (アクセスが拒否されました)", () => {
    const result = Result.err({
      kind: "forbidden",
      reason: "unknown",
    } as const);
    render(renderDetail({ result }));
    expect(screen.getByText("アクセスが拒否されました")).toBeInTheDocument();
  });

  it("invalid-query{empty} → ErrorState (理論上発生しないが union 網羅)", () => {
    const result = Result.err({
      kind: "invalid-query",
      reason: "empty",
    } as const);
    render(renderDetail({ result }));
    expect(
      screen.getByText("検索ワードを入力してください"),
    ).toBeInTheDocument();
  });

  it("invalid-query{too-long} → ErrorState (理論上発生しないが union 網羅)", () => {
    const result = Result.err({
      kind: "invalid-query",
      reason: "too-long",
    } as const);
    render(renderDetail({ result }));
    expect(screen.getByText("検索ワードが長すぎます")).toBeInTheDocument();
  });
});
