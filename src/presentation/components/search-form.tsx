"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * 検索フォーム（Client Component）。
 *
 * 設計判断:
 * - 'use client' 必須（useState + useRouter().push）
 * - Submit 時に URL を `/?q={value}` に書き換え（URL 同期戦略、deep link 可能）
 * - encodeURIComponent で URL エンコード（`c++` → `c%2B%2B`）
 * - 空文字 / 空白のみは push しない（domain SearchQuery と整合）
 * - Server Action 不採用（ADR 0003: URL 共有可能性が本質的価値）
 * - **URL 同期**: `initialQuery`（URL `?q=...` 由来）が変わったら入力欄も追随。
 *   親（page.tsx）で `<SearchForm key={q} initialQuery={q} />` のように `key` を渡すと、
 *   q 変更時に React がコンポーネントを再マウント、useState が再初期化される。
 *   useEffect + setState は React 19 の `react-hooks/set-state-in-effect` で禁止のため、
 *   `key` による再マウントが derived state の正規パターン。
 */
export interface SearchFormProps {
  initialQuery?: string;
}

export function SearchForm({ initialQuery = "" }: SearchFormProps) {
  const [value, setValue] = useState(initialQuery);
  const router = useRouter();

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed.length === 0) return;
    router.push(`/?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      aria-label="リポジトリ検索"
      className="flex w-full gap-2"
    >
      <label htmlFor="search-query" className="sr-only">
        検索ワード
      </label>
      <Input
        id="search-query"
        name="q"
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="リポジトリ名や言語を入力（例: react language:typescript）"
        maxLength={256}
        autoComplete="off"
      />
      <Button type="submit">検索</Button>
    </form>
  );
}
