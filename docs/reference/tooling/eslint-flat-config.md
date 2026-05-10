# ESLint v9+ - Flat Config

## 公式ドキュメント
- https://eslint.org/docs/latest/use/configure/configuration-files
- バージョン: ESLint v9+

## 今回の用途
- レイヤー間の依存方向を `no-restricted-imports` で機械強制
- `dangerouslySetInnerHTML` 禁止
- plan.md セクション 1-2 (依存方向ルール)、Issue #1 (初期化)

## flat config とは

ESLint v9 で正式版の新しい設定形式。**配列をexport**する構造。
`.eslintrc.js` (旧形式) は v9 で deprecated。

```javascript
// eslint.config.mjs
import { defineConfig } from 'eslint/config';

export default defineConfig([
  { /* config object 1 */ },
  { /* config object 2 */ },
]);
```

## ファイル形式選択

| ファイル | 用途 | 備考 |
|---------|------|------|
| `eslint.config.mjs` | **推奨**（明示的 ESM） | 常に ESM 解析 |
| `eslint.config.js` | デフォルト | package.json `"type": "module"` 必要 |
| `eslint.config.cjs` | CommonJS | require() OK |
| `eslint.config.ts` | TypeScript | jiti 必要（Node v22.13 未満） |

→ Next.js v16 プロジェクトは `eslint.config.mjs` を選択

## 基本構造

```javascript
// eslint.config.mjs
import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import typescriptEslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  // グローバル除外
  globalIgnores(['.next/', 'node_modules/', 'dist/', 'coverage/']),

  // 推奨ルール
  js.configs.recommended,
  ...typescriptEslint.configs.recommended,

  // Next.js
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { '@next/next': nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
    },
  },

  // プロジェクト固有ルール（依存方向）
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parser: typescriptEslint.parser,
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['*/application/*', '*/infrastructure/*', '*/presentation/*', '*/app/*'],
            message: 'domain depends on nothing',
          },
        ],
      }],
      'no-restricted-syntax': ['error', {
        selector: 'JSXAttribute[name.name="dangerouslySetInnerHTML"]',
        message: 'dangerouslySetInnerHTML is forbidden (XSS prevention)',
      }],
    },
  },

  // domain 層
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['**/application/**', '**/infrastructure/**', '**/presentation/**', '**/app/**'],
          message: 'domain layer must not depend on other layers',
        }],
      }],
    },
  },

  // application 層
  {
    files: ['src/application/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['**/infrastructure/**', '**/presentation/**', '**/app/**'],
          message: 'application can only depend on domain + own ports',
        }],
      }],
    },
  },

  // presentation 層（domain は type-only OK）
  {
    files: ['src/presentation/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['**/infrastructure/**', '**/app/**'],
          message: 'presentation depends on application + domain types only',
        }],
      }],
    },
  },
]);
```

## `next lint` の廃止（v16）

⚠️ **Next.js v16 で `next lint` コマンドは廃止**

| 旧 | 新（v16+） |
|----|-----------|
| `pnpm next lint` | **`pnpm eslint .`** |
| `next.config.js` の `eslint: { ignoreDuringBuilds }` | （build 時 lint オプションなくなる） |

`package.json`:
```json
{
  "scripts": {
    "lint": "eslint .",
    "lint:fix": "eslint . --fix"
  }
}
```

## languageOptions

```javascript
{
  languageOptions: {
    ecmaVersion: 'latest',  // または 2024
    sourceType: 'module',    // 'script' | 'commonjs'
    parser: typescriptEslint.parser,
    parserOptions: {
      project: './tsconfig.json',  // type-aware ルール用
    },
    globals: {
      // ブラウザ globals
      ...globals.browser,
      // Node globals
      ...globals.node,
    },
  },
}
```

## カスケード方式（後勝ち）

```javascript
[
  // 全ファイル
  { files: ['**/*.ts'], rules: { 'no-unused-vars': 'warn' } },

  // src/ だけ厳しく
  { files: ['src/**/*.ts'], rules: { 'no-unused-vars': 'error' } },
]
```

→ `src/` 配下では error、それ以外は warn

## ignores

### グローバル
```javascript
import { globalIgnores } from 'eslint/config';

globalIgnores(['.next/', 'node_modules/', 'dist/', 'coverage/']);
```

### 個別
```javascript
{
  files: ['src/**/*.ts'],
  ignores: ['**/*.test.ts'],  // src 配下のテストファイルのみ除外
  rules: { /* ... */ },
}
```

## TypeScript-ESLint 統合

```bash
pnpm add -D typescript-eslint
```

```javascript
import typescriptEslint from 'typescript-eslint';

export default defineConfig([
  ...typescriptEslint.configs.recommended,
  // または strict（型情報必要）
  ...typescriptEslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: { project: './tsconfig.json' },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/strict-boolean-expressions': 'error',
    },
  },
]);
```

## Prettier との統合

`eslint-config-prettier` で format ルールを無効化:

```javascript
import prettier from 'eslint-config-prettier';

export default defineConfig([
  // 他のconfig
  prettier,  // 最後に配置（format ルール無効化）
]);
```

## 落とし穴

### 1. `.eslintrc.js` が残っている
- v9 では完全 deprecated
- 削除 + `eslint.config.mjs` に統合

### 2. `next lint` を使い続ける
- v16 で廃止
- `eslint .` 直接呼び出し

### 3. `extends` の構文変更
- 旧: `extends: ['next/core-web-vitals']`
- 新: plugin object を spread `...nextPlugin.configs.recommended.rules`

### 4. plugin 名指定
- 旧: 文字列で plugin 参照
- 新: import して object で渡す

### 5. type-aware ルールで `parserOptions.project` 必須
- `strict-boolean-expressions` 等は型情報必要

## 関連 FAQ

| 質問 | 回答 |
|------|------|
| 「flat config を選んだ理由は？」 | ESLint v9 推奨、Next.js v16 と整合、設定が cascade で見通し良い |
| 「`next lint` 廃止対応は？」 | `eslint .` 直接呼び出し、`package.json` scripts で統一 |
| 「依存方向の強制は？」 | `no-restricted-imports` の patterns で各層が import できる範囲を制限 |
| 「`eslint-plugin-boundaries` ではない理由は？」 | 標準 `no-restricted-imports` で十分、新規プラグイン依存を避けた |
| 「dangerouslySetInnerHTML はどう禁止？」 | `no-restricted-syntax` の AST セレクタで JSXAttribute を検知 |

## 実装ファイル参照
- `eslint.config.mjs`
- `package.json` (scripts: lint / lint:fix)
- `tsconfig.json` (parserOptions.project 用)
