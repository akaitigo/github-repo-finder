import { Result } from "../shared/result";
import type { ValidationError } from "./validation-error";

/**
 * SearchQuery: 検索クエリの値オブジェクト。
 *
 * 不変条件:
 * - 空文字（trim 後）でない
 * - 256 文字以下（GitHub Search API の制約に準拠）
 *
 * 設計判断:
 * - private constructor + static create() で「不正な値を持てない」型を実現
 * - 失敗は Result<SearchQuery, ValidationError> で型レベル表現（throw しない）
 * - String.prototype.trim() は U+3000（全角スペース）も trim 対象
 */
export class SearchQuery {
  /** GitHub Search API のクエリ文字数制限 */
  static readonly MAX_LENGTH = 256;

  private constructor(readonly value: string) {}

  static create(input: string): Result<SearchQuery, ValidationError> {
    const trimmed = input.trim();
    if (trimmed.length === 0) {
      return Result.err({ kind: "empty" });
    }
    if (trimmed.length > SearchQuery.MAX_LENGTH) {
      return Result.err({ kind: "too-long" });
    }
    return Result.ok(new SearchQuery(trimmed));
  }
}
