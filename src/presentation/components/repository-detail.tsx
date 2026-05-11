import Image from "next/image";
import type { Repository } from "@/domain/repository/repository";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

/**
 * リポジトリ詳細ページの本文表示。
 *
 * 設計判断:
 * - Server Component
 * - star / watcher / fork / issue の 4 count を全て表示（要件）
 * - owner avatar を `next/image` で最適化表示
 * - description / language が null でも安全に表示
 * - 外部リンク（GitHub URL）は新規タブ + rel="noopener noreferrer"
 */
export interface RepositoryDetailProps {
  repository: Repository;
}

export function RepositoryDetail({ repository }: RepositoryDetailProps) {
  return (
    <article aria-labelledby="repository-detail-title">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Image
              src={repository.owner.avatarUrl}
              alt={`${repository.owner.login} のアバター画像`}
              width={48}
              height={48}
              className="rounded-full"
            />
            <div>
              <h1
                id="repository-detail-title"
                className="font-heading text-lg leading-tight font-medium"
              >
                {repository.fullName}
              </h1>
              {repository.language !== null && (
                <p className="text-sm text-muted-foreground">
                  {repository.language}
                </p>
              )}
            </div>
          </div>
          {repository.description !== null && (
            <p className="mt-3 text-sm">{repository.description}</p>
          )}
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Stat label="Star" value={repository.stargazersCount} />
            <Stat label="Watcher" value={repository.watchersCount} />
            <Stat label="Fork" value={repository.forksCount} />
            <Stat label="Open Issue" value={repository.openIssuesCount} />
          </dl>
          <p className="mt-4">
            <a
              href={repository.htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm underline focus-visible:outline focus-visible:outline-2"
            >
              GitHub で開く
            </a>
          </p>
        </CardContent>
      </Card>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-base font-medium">{value.toLocaleString()}</dd>
    </div>
  );
}
