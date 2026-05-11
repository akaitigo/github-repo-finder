import { Suspense } from "react";
import { SearchForm } from "@/presentation/components/search-form";
import { LoadingState } from "@/presentation/components/loading-state";
import { EmptyState } from "@/presentation/components/empty-state";
import { createSearchUseCase } from "./_lib/container";
import { normalizeSearchParam } from "./_lib/normalize-search-params";
import { renderSearchResult } from "./_lib/render-search-result";

/**
 * トップページ（検索画面）。
 *
 * 設計判断:
 * - 5 行薄殻: ロジックは `_lib/render-search-result.tsx` に委譲
 * - Next.js v16 の `PageProps<'/'>` ヘルパー (import 不要、global) で型安全な searchParams 取得
 * - searchParams は Promise（v15+ async）、await して string|string[] を normalize
 * - q が空なら EmptyState (initial)、ある場合は UseCase 呼び出し → render
 */
export default async function Home({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const q = normalizeSearchParam(sp.q);
  const page = parsePage(normalizeSearchParam(sp.page));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6">
      {/* key で q 変更時に SearchForm を再マウントし、入力欄を URL に追随させる */}
      <SearchForm key={q ?? ""} initialQuery={q ?? ""} />
      <Suspense fallback={<LoadingState />}>
        {q === undefined || q.trim().length === 0 ? (
          <EmptyState reason="initial" />
        ) : (
          await renderSearch(q, page)
        )}
      </Suspense>
    </div>
  );
}

/**
 * URL の `?page=N` を 1 以上の整数に正規化。不正値は 1 にフォールバック。
 */
function parsePage(raw: string | undefined): number {
  if (raw === undefined) return 1;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.trunc(n);
}

async function renderSearch(
  q: string,
  page: number,
): Promise<React.ReactElement> {
  const useCase = createSearchUseCase();
  const result = await useCase.execute(q, { page });
  return renderSearchResult({ result, q, currentPage: page });
}
