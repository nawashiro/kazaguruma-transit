<!--
Sync Impact Report:
- Version Change: 1.5.0 -> 1.6.0
- Reason: ルビを除くユーザー向けテキストの最小フォントサイズを必須の
  アクセシビリティ要件として追加。
- Modified Principles:
  * Core Principles は引き続き AGENTS.md を参照。
  * 作業言語として日本語を追加。
  * アクセシビリティ方針を constitution gate に追加。
  * 今後のNostr実装方針を追加。
  * ルビを除くフォントサイズの下限を追加。
  * Reactアイコンコンポーネントの使用方針を追加。
- Added Sections:
  * 作業言語
  * アクセシビリティ方針
  * Nostr実装方針
- Removed Sections:
  * なし
- Templates Status:
  ✅ plan-template.md: Constitution Check はこのファイルを Spec Kit 用の橋渡しとして使用可能
  ✅ spec-template.md: ユーザーストーリーと要求仕様は日本語で記述する方針に整合
  ✅ tasks-template.md: タスク記述は日本語で記述する方針に整合
  ✅ .specify/templates/commands/: ディレクトリが存在せず、更新対象なし
- Follow-up TODOs: None
-->

# Kazaguruma Transit 憲章

このファイルは GitHub Spec Kit 互換のために存在する。Coding agent 向けの実務上の正本は `AGENTS.md` である。

## 権限モデル

Agent は計画または実装を始める前に `AGENTS.md` を読み、その内容に従うこと。

このファイルと `AGENTS.md` が衝突する場合は、`AGENTS.md` を優先する。

## 作業言語

このリポジトリの作業言語は日本語である。
Spec Kit の `spec.md`、`plan.md`、`tasks.md`、チェックリスト、実装メモ、レビューコメント、作業報告は原則として日本語で書く。

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

## アクセシビリティ方針

このリポジトリのウェブアクセシビリティ方針は `docs/accessibility/ウェブアクセシビリティ方針.md` を正本とする。

- 対象は、原則としてウェブページ一式全体である。
- 目標は、WCAG 2.2 の適合レベル AA に配慮することである。
- 具体的な確認観点は `docs/accessibility/WCAG 22 Checklist.md` を参照する。
- UI、ナビゲーション、フォーム、エラー表示、ステータスメッセージ、動的コンテンツを変更する Spec Kit feature では、`plan.md` と `tasks.md` にアクセシビリティ確認を含める。
- ルビの補助テキストを除き、ユーザー向けテキストの算出フォントサイズは 14px 未満にしてはならない。
- UIのアイコンは手書きのインラインSVGを避け、`@heroicons/react` や `react-icons` などのReactアイコンコンポーネントを使用しなければならない。
- アクセシビリティ方針と実装都合が衝突する場合は、方針を優先し、満たせない理由と代替策を `plan.md` または `tasks.md` に明記する。

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

## Nostr実装方針

今後のNostr実装は、高速な通信と既存機能との整合性を確保するため、原則として
`specs/009-coracle-style-sync` の仕様に従う。

- Nostrリレーをイベントデータの正本として扱う。
- ブラウザの `sessionStorage` は暫定的な既知データとリレー実績の保持に限って利用する。
- 009仕様から外れる設計を採用する場合は、性能、互換性、信頼性への影響と採用理由を
  `plan.md` または `tasks.md` に明記する。

## 開発ワークフロー

- 通常開発ブランチ: `dev`
- リリースブランチ: `master`
- 機能開発は `dev` から始める。
- 変更を完了扱いにする前に、`AGENTS.md` に記載された検証コマンドを実行する。
- Spec Kit を使う場合は、`spec.md`、`plan.md`、`tasks.md`、実装、検証の順で進める。

**Version**: 1.6.0 | **Ratified**: 2026-01-13 | **Last Amended**: 2026-07-12
