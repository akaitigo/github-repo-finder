import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Result } from "@/domain/shared/result";
import { renderSearchResult } from "@/app/_lib/render-search-result";
import { buildRepository } from "@/../tests/helpers/factories/repository";

describe("renderSearchResult (8 kind 全分岐 UI)", () => {
  const q = "react";

  it("Ok(items あり) → RepositoryList を描画", () => {
    const result = Result.ok({
      items: [buildRepository({ id: 1, fullName: "facebook/react" })],
      totalCount: 1,
      incompleteResults: false,
    });
    render(renderSearchResult({ result, q }));
    expect(screen.getByText("facebook/react")).toBeInTheDocument();
  });

  it("Ok(items 空) → EmptyState (no-results) を描画", () => {
    const result = Result.ok({
      items: [],
      totalCount: 0,
      incompleteResults: false,
    });
    render(renderSearchResult({ result, q }));
    expect(
      screen.getByText("検索結果が見つかりませんでした"),
    ).toBeInTheDocument();
  });

  it("invalid-query{empty} → ErrorState (invalid-query-empty)", () => {
    const result = Result.err({
      kind: "invalid-query",
      reason: "empty",
    } as const);
    render(renderSearchResult({ result, q }));
    expect(
      screen.getByText("検索ワードを入力してください"),
    ).toBeInTheDocument();
  });

  it("invalid-query{too-long} → ErrorState (invalid-query-too-long)", () => {
    const result = Result.err({
      kind: "invalid-query",
      reason: "too-long",
    } as const);
    render(renderSearchResult({ result, q }));
    expect(screen.getByText("検索ワードが長すぎます")).toBeInTheDocument();
  });

  it("rate-limit → RateLimitDisplay を描画", () => {
    const result = Result.err({
      kind: "rate-limit",
      resetAt: new Date("2026-05-11T00:01:00Z"),
      resource: "search",
    } as const);
    render(renderSearchResult({ result, q }));
    expect(
      screen.getByText("GitHub API のレート制限に達しました"),
    ).toBeInTheDocument();
  });

  it("forbidden{invalid-token} → ErrorState (forbidden-invalid-token)", () => {
    const result = Result.err({
      kind: "forbidden",
      reason: "invalid-token",
    } as const);
    render(renderSearchResult({ result, q }));
    expect(screen.getByText("認証に失敗しました")).toBeInTheDocument();
  });

  it("forbidden{sso-required} → ErrorState (forbidden-sso-required)", () => {
    const result = Result.err({
      kind: "forbidden",
      reason: "sso-required",
    } as const);
    render(renderSearchResult({ result, q }));
    expect(screen.getByText("SAML SSO 認証が必要です")).toBeInTheDocument();
  });

  it("forbidden{unknown} → ErrorState (forbidden-unknown)", () => {
    const result = Result.err({
      kind: "forbidden",
      reason: "unknown",
    } as const);
    render(renderSearchResult({ result, q }));
    expect(screen.getByText("アクセスが拒否されました")).toBeInTheDocument();
  });

  it("not-found → EmptyState (no-results)", () => {
    const result = Result.err({ kind: "not-found" } as const);
    render(renderSearchResult({ result, q }));
    expect(
      screen.getByText("検索結果が見つかりませんでした"),
    ).toBeInTheDocument();
  });

  it("upstream-error{500} → ErrorState (upstream-error)", () => {
    const result = Result.err({
      kind: "upstream-error",
      status: 500,
    } as const);
    render(renderSearchResult({ result, q }));
    expect(
      screen.getByText("GitHub API のエラーが発生しました"),
    ).toBeInTheDocument();
    expect(screen.getByText(/HTTP 500/)).toBeInTheDocument();
  });

  it("malformed-response → ErrorState (malformed-response)", () => {
    const result = Result.err({ kind: "malformed-response" } as const);
    render(renderSearchResult({ result, q }));
    expect(
      screen.getByText("想定外のレスポンスが返却されました"),
    ).toBeInTheDocument();
  });

  it("schema-mismatch → ErrorState (schema-mismatch)", () => {
    const result = Result.err({ kind: "schema-mismatch" } as const);
    render(renderSearchResult({ result, q }));
    expect(
      screen.getByText("GitHub API の応答仕様が変更されました"),
    ).toBeInTheDocument();
  });

  it("network → ErrorState (network)", () => {
    const result = Result.err({
      kind: "network",
      cause: new Error("ECONNREFUSED"),
    } as const);
    render(renderSearchResult({ result, q }));
    expect(screen.getByText("通信エラーが発生しました")).toBeInTheDocument();
  });
});
