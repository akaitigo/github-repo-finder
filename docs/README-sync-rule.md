# README 短縮版と詳細ドキュメントの整合性ルール

README に書く 3 行サマリ・3 行表は、詳細ドキュメント (ADR / docs/issues) と整合させる。

## 同期対象

| README の記述 | 同期先 |
|------------|--------|
| 設計判断 3 行サマリ | `docs/adr/0001-layered-architecture.md` の Decision |
| 「制約と判断」表の「やったこと / 意図的にやらなかったこと」 | `docs/adr/0001-0003.md` の Alternatives Considered |
| AI 活用レポートの判断基準 | (内部メモ) |
| アーキテクチャ Mermaid 図 | `eslint.config.mjs` の依存方向ルール |
| テスト戦略 | `vitest.config.ts` の thresholds |

## 更新フロー

README の短縮版を変更する場合、以下を同時更新:
1. 該当 ADR の Decision / Alternatives セクション
2. 該当 docs/issues/0X-*.md (該当する場合)
3. 必要に応じて `eslint.config.mjs` / `vitest.config.ts`

逆も成立: ADR や設定を変更したら README の短縮版を見直す。
