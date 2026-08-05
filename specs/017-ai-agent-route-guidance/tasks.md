# Tasks: AIエージェント向け経路案内

**Input**: Design documents from `/specs/017-ai-agent-route-guidance/`

**Prerequisites**: [plan.md](./plan.md)、[spec.md](./spec.md)、[research.md](./research.md)、[data-model.md](./data-model.md)、[UI契約](./contracts/ai-agent-guidance-ui.md)、[quickstart.md](./quickstart.md)

**Tests**: AGENTS.md の TDD 方針に従い、各ユーザーストーリーの振る舞いテストを実装より先に追加する。

**Organization**: タスクはユーザーストーリーごとに整理する。いずれも同一の静的カードを段階的に完成させるため、同じファイルを同時に変更する並列タスクはない。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 異なるファイルで依存関係がない場合のみ付ける。
- **[Story]**: 対応するユーザーストーリーを示す。
- すべての実装タスクは正確なファイルパスを含む。

## Phase 1: Setup

**Purpose**: 既存のトップページとページテストをそのまま利用する。依存パッケージ、設定、データモデル、APIの追加は不要であるため、このフェーズに実行タスクはない。

---

## Phase 2: Foundational

**Purpose**: 全ストーリーに共通の基盤変更は不要である。カードは既存の `Card`、DaisyUI 5、ブラウザ標準の `details`／`summary` のみで実現する。

**Checkpoint**: 既存構成のままユーザーストーリー実装を開始できる。

---

## Phase 3: User Story 1 - AIエージェント向け案内を確認する (Priority: P1) 🎯 MVP

**Goal**: 非公式サービス案内の直後に、初期状態で閉じ、操作で開閉できる「AIエージェントのかたへ」カードを提供する。

**Independent Test**: トップページを表示し、非公式サービス案内カードの直後にある見出しを操作して、`details` が初期状態で閉じ、クリックまたはキーボード標準操作で開閉することを確認する。

### Tests for User Story 1 ⚠️

> 実装前に追加し、実装前に失敗することを確認する。

- [ ] T001 [US1] 非公式サービス案内の直後の配置、見出し、初期状態が閉じていること、標準操作による開閉を検証する失敗テストを `src/app/__tests__/page.test.tsx` に追加する

### Implementation for User Story 1

- [ ] T002 [US1] 既存の非公式サービス案内 `Card` の直後に、`details`／`summary` と DaisyUI の Collapse クラスを用いた「AIエージェントのかたへ」カードの開閉骨格を `src/app/page.tsx` に実装する

**Checkpoint**: 見出しは非公式サービス案内の直後に表示され、初期状態で折りたたまれ、マウス・タッチ・キーボードの標準操作で開閉できる。

---

## Phase 4: User Story 2 - 必要情報を基に検索リンクを案内する (Priority: P2)

**Goal**: 開いたカードで、聞き取り、座標調査、検索結果リンク返却の3段階をAIエージェントに正確に示す。

**Independent Test**: カードを開き、出発地・目的地・到着または出発時刻・速さ優先と歩行許容の聞き取り、座標不明時のウェブ検索、指定URLテンプレートの全てを確認する。

### Tests for User Story 2 ⚠️

> T002 の後、案内文を追加する前に実行し、必要な文言が不足して失敗することを確認する。

- [ ] T003 [US2] 開いた案内カードに4つの聞き取り項目、座標調査の条件と行動、完全な検索結果URLテンプレートがあることを検証する失敗テストを `src/app/__tests__/page.test.tsx` に追加する

### Implementation for User Story 2

- [ ] T004 [US2] 3段階のAIエージェント向け指示と指定された検索結果URLテンプレートを `src/app/page.tsx` の折りたたみ内容へ追加し、長いURLを狭い画面で折り返せるようにする

**Checkpoint**: カードを開くと、AIエージェントが必要な情報を聞き取り、座標を調べ、完全な検索結果リンクを返すための指示を一つのまとまりとして読める。

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: 機能全体の自動・手動検証とアクセシビリティ確認を行う。

- [ ] T005 `src/app/__tests__/page.test.tsx` を含むテスト、`npm run lint`、全テスト、`npm run build` を [quickstart.md](./quickstart.md) の手順どおりに実行し、失敗を修正する
- [ ] T006 [quickstart.md](./quickstart.md) に従い、375px・1280px幅でのリフロー、Tab と Enter/Space による開閉、可視フォーカス、支援技術に伝わる開閉状態を手動検証する

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1**: 実行タスクなし。既存構成を利用する。
- **Phase 2**: 実行タスクなし。新規の基盤依存はない。
- **User Story 1 (Phase 3)**: すぐに開始できる。T001 → T002 の順に実行する。
- **User Story 2 (Phase 4)**: 開閉骨格を利用するため User Story 1 の後に実行する。T003 → T004 の順に実行する。
- **Polish (Phase 5)**: T004 完了後に T005 と T006 を実行する。

### User Story Dependencies

- **US1 (P1)**: 依存なし。開閉可能な案内カードというMVPを提供する。
- **US2 (P2)**: US1 の開閉可能なカードを利用する。新しいデータ層やAPIには依存しない。

### Within Each User Story

- 対応するテストを先に追加し、失敗を確認する。
- 同じページとテストファイルを変更するため、実装タスクは記載順に逐次実行する。
- 実装後、ストーリーの独立テストを通す。

### Parallel Opportunities

この機能は `src/app/page.tsx` と `src/app/__tests__/page.test.tsx` の2ファイルへ順序どおりに変更する小規模な機能である。安全に並列実行できるタスクはない。

## Implementation Strategy

### MVP First (User Story 1 Only)

1. T001 で配置・初期の閉じた状態・開閉操作を失敗テストとして追加する。
2. T002 でネイティブの開閉要素とDaisyUI Collapseを実装する。
3. User Story 1 の独立テストを実行する。

### Incremental Delivery

1. User Story 1 で見出しと安全な開閉動作を完成させる。
2. User Story 2 でAIエージェント向けの指示とURLテンプレートを追加する。
3. Phase 5 でWCAG 2.2 AAの該当項目と全品質ゲートを確認する。

## Notes

- 新規コンポーネント、型、サービス、API、DB、URL生成ロジックは追加・変更しない。
- `details`／`summary` を使い、独自のARIA属性やクライアント状態は導入しない。
- 既存の `Card` と `.collapse-title:focus-visible` を保ち、URLテンプレートを省略・短縮しない。
