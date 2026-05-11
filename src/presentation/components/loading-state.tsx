import { Skeleton } from "@/components/ui/skeleton";

/**
 * Suspense fallback として使うローディング表示。
 *
 * 設計判断:
 * - Server Component
 * - role="status" + aria-live="polite" で screen reader に「読み込み中」を通知
 * - Skeleton x 3 で「複数のカードがロード中」を視覚化
 * - prefers-reduced-motion 対応は Skeleton 側 (animate-pulse) が motion-safe を考慮
 */
export function LoadingState() {
  return (
    <div role="status" aria-live="polite" aria-label="検索中">
      <span className="sr-only">読み込み中…</span>
      <ul className="flex flex-col gap-3">
        {[1, 2, 3].map((i) => (
          <li key={i}>
            <Skeleton className="h-24 w-full" />
          </li>
        ))}
      </ul>
    </div>
  );
}
