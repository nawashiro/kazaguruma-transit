# Implementation Plan: アクセシビリティ違反の修正

**Branch**: `[015-accessibility-violation-fix]` | **Date**: 2026-07-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/015-accessibility-violation-fix/spec.md`

## Summary

共通レイアウト、共通UI、設定、場所検索、会話作成・編集・管理画面に残る WCAG 2.2 AA およびリポジトリ憲章上のアクセシビリティ違反を修正する。手書きインライン SVG を既存のアイコンコンポーネントへ置き換え、ARIA の誤記・関連付け・状態通知を正し、ラベル、キーボード操作、フォーカス、44px 操作領域、コントラスト、200% 拡大とリフローを検証する。既存の画面遷移、認証、会話・場所データ、永続化は変更しない。

## Technical Context

**Language/Version**: TypeScript 5 strict、React 19、Next.js 15 App Router

**Primary Dependencies**: Tailwind CSS 4、DaisyUI 5、`@heroicons/react`、`react-icons`、Jest、React Testing Library、Puppeteer

**Storage**: N/A（新規永続化なし。既存の状態・データ取得を維持）

**Testing**: Jest + React Testing Library、既存のアクセシビリティ契約テスト、Puppeteerを用いた画面幅・キーボード・コントラスト確認、`npm run lint`、`npm run build`

**Target Platform**: 対応ブラウザのデスクトップおよびモバイル表示、キーボード・画面読み上げ利用環境

**Project Type**: Next.js Web application

**Performance Goals**: アクセシビリティ修正による既存の画面応答・読み込み体験の劣化を発生させない。既存方針の API p95 200ms 以内を維持する。

**Constraints**: WCAG 2.2 AA、憲章の全ページ対象方針、AGENTS.md の TDD・44px タッチターゲット・日本語エラーメッセージ・DaisyUI 規約、手書きインライン SVG 禁止、既存データ処理の維持。対象基準の確認時は憲章に記載された `docs/accessibility/Understanding/` 本文を参照する。

**Scale/Scope**: 共有レイアウト、ナビゲーション、モーダル、入力、タブ、ボタン、状態表示、および設定・場所検索・会話関連画面。新規ページ、API、データモデルは追加しない。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **作業言語**: PASS — 本計画と設計成果物は日本語で作成する。
- **TDD / Test-First Development**: PASS — 先に対象コンポーネントのアクセシビリティ契約テストを追加・更新し、その後に実装を変更する。
- **Structured Organization**: PASS — UI修正は `src/components` と `src/app` に限定し、データ層・API層へアクセシビリティ目的の直接アクセスを追加しない。
- **Type Safety**: PASS — 既存の TypeScript strict 設定を維持し、ARIA 状態の型とコンポーネント props を明示する。
- **Accessibility & UX**: PASS — WCAG 2.2 AA の該当本文を参照し、1.1.1、1.3.1、1.4.1、1.4.3、1.4.4、1.4.10、1.4.11、2.1.1、2.1.2、2.4.x、2.5.2、2.5.3、2.5.8、3.1.1、3.2.x、3.3.x、4.1.2、4.1.3 を設計・検証対象にする。対象外基準は、該当コンテンツがないことを確認して記録する。
- **UI規約**: PASS — アイコンは既存の `@heroicons/react` または `react-icons` を使い、ボタンは `rounded-full dark:rounded-sm` と `ruby-text` の配置規約を守る。
- **Documentation & Comments**: PASS — WCAG本文の参照先と判断理由を `research.md`、UI契約、`quickstart.md` に残す。
- **No persistence change**: PASS — 新規保存や既存SQLite・Nostrデータ形式の変更を行わない。

## Project Structure

### Documentation (this feature)

```text
specs/015-accessibility-violation-fix/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/requirements.md
└── contracts/accessibility-ui-contract.md
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── locations/page.tsx
│   ├── settings/page.tsx
│   └── discussions/
│       ├── create/page.tsx
│       ├── manage/page.tsx
│       └── [naddr]/edit/page.tsx
├── components/
│   ├── layouts/SidebarLayout.tsx
│   ├── discussion/
│   │   ├── LoginModal.tsx
│   │   ├── DiscussionTabLayout.tsx
│   │   ├── DiscussionManagementTabLayout.tsx
│   │   └── EvaluationComponent.tsx
│   ├── features/
│   │   ├── LocationSuggestions.tsx
│   │   ├── LocationDetailModal.tsx
│   │   └── OriginSelector.tsx
│   └── ui/
│       ├── Button.tsx
│       ├── CategoryTabs.tsx
│       ├── InputField.tsx
│       ├── NpubDisplay.tsx
│       └── ThemeToggle.tsx
└── app/**/__tests__ and components/**/__tests__
```

**Structure Decision**: 既存の Next.js App Router のページ単位と共通UI単位を維持する。再利用可能なアクセシビリティ規約は共通コンポーネントに集約し、画面固有のラベル・状態・タブ関連付けは各ページまたは feature component に残す。

## Phase 0: Research Decisions

詳細は [research.md](./research.md) に記録する。

- 既存の `@heroicons/react` / `react-icons` を利用し、新しいアイコン依存を追加しない。
- ページ遷移を行うUIはリンクナビゲーションとして扱い、同一ページ内で表示パネルを切り替えるUIだけを完全なタブとして扱う。
- 44px 操作領域は共通 `Button` の既存保証を基準にし、例外となる閉じる・削除・タブ・モーダル操作を個別に是正する。
- 動的な結果・読み込み・エラーは、フォーカスを奪わない状態メッセージとして適切な role / live region を使い、同じ内容の二重通知を避ける。
- コントラストとリフローは静的なクラス検索だけで合格にせず、テーマ・文字サイズ・画面幅を含む実表示で確認する。

## Phase 1: Design Outputs

- [data-model.md](./data-model.md): 永続データ変更なしを明示し、UIアクセシビリティ状態と遷移を定義する。
- [contracts/accessibility-ui-contract.md](./contracts/accessibility-ui-contract.md): コントロール、フォーム、タブ、状態メッセージ、アイコン、レイアウトの受け入れ契約を定義する。
- [quickstart.md](./quickstart.md): テスト、lint、build、キーボード、読み上げ、200%拡大、リフロー、コントラストの検証手順を定義する。

## Constitution Check — Post Design

- **WCAG本文参照**: PASS — 対象達成基準の本文と意図を `research.md` および `quickstart.md` に記録する。
- **アクセシビリティ確認の計画・タスク記載**: PASS — 本計画の技術制約・検証方針と、後続の `tasks.md` に確認タスクを含める。
- **TDD**: PASS — UI契約テストを実装変更より先に追加する順序を維持する。
- **既存機能・永続化の保護**: PASS — UI層のみを変更し、既存の認証・データ取得・画面遷移の契約テストを回帰確認する。
- **未解決事項**: なし。技術選択・検証手段・対象範囲は既存構成と憲章から決定した。

## Complexity Tracking

憲章違反の例外は設けない。追加の複雑性は発生させず、既存の共通UIとテスト構成を利用する。
