# GitHub API - /search/repositories

## 公式ドキュメント
- https://docs.github.com/en/rest/search/search

## 今回の用途
- 検索フォームから入力 → このエンドポイントで検索
- 設計プラン セクション 1-1 (infra層)、4-1 (rate limit)

## エンドポイント

```
GET https://api.github.com/search/repositories
```

## クエリパラメータ

| パラメータ | 型 | 必須 | デフォルト | 説明 |
|-----------|-----|------|---------|------|
| `q` | string | ✓ | - | 検索キーワードと修飾子 |
| `sort` | string | - | best match | `stars` / `forks` / `help-wanted-issues` / `updated` |
| `order` | string | - | desc | `desc` / `asc` |
| `per_page` | integer | - | 30 | 最大100件/ページ |
| `page` | integer | - | 1 | ページ番号 |

## `q` 構文

形式: `SEARCH_KEYWORD_1 ... SEARCH_KEYWORD_N QUALIFIER_1 ... QUALIFIER_N`

### 修飾子例
- `language:typescript` — 言語フィルタ
- `stars:>1000` — Star数で絞り込み
- `fork:true` — fork も含める
- `user:facebook` — ユーザー指定
- `org:vercel` — Organization指定
- `created:>2024-01-01` — 作成日

### 制約
- クエリ文字数: **最大 256文字**
- AND/OR/NOT 演算子: **最大5個**
- 超過すると **422 Unprocessable Entity**

## レスポンス形式

```json
{
  "total_count": 123456,
  "incomplete_results": false,
  "items": [ /* repository objects */ ]
}
```

### items[] の主要フィールド（zod スキーマ用）

```typescript
import { z } from 'zod';

const RepositoryResponseSchema = z.object({
  id: z.number(),
  node_id: z.string(),
  name: z.string(),
  full_name: z.string(), // "owner/repo"
  owner: z.object({
    login: z.string(),
    avatar_url: z.string().url(),
  }),
  description: z.string().nullable(),
  language: z.string().nullable(),
  stargazers_count: z.number(),
  watchers_count: z.number(),
  forks_count: z.number(),
  open_issues_count: z.number(),
  html_url: z.string().url(),
  updated_at: z.string().datetime(),
  created_at: z.string().datetime(),
  pushed_at: z.string().datetime().nullable(),
});

const SearchResponseSchema = z.object({
  total_count: z.number(),
  incomplete_results: z.boolean(),
  items: z.array(RepositoryResponseSchema),
});
```

### 重要なキー（Repository 表示用）

- `id` — リポジトリ一意ID（React `key` に使う）
- `full_name` — `owner/repo` 形式
- `owner.login` — オーナーアカウント名
- `owner.avatar_url` — アバター画像URL
- `description` — 説明（**null 可能**）
- `language` — 主言語（**null 可能**）
- `stargazers_count` — Star数
- `watchers_count` — Watcher数
- `forks_count` — Fork数
- `open_issues_count` — Open Issue数
- `html_url` — リポジトリURL（GitHub）
- `updated_at` — 最終更新日時（ISO 8601）

## エラーレスポンス

| Status | 条件 | 対応 |
|--------|------|------|
| **200** | 成功 | items 表示 |
| **304** | Not Modified（キャッシュ済） | キャッシュ使用 |
| **403** | Rate limit / forbidden | rate-limits.md 参照 |
| **422** | Validation failed: 256文字超 / AND/OR/NOT 5個超 / スパム判定 | `upstream-error{status:422}` で UI 表示 |
| **503** | Service unavailable | `upstream-error{status:503}` |

## cURL 例

```bash
curl -L \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  'https://api.github.com/search/repositories?q=react+language:typescript&sort=stars&order=desc&per_page=30&page=1'
```

## fetch 例（実装パターン）

```typescript
// infrastructure/github/github-repository-gateway.ts
async search(query: SearchQuery, options: SearchOptions): Promise<Result<SearchResult, GatewayError>> {
  const params = new URLSearchParams({
    q: query.value,
    per_page: String(options.perPage ?? 30),
    page: String(options.page ?? 1),
  });

  let response: Response;
  try {
    response = await fetch(`https://api.github.com/search/repositories?${params}`, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(this.token && { 'Authorization': `Bearer ${this.token}` }),
      },
      cache: 'no-store', // 検索結果は常に最新
    });
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      return Result.err({ kind: 'network', cause: e });
    }
    return Result.err({ kind: 'network', cause: e });
  }

  if (response.status === 403 || response.status === 429) {
    return parseRateLimit(response); // rate-limits.md 参照
  }
  if (!response.ok) {
    return Result.err({ kind: 'http-error', status: response.status });
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch (e) {
    return Result.err({ kind: 'malformed-response', cause: 'json-parse' });
  }

  const parsed = SearchResponseSchema.safeParse(json);
  if (!parsed.success) {
    return Result.err({ kind: 'malformed-response', cause: 'schema' });
  }

  return Result.ok({
    items: parsed.data.items.map(this.mapRepository),
    totalCount: parsed.data.total_count,
    incompleteResults: parsed.data.incomplete_results,
  });
}
```

## 関連 FAQ

| 質問 | 回答 |
|------|------|
| 「sort パラメータをデフォルトのまま使った理由は？」 | best match で十分、UI に sort切替を出さない（YAGNI） |
| 「per_page を 30 にした理由は？」 | 公式デフォルト、初回画面で十分な情報量 + Rate Limit 節約 |
| 「incomplete_results は何？」 | timeout で部分結果のみ返ったケース、UI で警告表示する選択肢 |
| 「pagination 未実装の理由は？」 | MVP スコープ削減、「次やる」に明記 |
| 「Authorization Bearer の付け方は？」 | token があれば `Bearer ${token}`、無ければ未認証 fetch |

## 実装ファイル参照
- `src/infrastructure/github/github-repository-gateway.ts`
- `src/infrastructure/github/github-api-types.ts` （zod スキーマ）
- `src/infrastructure/github/github-api-mapper.ts`
- `tests/fixtures/github-api/search-success.json`
