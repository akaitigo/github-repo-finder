# GitHub API - Error Responses

## 公式ドキュメント
- https://docs.github.com/en/rest/overview/troubleshooting-the-rest-api
- https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api

## 今回の用途
- infra層 14異常系テストの根拠
- 設計プラン セクション 1-3 (GatewayError), 1-4 (UI マッピング), 2-2 (テストケース)

## ステータスコード一覧

### 2xx 成功

| Status | 意味 | 対応 |
|--------|------|------|
| 200 OK | 成功 | items 表示 |
| 201 Created | 作成成功 | 今回未使用 |
| 204 No Content | 成功（body無し） | 今回未使用 |
| 304 Not Modified | キャッシュ済（ETag/If-Modified-Since） | キャッシュ使用 |

### 3xx リダイレクト

| Status | 意味 | 対応 |
|--------|------|------|
| 301 Moved Permanently | リソース移動 | fetch は自動 follow |
| 302 Found | 一時リダイレクト | 同上 |

### 4xx クライアントエラー

| Status | GitHub API での意味 | GatewayError マッピング |
|--------|---------------------|------------------------|
| **400 Bad Request** | リクエスト形式不正 | `http-error{status:400}` |
| **401 Unauthorized** | 認証失敗（token 無効・期限切れ） | `forbidden{reason:'invalid-token'}` |
| **403 Forbidden** | rate limit / abuse / SSO / scope不足 | **3分類**（下記） |
| **404 Not Found** | リソース不在 | `not-found` |
| **409 Conflict** | 競合（書き込み系） | 今回未使用 |
| **410 Gone** | 削除済み | `not-found` で統一可 |
| **415 Unsupported Media Type** | Content-Type不正 | `http-error{status:415}` |
| **422 Unprocessable Entity** | クエリ構文エラー（256字超 / AND/OR/NOT 5個超 / スパム判定） | `http-error{status:422}` → `upstream-error{status:422}` |
| **429 Too Many Requests** | rate limit | `rate-limited` または `secondary-rate-limited` |

### 403 の3分類（最重要、Backend特徴の核）

| ヘッダ条件 | 判定 | UX |
|-----------|------|-----|
| `x-ratelimit-remaining: 0` | **Primary rate limit** | 待つ、`x-ratelimit-reset` 表示 |
| `retry-after` あり | **Secondary rate limit** （abuse detection） | 待つ、`retry-after` 秒 |
| `x-ratelimit-remaining > 0` で 403 | **forbidden**（invalid-token / SSO / scope不足） | 待っても直らない、ユーザー操作要 |

**429 の扱い**: 公式に「rate limit でも 429 を返すことがある」と明記、403 と同じロジックで処理。

### 5xx サーバーエラー

| Status | 意味 | GatewayError マッピング |
|--------|------|------------------------|
| **500 Internal Server Error** | GitHub 側内部エラー | `http-error{status:500}` |
| **502 Bad Gateway** | Cloudflare 経由の障害多い | `http-error{status:502}` |
| **503 Service Unavailable** | サービス一時停止 | `http-error{status:503}` |
| **504 Gateway Timeout** | timeout | `http-error{status:504}` |

→ application で全て `upstream-error{status}` に集約

## エラー応答ボディ

```json
{
  "message": "API rate limit exceeded for 192.0.2.1.",
  "documentation_url": "https://docs.github.com/rest/overview/resources-in-the-rest-api#rate-limiting",
  "status": "403"
}
```

- `message`: 人間向け説明（UI には出さない、log のみ）
- `documentation_url`: 公式ドキュメントへのリンク（log）
- 422 の場合: `errors[]` にバリデーションエラー詳細

## ネットワーク・パースエラー

| 原因 | GatewayError |
|------|-------------|
| `fetch` reject（DNS / connect refused / 切断） | `network{cause}` |
| `AbortError`（timeout） | `network{cause}` |
| Content-Type 不正 / `response.json()` throw | `malformed-response{cause:'json-parse'}` |
| `zod.safeParse` 失敗（schema drift） | `malformed-response{cause:'schema'}` |

## テストケース（infra 14本）

```typescript
describe('GitHubRepositoryGateway.search', () => {
  it('200 + items → Ok(SearchResult)', ...);
  it('422 → http-error{status:422}', ...);
  it('403 + rate-limit-remaining:0 + resource:search → rate-limited{resource:search}', ...);
  it('403 + retry-after:60 → secondary-rate-limited{retryAfterSec:60}', ...);
  it('403 + remaining > 0 → forbidden{reason:unknown}', ...);
  it('429 + retry-after → secondary-rate-limited', ...);
  it('500 → http-error{status:500}', ...);
  it('502 → http-error{status:502}', ...);
  it('503 → http-error{status:503}', ...);
  it('504 → http-error{status:504}', ...);
  it('Content-Type 不正 → malformed-response{cause:json-parse}', ...);
  it('JSON.parse 失敗 → malformed-response{cause:json-parse}', ...);
  it('zod schema 失敗 → malformed-response{cause:schema}', ...);
  it('AbortError / network失敗 → network', ...);
  // null フィールド・URLエンコード も別途
  it('description: null, language: null → そのまま null 保持', ...);
  it('updated_at ISO → Date 変換', ...);
  it('SearchQuery("c++") → q=c%2B%2B', ...);
});
```

## 実装パターン

```typescript
function parseRateLimitHeaders(response: Response): GatewayError | null {
  if (response.status !== 403 && response.status !== 429) return null;

  const retryAfter = response.headers.get('retry-after');
  if (retryAfter) {
    return { kind: 'secondary-rate-limited', retryAfterSec: parseInt(retryAfter) };
  }

  const remaining = parseInt(response.headers.get('x-ratelimit-remaining') ?? '0');
  const resetUnix = response.headers.get('x-ratelimit-reset');
  const resource = response.headers.get('x-ratelimit-resource') as 'core' | 'search' | null;

  if (remaining === 0 && resetUnix) {
    return {
      kind: 'rate-limited',
      resetAt: new Date(parseInt(resetUnix) * 1000),
      resource: resource ?? 'search',
    };
  }

  return { kind: 'forbidden', reason: 'unknown' };
}
```

## 関連 FAQ

| 質問 | 回答 |
|------|------|
| 「403 を3分類した理由は？」 | UX: 「待つべき」と「ユーザー操作必要」を区別、適切な誘導表示 |
| 「422 を invalid-query にしなかった理由は？」 | invalid-query は domain ValidationError 由来のみ、API由来は upstream-error に集約（型整合） |
| 「429 を secondary-rate-limited に統一した理由は？」 | 公式が「rate limit でも 429 を返す」と明記、retry-after で判別 |
| 「5xx を全部 http-error に集約した理由は？」 | UI 側で同じ「サーバー一時障害」表示で十分、status 番号は log でデバッグ |
| 「Content-Type 不正 と JSON.parse 失敗を分けない理由は？」 | UI には同じ「予期しない応答」表示、log で原因区別 |

## 実装ファイル参照
- `src/infrastructure/github/github-repository-gateway.ts`
- `src/application/ports/gateway-error.ts`
- `src/application/use-cases/_internal/map-gateway-error.ts`
- `tests/fixtures/github-api/{rate-limit,secondary,forbidden,server-error}.json`
