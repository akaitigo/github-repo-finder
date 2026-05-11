import type { Repository } from "@/domain/repository/repository";
import { RepositoryCard } from "./repository-card";
import { EmptyState } from "./empty-state";

/**
 * 検索結果リスト全体の表示。
 *
 * 設計判断:
 * - Server Component
 * - items が空なら EmptyState (reason: "no-results") に切り替え
 * - role="list" / li を明示して a11y 担保（screen reader が「リスト」と認識）
 */
export interface RepositoryListProps {
  items: readonly Repository[];
  totalCount: number;
}

export function RepositoryList({ items, totalCount }: RepositoryListProps) {
  if (items.length === 0) {
    return <EmptyState reason="no-results" />;
  }

  return (
    <section
      aria-label={`検索結果 ${totalCount.toLocaleString()} 件`}
      className="flex flex-col gap-3"
    >
      <p className="text-sm text-muted-foreground">
        {totalCount.toLocaleString()} 件のリポジトリが見つかりました
      </p>
      <ul role="list" className="flex flex-col gap-3">
        {items.map((repo) => (
          <li key={repo.id}>
            <RepositoryCard repository={repo} />
          </li>
        ))}
      </ul>
    </section>
  );
}
