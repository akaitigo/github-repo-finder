import { Suspense } from "react";
import Link from "next/link";
import { LoadingState } from "@/presentation/components/loading-state";
import { createDetailUseCase } from "@/app/_lib/container";
import { renderDetail } from "@/app/_lib/render-detail";

/**
 * リポジトリ詳細ページ。
 *
 * 設計判断:
 * - 5 行薄殻: ロジックは `_lib/render-detail.tsx` に委譲
 * - Next.js v16 の `PageProps<'/repositories/[owner]/[repo]'>` ヘルパー使用
 * - params も await（v15+ async）
 * - notFound() は render-detail 内で呼ぶ
 * - 戻るリンク 1 つで一覧画面へ
 */
export default async function RepositoryDetailPage({
  params,
}: PageProps<"/repositories/[owner]/[repo]">) {
  const { owner, repo } = await params;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
      <Link
        href="/"
        className="text-sm underline focus-visible:outline focus-visible:outline-2"
      >
        ← 検索に戻る
      </Link>
      <Suspense fallback={<LoadingState />}>
        {await renderRepositoryDetail(owner, repo)}
      </Suspense>
    </div>
  );
}

async function renderRepositoryDetail(
  owner: string,
  repo: string,
): Promise<React.ReactElement> {
  const useCase = createDetailUseCase();
  const result = await useCase.execute(owner, repo);
  return renderDetail({ result });
}
