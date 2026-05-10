# Issue #11: README + ADR 3本 + 品質証跡スクショ（最終 文書 PR）

> **設計意図**: 主要な構成要素である README と ADR を完成させる文書 PR。読者が最初に見る順序（Vercel URL → モバイル確認 → README 冒頭 → GitHub log → ADR）を意識した情報密度設計。**設計判断**で旧 #10 を分割（文書PR）した。

## 目的
README で「制約と判断」+ 「Backend から見た Next.js」+ AI活用レポートを完成、ADR 3本で設計判断を文書化、品質証跡（スクショ7枚 + Lighthouse + axe）を整備。**冒頭3画面の情報密度を最優先する**前提で情報密度を最優先。

## 完了条件

### README（最重要構成要素）
- [ ] 構成順:
  1. タイトル + Badges (CI status / Node v22 / License: MIT)
  2. **Vercel デプロイURL**（最上部、`https://github-repo-finder-xxx.vercel.app`）
  3. **3行サマリー**: Backend エンジニア / Next.js初挑戦 / レイヤード4層
  4. PCスクショ（ヒーロー）
  5. **Requirements** (Node v22, pnpm v9, Tailwind v4)
  6. プロダクト概要（できること、3-5行）
  7. クイックスタート (短縮版1行 + 詳細版5ステップ折りたたみ)
  8. **設計判断3行サマリ**
  9. **「Backend から見た Next.js」3行表**（比喩 → 実コード参照 → ユーザー価値）
  10. **「制約と判断」表**（やったこと / 意図的にやらなかったこと(理由) / 時間があれば(1)(2)(3)）
  11. アーキテクチャ Mermaid 図（4層 + Composition Root + 依存方向）
  12. テスト戦略（カバレッジ現状値、`vitest.config.ts` projects 構成）
  13. **AI活用レポート**:
      - 冒頭に「**AI生成物の採否判断と責任は私が持つ**」1行
      - 採用/却下/修正の表
      - **却下した1件の before/after コード差分**（実コード、却下理由3軸: token漏洩 / deep link喪失 / SSR初期表示劣化）
  14. **学習過程セクション**（自走力明示 100字、「v15+ Promise化を一次情報で確認 → 設計を書き直し」）
  15. 「今後の拡張案」（**運用 / データ層 / UX** の3カテゴリに整理）:
      - 運用: Sentry / Vercel Analytics / Web Vitals / CSP強化 / 構造化ログ
      - データ層: ISR キャッシュ / 実APIスモークテスト
      - UX: Server Actions / Suspense streaming / Parallel Routes / ダークモード / PPR
  16. License (MIT) / Author / Acknowledgments
  17. サポート連絡先（誠意の証拠）
  18. **PR タイトル規約**: `feat: #N <短文>`
  19. **ブランチ命名規則**: `feat/<番号>-<短名>`

### ADR 3本（`docs/adr/`）
- [ ] `0001-layered-architecture.md`:
  - Status / Context / Decision / Consequences / **Alternatives considered** (フル DDD / Clean Architecture / Feature-based) / **Why not now** (各 Alternatives の却下理由) / **TypeScript type-only import 戦略追記**（Backend設計上の文脈、設計判断）
- [ ] `0002-result-type.md`:
  - 同様 / **3層バリデーション責務分担追記**（Form=UX / UseCase=意味 / Domain=不変条件、設計判断）
- [ ] `0003-server-component-strategy.md`:
  - 同様 / **Server Action vs URL同期** 比較含む（共有可能性が本質的価値）

### 品質証跡（`docs/screenshots/`）
- [ ] `01-top-pc.png` (PC, ヒーロー)
- [ ] `02-search-result-pc.png`
- [ ] `03-detail-pc.png`
- [ ] `04-mobile-iphone-14pm.png` (iPhone 14 Pro Max)
- [ ] `05-mobile-iphone-se.png` (iPhone SE 折返し検証)
- [ ] `06-rate-limit-landscape.png` (横向き rate-limit 表示)
- [ ] `07-axe-clean.png` (axe 違反0 結果)
- [ ] Lighthouse 1回実行 → スクショ（Performance/Accessibility/Best Practices/SEO の4スコア、目標: LCP<2.5s, INP<200ms, CLS<0.1）
- [ ] `pnpm audit --prod` clean 結果スクショ

### 整合性メタ規則
- [ ] README 短縮版（3行サマリ・3行表）と 設計プラン / ADR の対応関係を `docs/README-sync-rule.md` に1行明記（短縮版変更時はフル版同期、設計判断）

## 非スコープ
- 機能追加（全て #1-#9 で完了）
- ローカル運用メモ（`.gitignore` 対象ファイルで管理）
- E2E 実装（→ #10 で完了済）
- Vercel デプロイ作業（→ #10 で完了済、URL を README に貼るだけ）

### 明示却下事項（積極的にやらない）
- **Contributing.md / Code of Conduct**: 個人プロジェクトのため過剰、ノイズ
- **Issue / PR テンプレートの `.github/` 再配置**: Issue #1 完了条件に含めて初回 commit 時に配置済、ここでは触らない
- **i18n（多言語）**: 評価対象外、「今後の拡張案」止まり
- **decisions/ ディレクトリの ADR-0004 (AI協働証跡)**: 過剰、AI活用レポートで十分
- **CI に linkcheck action 追加**: 工数 vs 効果が見合わない、手動で 1回確認

## 依存Issue
- 先行: **#10 (Vercel URL 確定、E2E ログ取得)**
- 後続: なし（最後の PR）

## 関連 reference
- `reference/README.md`（reference 全体への索引、READMEで参照）
- 全 reference

## ラベル
- `type:docs`

## ブランチ名
`feat/11-readme-adr-screenshots`

## 実装メモ

### 最初の1ファイル
**`README.md`** の冒頭3行サマリ:
```markdown
# github-repo-finder

> Backend Engineer が Next.js v16 初挑戦で実装した GitHub リポジトリ検索アプリ。
> 軽量レイヤード4層 + Composition Root 採用、infrastructure 層 14異常系テストで Backend経験を活かした境界設計を可視化。
> **Vercel: https://github-repo-finder-xxx.vercel.app**
```
**理由**: 読者 が最初に見る冒頭で「誰が・何を・どう作ったか」を 5秒で伝える。これが README の魂。

### 設計判断
- 冒頭3画面の情報密度を重視→ 情報密度を最優先
- 「Backend から見た Next.js」3行は ADR と整合させる（コードへのファイルパス参照込み）
- AI活用レポートの「却下した1件」は **token漏洩 / deep link喪失 / SSR初期表示劣化** の3軸で却下理由を明記
- 学習過程セクションは「v15+ Promise化を一次情報（公式 RFC）で確認 → 設計を書き直し」で自走力に着地
- ADR の「Alternatives considered」「Why not now」は 50字ずつでも良い、「考えた → 選ばなかった」の証拠

## CI 担保範囲（Issue 完了時点）

このPRが merge された時点で CI が**初めて以下を機械検証**:
- 全層カバレッジ閾値が 90/80/75/60 を満たすこと（最終確認）
- build / test 全 pass
- README / ADR / docs/ の追加で typecheck / build に影響無いこと

→ **最終成果物完成**
