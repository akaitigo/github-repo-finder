import { LoadingState } from "@/presentation/components/loading-state";

/**
 * ルート Suspense fallback。
 *
 * 設計判断:
 * - Server Component
 * - 既存の LoadingState コンポーネントを再利用
 */
export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6">
      <LoadingState />
    </div>
  );
}
