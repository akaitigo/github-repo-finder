import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * 依存方向ルール（軽量レイヤード4層 + Composition Root）:
 *
 *   [app (composition root)] → application + presentation + infrastructure + domain
 *   [presentation]           → application + domain (type-only)
 *   [application]            → domain
 *   [infrastructure]         → application/ports + domain
 *   [domain]                 → (nothing)  純粋
 *
 * ESLint で no-restricted-imports により機械強制。
 *
 * セキュリティルール:
 *   dangerouslySetInnerHTML を no-restricted-syntax で禁止（XSS 防止）
 */
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "node_modules/**",
  ]),

  // 全 src/ 共通ルール
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      // dangerouslySetInnerHTML 禁止（XSS 防止）
      "no-restricted-syntax": [
        "error",
        {
          selector: 'JSXAttribute[name.name="dangerouslySetInnerHTML"]',
          message:
            "dangerouslySetInnerHTML is forbidden (XSS prevention). React の自動エスケープを使うこと。",
        },
      ],
    },
  },

  // domain 層: 他層から完全に独立、純粋ロジックのみ
  {
    files: ["src/domain/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "**/application/**",
                "**/infrastructure/**",
                "**/presentation/**",
                "**/app/**",
              ],
              message:
                "domain は他層に依存しない（純粋ロジックのみ）",
            },
          ],
        },
      ],
    },
  },

  // application 層: domain と自身の ports のみ参照可
  {
    files: ["src/application/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "**/infrastructure/**",
                "**/presentation/**",
                "**/app/**",
              ],
              message:
                "application は domain と application/ports のみ参照可（infra/presentation/app 禁止）",
            },
          ],
        },
      ],
    },
  },

  // infrastructure 層: application/ports と domain のみ参照可
  {
    files: ["src/infrastructure/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "**/application/use-cases/**",
                "**/application/errors/**",
                "**/presentation/**",
                "**/app/**",
              ],
              message:
                "infrastructure は application/ports と domain のみ参照可",
            },
          ],
        },
      ],
    },
  },

  // presentation 層: application + domain (type-only) のみ参照可
  {
    files: ["src/presentation/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/infrastructure/**", "**/app/**"],
              message:
                "presentation は application と domain (type-only) のみ参照可",
            },
          ],
        },
      ],
    },
  },
  // 注: app/ 層は composition root として全層参照可、ルール追加なし
]);

export default eslintConfig;
