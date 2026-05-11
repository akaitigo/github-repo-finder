import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";

/**
 * 検索結果のページネーション。
 *
 * 設計判断:
 * - Server Component（'use client' なし、`<Link href>` のみで遷移）
 * - URL 同期戦略と一貫: `/?q={q}&page={n}` の deep link 共有可能性を維持
 * - GitHub Search API の制約: 最大 1000 件、per_page=30 なので最大ページ数は 34
 * - 無限スクロール不採用の理由（ADR 0003 補記）:
 *   1. URL 同期戦略と矛盾（N 件目スクロール状態を URL に乗せられない）
 *   2. rate-limit リスク（Search API 未認証 10 req/min、自動 fetch で即枯渇）
 *   3. Server Component 主体方針との一貫（無限スクロールは Client 化必須）
 *   4. a11y 違反 0 の維持（スクリーンリーダーが「リスト終わり」検知困難）
 * - a11y: `<nav aria-label="ページネーション">` + 「現在ページ」を `aria-current="page"` で明示
 */

const MAX_PAGES = 34; // GitHub Search API 制約: 最大 1000 件 / 30 per_page

export interface PaginationControlsProps {
  q: string;
  currentPage: number;
  totalCount: number;
  perPage?: number;
}

function buildHref(q: string, page: number): string {
  const params = new URLSearchParams({ q });
  if (page > 1) params.set("page", String(page));
  return `/?${params.toString()}`;
}

export function PaginationControls({
  q,
  currentPage,
  totalCount,
  perPage = 30,
}: PaginationControlsProps) {
  const totalPages = Math.min(
    MAX_PAGES,
    Math.max(1, Math.ceil(totalCount / perPage)),
  );

  // 1 ページ以下なら表示しない
  if (totalPages <= 1) return null;

  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;

  return (
    <nav
      aria-label="検索結果のページネーション"
      className="flex items-center justify-center gap-3 py-4"
    >
      {hasPrev ? (
        <Link
          href={buildHref(q, currentPage - 1)}
          aria-label={`前のページ（${currentPage - 1}ページ目）へ`}
          rel="prev"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          ◀ 前へ
        </Link>
      ) : (
        <Button variant="outline" size="sm" disabled aria-disabled="true">
          ◀ 前へ
        </Button>
      )}

      <span
        className="text-sm text-muted-foreground"
        aria-current="page"
        aria-label={`${currentPage}ページ目（全${totalPages}ページ中）`}
      >
        {currentPage} / {totalPages}
      </span>

      {hasNext ? (
        <Link
          href={buildHref(q, currentPage + 1)}
          aria-label={`次のページ（${currentPage + 1}ページ目）へ`}
          rel="next"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          次へ ▶
        </Link>
      ) : (
        <Button variant="outline" size="sm" disabled aria-disabled="true">
          次へ ▶
        </Button>
      )}
    </nav>
  );
}
