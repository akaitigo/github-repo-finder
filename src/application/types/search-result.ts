import type { Repository } from "@/domain/repository/repository";

/**
 * SearchResult: GitHub Search API の検索結果を application 層で扱う型。
 *
 * 設計判断:
 * - GitHub API の `total_count`, `incomplete_results` を準拠
 * - items は readonly Repository[] で不変保証
 * - infrastructure 層の mapper で snake_case → camelCase 変換
 */
export type SearchResult = Readonly<{
  /** マッチしたリポジトリ一覧 */
  items: readonly Repository[];
  /** 総ヒット数（GitHub API は最大 1000 まで返す） */
  totalCount: number;
  /** GitHub API が timeout で部分結果のみ返したか */
  incompleteResults: boolean;
}>;
