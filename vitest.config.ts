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
      // 全体目標。後続 PR で per-layer 設定を追加（domain 90/app 80/infra 75/presentation 60）
      thresholds: {
        lines: 75,
        functions: 75,
        branches: 75,
        statements: 75,
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
