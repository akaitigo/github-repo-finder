---
name: Feature
about: 新機能の実装 Issue
title: ''
labels: 'type:feat'
assignees: ''
---

> **設計意図**: 1行で「なぜこの Issue が必要か / なぜ今このタイミングか」

## 目的

この Issue で何を達成するか、なぜ必要か

## 完了条件

- [ ] チェックボックス形式の完了基準
- [ ] テストケース網羅
- [ ] CI pass

## 非スコープ

このIssueでは扱わないこと（後続Issueに委譲）

### 明示却下事項（積極的にやらない）

やらない判断とその理由

## 依存Issue

- 先行: #
- 後続: #

## 関連 reference

- `reference/...`

## ラベル

- `type:feat`, `layer:...`

## ブランチ名

`feat/N-short-name`

## 実装メモ

### 最初の1ファイル

このIssueで一番最初に書くべき1ファイル + 理由

### 設計判断

着手時の注意点

## CI 担保範囲（Issue 完了時点）

このPRが merge された時点で CI が**初めて何を機械検証**するか
