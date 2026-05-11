import Link from "next/link";

/**
 * ルート 404 ページ。
 *
 * 設計判断:
 * - Server Component（インタラクション不要）
 * - notFound() からの遷移で表示
 * - トップへの Link のみで誘導
 */
export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 px-4 py-12 text-center">
      <h1 className="font-heading text-2xl font-medium">404 - Not Found</h1>
      <p className="text-sm text-muted-foreground">
        お探しのリポジトリは見つかりませんでした。
      </p>
      <Link
        href="/"
        className="text-sm underline focus-visible:outline focus-visible:outline-2"
      >
        トップに戻る
      </Link>
    </div>
  );
}
