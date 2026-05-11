# GitHub API - Rate Limits

## 公式ドキュメント
- https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
- https://docs.github.com/en/rest/search/search

## 今回の用途
- Search API rate limit + UX設計

## 重要事実: 複数バケットあり、Search は別

| Bucket | 未認証 | 認証済 | 単位 |
|--------|--------|--------|------|
| **core**（一般REST API） | 60 | 5,000 | req/**hour** |
| **search**（★今回使用） | **10** | **30** | req/**minute** |
| search/code（コード検索） | 認証必須 | 9 | req/**minute** |
| graphql | — | 5,000 points | per hour |
| Git LFS | 300 | 3,000 | req/min |

🔴 **「60/5000/h」は core bucket の値、Search API には不正確（混同しないこと）**

GitHub Enterprise Cloud は core 15,000/hour に拡張。

## レスポンスヘッダ（小文字注意）

| Header | 意味 |
|--------|------|
| `x-ratelimit-limit` | バケット上限 |
| `x-ratelimit-remaining` | 残り回数 |
| `x-ratelimit-used` | 既消費数 |
| `x-ratelimit-reset` | リセット時刻（Unix epoch 秒、UTC） |
| `x-ratelimit-resource` | バケット名 (`core` / `search` / `graphql` / `code_search`) |
| `retry-after` | secondary rate limit時のみ（待機秒数） |

## Primary vs Secondary Rate Limits

### Primary（時間単位の絶対数）
- 上記表の値
- 超過時: HTTP **403** または **429**
- 検知: `x-ratelimit-remaining: 0`
- 対応: `x-ratelimit-reset` まで待つ

### Secondary（短期間の過度な使用パターン防止）
| 項目 | 制限 |
|------|------|
| Concurrent requests | 100以下（REST + GraphQL共有） |
| Points per minute | REST 900点/min、GraphQL 2,000点/min |
| CPU time | 90秒CPU / 60秒リアルタイム |
| Content creation | 80/min, 500/hour |

**Point 計算**:
- GET / HEAD / OPTIONS = **1点**
- POST / PATCH / PUT / DELETE = **5点**

検知: `retry-after` ヘッダ存在
対応: `retry-after` 秒待つ

## 403 の判別ロジック

| ヘッダ条件 | 判定 | UX |
|-----------|------|-----|
| `x-ratelimit-remaining: 0` | Primary rate limit | 待つ（reset 表示） |
| `retry-after` あり | Secondary rate limit | 待つ（retry-after 秒） |
| `x-ratelimit-remaining > 0` で 403 | **forbidden**（invalid token / SSO / scope不足） | 待っても直らない、ユーザー操作が必要 |

⚠️ **公式ドキュメントには `X-GitHub-SSO` ヘッダの記載なし**。SSO判定は別途認証ドキュメント参照。実装では `x-ratelimit-remaining > 0` での 403 を `forbidden` 扱いし、reason は判別困難なら `unknown` で十分。

## 429 (Too Many Requests)

- Primary rate limit でも 403 ではなく 429 を返すことがある（公式記載）
- → 403 と 429 を**統一処理**するのが安全
- map-gateway-error で `429` も `rate-limited` kind に倒す

## UX実装パターン

```typescript
// infrastructure/github/github-repository-gateway.ts
function parseRateLimit(response: Response) {
  const remaining = parseInt(response.headers.get('x-ratelimit-remaining') ?? '0');
  const resetUnix = response.headers.get('x-ratelimit-reset');
  const resource = response.headers.get('x-ratelimit-resource') as 'core' | 'search' | 'graphql' | 'code_search' | null;
  const retryAfter = response.headers.get('retry-after');

  // 403/429 の3分類
  if (response.status === 403 || response.status === 429) {
    if (retryAfter) {
      return { kind: 'secondary-rate-limited', retryAfterSec: parseInt(retryAfter) };
    }
    if (remaining === 0 && resetUnix) {
      return { kind: 'rate-limited', resetAt: new Date(parseInt(resetUnix) * 1000), resource: resource ?? 'search' };
    }
    return { kind: 'forbidden', reason: 'unknown' };
  }
  return null;
}
```

```typescript
// presentation/components/rate-limit-display.tsx (Server Component)
export function RateLimitDisplay({ resetAt, q }: Props) {
  const seconds = Math.max(0, Math.floor((resetAt.getTime() - Date.now()) / 1000));
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return (
    <div role="status" aria-live="polite">
      <p>GitHub API のレート制限に達しました（Search API: 認証なし 10req/min、認証 30req/min）</p>
      <p>あと {min}分{sec}秒 で再試行可能</p>
      <Link href={`/?q=${encodeURIComponent(q)}`}>もう一度検索</Link>
    </div>
  );
}
```

## Rate Limit 確認エンドポイント

```bash
GET /rate_limit
```
- 全バケットの現在状態を返す
- ただし「response headers の方を優先せよ」と公式が明言

## 関連 FAQ

| 質問 | 回答 |
|------|------|
| 「Search API の rate limit は？」 | search bucket: 未認証10req/min, 認証30req/min（core 60/h, 5000/h とは別） |
| 「なぜ Search API が core と別 bucket と認識した？」 | 公式 docs `using-the-rest-api/rate-limits-for-the-rest-api` + `x-ratelimit-resource` ヘッダで識別可 |
| 「rate limit時 UX で工夫した点は？」 | 403/429 を3分類（rate-limited / secondary / forbidden）→ 「待つべきか直すべきか」を判別 |
| 「403でも待っても直らないケースは？」 | `x-ratelimit-remaining > 0` の 403 = invalid token / SSO / forbidden |
| 「429 はどう扱った？」 | 403 と統一処理、`rate-limited` kind に倒す（公式が両方返し得ると明言）|

## 実装ファイル参照
- `src/infrastructure/github/github-repository-gateway.ts`
- `src/application/ports/gateway-error.ts`
- `src/presentation/components/rate-limit-display.tsx`
