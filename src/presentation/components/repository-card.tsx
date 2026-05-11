import Link from "next/link";
import type { Repository } from "@/domain/repository/repository";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

/**
 * 検索結果リストの 1 アイテム表示。
 *
 * 設計判断:
 * - Server Component（'use client' なし）
 * - description / language が null でも安全に表示
 * - React の自動エスケープに任せる（`description` 内の HTML/script は安全に文字列化）
 * - 詳細ページへの内部リンクは `/repositories/{owner}/{repo}?q={q}` 形式
 *   q を伝搬することで、詳細→「検索に戻る」リンクで元クエリを復元できる
 */
export interface RepositoryCardProps {
  repository: Repository;
  q?: string;
}

export function RepositoryCard({ repository, q }: RepositoryCardProps) {
  const [owner, repo] = repository.fullName.split("/");
  const queryString =
    q !== undefined && q.length > 0 ? `?q=${encodeURIComponent(q)}` : "";
  const detailHref = `/repositories/${owner}/${repo}${queryString}`;

  return (
    <Card data-testid="repository-card">
      <CardHeader>
        <CardTitle>
          <Link
            href={detailHref}
            className="hover:underline focus-visible:underline"
          >
            {repository.fullName}
          </Link>
        </CardTitle>
        {repository.description !== null && (
          <CardDescription>{repository.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <dl className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {repository.language !== null && (
            <div className="flex items-baseline gap-1">
              <dt className="sr-only">言語</dt>
              <dd>{repository.language}</dd>
            </div>
          )}
          <div className="flex items-baseline gap-1">
            <dt>★</dt>
            <dd aria-label={`Star 数 ${repository.stargazersCount}`}>
              {repository.stargazersCount.toLocaleString()}
            </dd>
          </div>
          <div className="flex items-baseline gap-1">
            <dt>Fork</dt>
            <dd aria-label={`Fork 数 ${repository.forksCount}`}>
              {repository.forksCount.toLocaleString()}
            </dd>
          </div>
          <div className="flex items-baseline gap-1">
            <dt>Issue</dt>
            <dd aria-label={`Open Issue 数 ${repository.openIssuesCount}`}>
              {repository.openIssuesCount.toLocaleString()}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
