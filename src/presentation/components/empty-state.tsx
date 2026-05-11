/**
 * 空状態の表示。
 *
 * 設計判断:
 * - Server Component
 * - reason で 3 種類の表示分岐:
 *   - initial: 初回アクセス（クエリ未入力）
 *   - no-results: 検索結果 0 件
 *   - invalid-query: クエリ不正（presentation で使う可能性あり）
 */
export type EmptyStateReason = "initial" | "no-results" | "invalid-query";

export interface EmptyStateProps {
  reason: EmptyStateReason;
}

const messages: Record<EmptyStateReason, { title: string; body: string }> = {
  initial: {
    title: "リポジトリを検索",
    body: "検索ワードを入力すると GitHub のリポジトリを検索できます。",
  },
  "no-results": {
    title: "検索結果が見つかりませんでした",
    body: "別のキーワードで再度お試しください。",
  },
  "invalid-query": {
    title: "検索ワードが無効です",
    body: "1 文字以上、256 文字以内で入力してください。",
  },
};

export function EmptyState({ reason }: EmptyStateProps) {
  const message = messages[reason];
  return (
    <div
      role="status"
      className="flex flex-col items-center gap-2 py-12 text-center"
    >
      <p className="font-heading text-base font-medium">{message.title}</p>
      <p className="text-sm text-muted-foreground">{message.body}</p>
    </div>
  );
}
