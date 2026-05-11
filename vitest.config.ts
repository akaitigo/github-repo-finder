import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Vitest 設定:
 * - test.projects で unit (node) / integration (jsdom) を分離
 * - coverage: 全体目標を設定、層別 thresholds は実装進行に応じて追加予定
 * - app/ 配下の page.tsx 等は coverage 対象外（5行薄殻、ロジックは _lib/render-* に抽出してテスト）
 * - shadcn 生成物 (src/components/ui/) は coverage 対象外
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        // App Router の薄殻ファイル（ロジックは _lib/render-* に抽出して個別テスト）
        "src/app/**/page.tsx",
        "src/app/**/layout.tsx",
        "src/app/**/loading.tsx",
        "src/app/**/error.tsx",
        "src/app/**/not-found.tsx",
        "src/app/**/globals.css",
        // shadcn 生成物（自分で書いたコードではない）
        "src/components/ui/**",
        // テストファイル自体
        "**/*.test.{ts,tsx}",
        // index re-export
        "**/index.ts",
        // 型定義のみのファイル
        "src/**/*.d.ts",
      ],
      // 全体目標 + per-layer 閾値（domain 90 / application 80 / infrastructure 75 / presentation 60）
      // 該当ファイル未存在の glob は vitest が自動でスキップする
      thresholds: {
        lines: 75,
        functions: 75,
        branches: 75,
        statements: 75,
        "src/domain/**/*.ts": {
          lines: 90,
          functions: 90,
          branches: 90,
          statements: 90,
        },
        "src/application/**/*.ts": {
          lines: 80,
          functions: 80,
          branches: 80,
          statements: 80,
        },
        "src/infrastructure/**/*.ts": {
          lines: 75,
          functions: 75,
          branches: 75,
          statements: 75,
        },
        "src/presentation/**/*.{ts,tsx}": {
          lines: 60,
          functions: 60,
          branches: 60,
          statements: 60,
        },
      },
    },
    // Vitest projects: unit (node) / integration (jsdom) を分離
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: [
            "src/domain/**/*.test.ts",
            "src/application/**/*.test.ts",
            "src/infrastructure/**/*.test.ts",
            "src/lib/**/*.test.ts",
          ],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: [
            "src/presentation/**/*.test.{ts,tsx}",
            "tests/integration/**/*.test.{ts,tsx}",
          ],
          environment: "jsdom",
          setupFiles: ["./vitest.setup.integration.ts"],
        },
      },
    ],
  },
});
