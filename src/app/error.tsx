"use client";

import { useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * ルート Error Boundary。
 *
 * 設計判断:
 * - 'use client' 必須（Next.js 仕様: error.tsx は Client Component）
 * - reset() で React Tree を再レンダリング（Next.js が提供する標準 API）
 * - error.digest は console.error にのみ出力（UI には出さない、情報漏洩防止）
 * - role='alert' で screen reader に即時通知
 */
export interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error("[ErrorBoundary]", error.digest, error.message);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
      <Alert role="alert" variant="destructive">
        <AlertTitle>予期しないエラーが発生しました</AlertTitle>
        <AlertDescription>
          <p>申し訳ございません。しばらく待ってから再試行してください。</p>
          <Button type="button" onClick={() => reset()} className="mt-2">
            再試行
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}
