<!--
Sync Impact Report:
- Version Change: 1.1.0 -> 1.2.0
- Reason: 日本語をこのリポジトリの作業言語として明文化し、憲章本文を日本語化。
- Modified Principles:
  * Core Principles は引き続き AGENTS.md を参照。
  * 作業言語として日本語を追加。
- Added Sections:
  * 作業言語
- Removed Sections:
  * なし
- Templates Status:
  ✅ plan-template.md: Constitution Check はこのファイルを Spec Kit 用の橋渡しとして使用可能
  ✅ spec-template.md: ユーザーストーリーと要求仕様は日本語で記述する方針に整合
  ✅ tasks-template.md: タスク記述は日本語で記述する方針に整合
- Follow-up TODOs: None
-->

# Kazaguruma Transit 憲章

このファイルは GitHub Spec Kit 互換のために存在する。Coding agent 向けの実務上の正本は `AGENTS.md` である。

## 権限モデル

Agent は計画または実装を始める前に `AGENTS.md` を読み、その内容に従うこと。

このファイルと `AGENTS.md` が衝突する場合は、`AGENTS.md` を優先する。

## 作業言語

このリポジトリの作業言語は日本語である。

- Spec Kit の `spec.md`、`plan.md`、`tasks.md`、チェックリスト、実装メモ、レビューコメント、作業報告は原則として日本語で書く。
- コード識別子、API 名、ファイル名、外部仕様名、ライブラリ名、エラーメッセージの技術的引用は英語のままでよい。
- ユーザー向け UI 文言は、既存のアプリケーション方針に合わせて日本語を優先する。
- 外部コントリビューターや upstream への提出など、英語が必要な文脈では英語を使ってよい。その場合でも、このリポジトリ内の作業記録は日本語で要点を残す。

## Core Principles

Core Principles は `AGENTS.md` の `## Core Principles` に置く。

1. Clear Naming
2. Simple Logic
3. Structured Organization
4. Type Safety
5. Test-First Development
6. Accessibility & UX
7. Documentation & Comments

Spec Kit の workflow は、`spec.md`、`plan.md`、`tasks.md` を作成するとき、この原則群を constitution gate として扱うこと。

## 技術スタックと制約

- **フレームワーク**: Next.js 15 (App Router), React 19
- **言語**: TypeScript 5 strict mode
- **UI**: Tailwind CSS 4 + DaisyUI 5
- **データベース**: SQLite + Prisma ORM
- **テスト**: Jest + React Testing Library
- **分散プロトコル**: Nostr (NIP-72, NIP-25)
- **パフォーマンス**: 既存アーキテクチャで測定可能な範囲では、API 応答 p95 を 200ms 以内に保つ。
- **GTFS データ**: GTFS import は build/start chain の中で実行される。
- **外部画像**: 外部 URL 画像は、Next.js `<Image>` が適さない場合に `<img>` を使ってよい。
- **ボタンスタイル**: DaisyUI cupcake の角丸が効かない場合は `rounded-full dark:rounded-sm` を使う。
- **日本語テキスト**: ルビ表示は既存の ruby text utilities/classes を使う。
- **セキュリティ**: API rate limiting を維持する。

## 開発ワークフロー

- 通常開発ブランチ: `dev`
- リリースブランチ: `master`
- 機能開発は `dev` から始める。
- 変更を完了扱いにする前に、`AGENTS.md` に記載された検証コマンドを実行する。
- Spec Kit を使う場合は、`spec.md`、`plan.md`、`tasks.md`、実装、検証の順で進める。

**Version**: 1.2.0 | **Ratified**: 2026-01-13 | **Last Amended**: 2026-07-09
