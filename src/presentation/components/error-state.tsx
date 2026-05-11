"use client";

import Link from "next/link";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { assertNever } from "@/lib/assert-never";

/**
 * エラー表示（Client Component）。
 *
 * 設計判断:
 * - 'use client'（Link で onClick イベント、reset 等の handler を持つ場合に備える）
 * - reason discriminated union で 6 種類の表示分岐
 * - assertNever で網羅性をコンパイル時保証
 * - 「待てば直る」/「ユーザー操作要」/「不可能」を区別して誘導
 *
 * 6 reason の対応:
 * - invalid-query: SearchQuery バリデーション失敗 → クエリ修正誘導
 * - forbidden: token 関連 → token / SSO 設定誘導
 * - upstream-error: GitHub API 4xx/5xx → 後で再試行
 * - malformed-response: 想定外応答 → 後で再試行
 * - schema-mismatch: schema drift → 後で再試行（ログで検知）
 * - network: 通信失敗 → ネットワーク確認
 */
export type ErrorStateReason =
  | "invalid-query-empty"
  | "invalid-query-too-long"
  | "forbidden-invalid-token"
  | "forbidden-sso-required"
  | "forbidden-unknown"
  | "upstream-error"
  | "malformed-response"
  | "schema-mismatch"
  | "network";

export interface ErrorStateProps {
  reason: ErrorStateReason;
  q?: string;
  status?: number;
}

interface Message {
  title: string;
  body: string;
}

function getMessage(reason: ErrorStateReason, status?: number): Message {
  switch (reason) {
    case "invalid-query-empty":
      return {
        title: "検索ワードを入力してください",
        body: "1 文字以上の検索ワードが必要です。",
      };
    case "invalid-query-too-long":
      return {
        title: "検索ワードが長すぎます",
        body: "256 文字以内で入力してください。",
      };
    case "forbidden-invalid-token":
      return {
        title: "認証に失敗しました",
        body: "GitHub Personal Access Token の有効性を確認してください。",
      };
    case "forbidden-sso-required":
      return {
        title: "SAML SSO 認証が必要です",
        body: "Organization SSO の有効化を確認してください。",
      };
    case "forbidden-unknown":
      return {
        title: "アクセスが拒否されました",
        body: "リポジトリの公開状態または token 権限を確認してください。",
      };
    case "upstream-error":
      return {
        title: "GitHub API のエラーが発生しました",
        body: status
          ? `HTTP ${status} のエラーが返却されました。しばらく待ってから再試行してください。`
          : "しばらく待ってから再試行してください。",
      };
    case "malformed-response":
      return {
        title: "想定外のレスポンスが返却されました",
        body: "しばらく待ってから再試行してください。",
      };
    case "schema-mismatch":
      return {
        title: "GitHub API の応答仕様が変更されました",
        body: "管理者にご連絡ください。しばらく待ってから再試行してください。",
      };
    case "network":
      return {
        title: "通信エラーが発生しました",
        body: "ネットワーク接続を確認してから再試行してください。",
      };
    default:
      return assertNever(reason);
  }
}

export function ErrorState({ reason, q = "", status }: ErrorStateProps) {
  const message = getMessage(reason, status);
  return (
    <Alert role="alert" variant="destructive">
      <AlertTitle>{message.title}</AlertTitle>
      <AlertDescription>
        <p>{message.body}</p>
        <Link
          href={q.length > 0 ? `/?q=${encodeURIComponent(q)}` : "/"}
          className="underline focus-visible:outline focus-visible:outline-2"
        >
          ホームに戻る
        </Link>
      </AlertDescription>
    </Alert>
  );
}
