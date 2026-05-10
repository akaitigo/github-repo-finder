/**
 * Repository: GitHub のリポジトリを表す不変ドメインモデル。
 *
 * 設計判断:
 * - 「Entity」と呼ばない（リッチドメインを目指していない、振る舞い無し）
 * - GitHub API の id (number) を識別子として使用、RepositoryId 値オブジェクトは不採用
 * - description / language は null 可能（GitHub API の実態に合わせる）
 * - updatedAt は Date オブジェクト（infrastructure mapper で ISO string → Date 変換）
 * - Readonly で不変性を型レベル担保
 */
export type Repository = Readonly<{
  /** GitHub API のリポジトリ ID（識別子） */
  id: number;
  /** "owner/repo" 形式 */
  fullName: string;
  /** リポジトリオーナー */
  owner: Readonly<{
    login: string;
    avatarUrl: string;
  }>;
  /** リポジトリ説明（GitHub API では null 可能） */
  description: string | null;
  /** 主言語（GitHub API では null 可能、空リポ等） */
  language: string | null;
  /** Star 数 */
  stargazersCount: number;
  /** Watcher 数 */
  watchersCount: number;
  /** Fork 数 */
  forksCount: number;
  /** Open Issue 数 */
  openIssuesCount: number;
  /** GitHub 上のリポジトリ URL */
  htmlUrl: string;
  /** 最終更新日時 */
  updatedAt: Date;
}>;
