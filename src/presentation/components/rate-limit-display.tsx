"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

/**
 * Rate Limit 到達時の表示。
 *
 * 設計判断:
 * - 'use client' Component（カウントダウン表示で `Date.now()` を使うため、
 *   React 19 の react-hooks/purity ルールで Server Component では不可）
 * - resetAt + クエリ q を受け取り、Retry リンク `<Link href="/?q={q}">` を生成
 * - callback 不要（URL 同期戦略と一貫、deep link 維持）
 * - aria-live="polite" でカウントダウン更新を screen reader に通知
 * - 1 秒ごとに再計算して表示更新（残り 0 秒で停止）
 */
export interface RateLimitDisplayProps {
  resetAt: Date;
  q: string;
}

function computeSeconds(resetAt: Date): number {
  return Math.max(0, Math.floor((resetAt.getTime() - Date.now()) / 1000));
}

export function RateLimitDisplay({ resetAt, q }: RateLimitDisplayProps) {
  const [seconds, setSeconds] = useState(() => computeSeconds(resetAt));

  useEffect(() => {
    if (seconds <= 0) return;
    const id = setInterval(() => {
      setSeconds(computeSeconds(resetAt));
    }, 1000);
    return () => clearInterval(id);
  }, [resetAt, seconds]);

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return (
    <Alert role="status" aria-live="polite" variant="destructive">
      <AlertTitle>GitHub API のレート制限に達しました</AlertTitle>
      <AlertDescription>
        <p>
          Search API は未認証で 10 req/min、認証で 30 req/min
          に制限されています。
        </p>
        <p data-testid="rate-limit-countdown">
          再試行可能まで残り {minutes} 分 {remainingSeconds} 秒
        </p>
        <Link
          href={`/?q=${encodeURIComponent(q)}`}
          className="underline focus-visible:outline focus-visible:outline-2"
        >
          もう一度検索する
        </Link>
      </AlertDescription>
    </Alert>
  );
}
