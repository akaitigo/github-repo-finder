import { Suspense } from "react";
import Link from "next/link";
import { LoadingState } from "@/presentation/components/loading-state";
import { createDetailUseCase } from "@/app/_lib/container";
import { renderDetail } from "@/app/_lib/render-detail";
import { normalizeSearchParam } from "@/app/_lib/normalize-search-params";

/**
 * リポジトリ詳細ページ。
 *
 * 設計判断:
 * - 5 行薄殻: ロジックは `_lib/render-detail.tsx` に委譲
 * - Next.js v16 の `PageProps<'/repositories/[owner]/[repo]'>` ヘルパー使用
 * - params も await（v15+ async）
 * - notFound() は render-detail 内で呼ぶ
 * - **URL 同期**: searchParams.q を引き継いで「検索に戻る」「Retry」リンクで元クエリ復元
 */
export default async function RepositoryDetailPage({
  params,
  searchParams,
}: PageProps<"/repositories/[owner]/[repo]">) {
  const [{ owner, repo }, sp] = await Promise.all([params, searchParams]);
  const q = normalizeSearchParam(sp.q) ?? "";
  const backHref = q.length > 0 ? `/?q=${encodeURIComponent(q)}` : "/";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
      <Link
        href={backHref}
        className="text-sm underline focus-visible:outline focus-visible:outline-2"
      >
        ← 検索に戻る
      </Link>
      <Suspense fallback={<LoadingState />}>
        {await renderRepositoryDetail(owner, repo, q)}
      </Suspense>
    </div>
  );
}

async function renderRepositoryDetail(
  owner: string,
  repo: string,
  fallbackQ: string,
): Promise<React.ReactElement> {
  const useCase = createDetailUseCase();
  const result = await useCase.execute(owner, repo);
  return renderDetail({ result, fallbackQ });
}
