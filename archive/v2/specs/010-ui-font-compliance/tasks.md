# Tasks: UI 最小フォントサイズ準拠

**Input**: 設計文書は `/specs/010-ui-font-compliance/` にある。

**Prerequisites**: `plan.md`、`spec.md`、`research.md`、`data-model.md`、
`contracts/font-size-compliance.md`、`quickstart.md`、`screen-state-matrix.md`

**Tests**: 憲章および `AGENTS.md` のTDD要件により、実装前に失敗する文字サイズ監査テストを作成する。

**Organization**: タスクはユーザーストーリー単位で整理し、各ストーリーを個別に検証できるようにする。

## Phase 1: Setup（共有準備）

**Purpose**: 実装範囲と検証境界を確定する。依存パッケージの追加は不要。

- [X] T001 `specs/010-ui-font-compliance/screen-state-matrix.md` に、`src/app` の全ページ、共有レイアウト、ナビゲーション、ダイアログ、メニュー、ツールチップ、通知、空・読み込み・エラー状態を列挙し、各項目の対象外理由または確認対象を記録する。あわせて `src/app/**/*.tsx`、`src/components/**/*.tsx`、`src/app/globals.css` の静的な文字サイズ指定を棚卸しし、ルビ `rt` とPDF出力を除外した監査対象を確定する

---

## Phase 2: Foundational（全ストーリーの前提）

**Purpose**: 14px未満の通常UI用指定を再導入できない自動監査を用意する。

**⚠️ CRITICAL**: このフェーズ完了前にユーザーストーリーの実装を開始しない。

- [X] T002 `src/app/__tests__/font-size-compliance.test.ts` に、通常UIの `text-xs`、14px未満の任意サイズ指定、および14px未満のCSS `font-size` を検出し、`rt` のみを例外にする失敗テストを作成する。静的監査は早期検出用であり、算出値の合否判定とは区別する
- [X] T003 `src/app/__tests__/font-size-compliance.test.ts` で、現行の違反箇所を検出してT002のテストが実装前に失敗することを確認し、`screen-state-matrix.md` の各ルート・状態をブラウザで描画して算出 `font-size` を取得する検証手順（継承、メディアクエリ、動的クラス、`rt` の扱いを含む）を確立する

**Checkpoint**: 監査テストが違反を確実に検出し、各ストーリーで是正できる状態になっている。

---

## Phase 3: User Story 1 - 通常テキストを読み取る (Priority: P1) 🎯 MVP

**Goal**: 通常画面の案内、操作ラベル、入力補助、状態表示を 14px 以上にする。

**Independent Test**: `src/app/__tests__/font-size-compliance.test.ts` が通常UIの14px未満指定を0件として通過し、広い・狭い表示幅で通常画面を確認できる。

### Tests for User Story 1

- [X] T004 [US1] `src/app/__tests__/font-size-compliance.test.ts` に、`src/components/discussion/AuditTimeline.tsx`、`src/components/discussion/PermissionGuards.tsx`、`src/app/discussions/[naddr]/edit/page.tsx` の現行違反を対象に含めるテストを追加する

### Implementation for User Story 1

- [X] T005 [P] [US1] `src/components/discussion/AuditTimeline.tsx` の監査ログ本文・時刻にある14px未満の文字サイズ指定を14px以上へ変更する
- [X] T006 [P] [US1] `src/components/discussion/PermissionGuards.tsx` の権限表示補助テキストの既定文字サイズを14px以上へ変更する
- [X] T007 [P] [US1] `src/app/discussions/[naddr]/edit/page.tsx` のモデレーター情報にある14px未満の文字サイズ指定を14px以上へ変更する
- [X] T008 [US1] `src/app/__tests__/font-size-compliance.test.ts` を実行し、T005からT007後に通常UIの違反が0件であることを確認する

**Checkpoint**: 通常テキストのP1要件を満たし、単独で検証可能になっている。

---

## Phase 4: User Story 2 - 一時的な表示を読み取る (Priority: P2)

**Goal**: ダイアログ、メニュー、通知、空・読み込み・エラー状態のテキストを同じ下限で保つ。

**Independent Test**: 状態表示を持つコンポーネントとページを監査し、サイズ監査テストが通過する。代表的な一時的UIを表示して14px以上を確認できる。

### Tests for User Story 2

- [X] T009 [US2] `src/app/__tests__/font-size-compliance.test.ts` に、`src/components/discussion/**/*.tsx`、`src/components/features/**/*.tsx`、`src/components/ui/**/*.tsx`、`src/app/**/*.tsx` の一時的UI・状態表示（ツールチップを含む）も監査対象とするテストを追加する

### Implementation for User Story 2

- [X] T010 [US2] `src/components/discussion/**/*.tsx`、`src/components/features/**/*.tsx`、`src/components/ui/**/*.tsx`、`src/app/**/*.tsx` を監査し、ダイアログ、メニュー、ツールチップ、通知、空・読み込み・エラー状態に残る14px未満の通常UI用指定を所有ファイルで14px以上へ変更する
- [X] T011 [US2] `src/app/__tests__/font-size-compliance.test.ts` を実行し、T010後に一時的UI・状態表示の違反が0件であることを確認する

**Checkpoint**: 一時的UIと状態表示がP1の通常画面と独立して14px下限に準拠している。

---

## Phase 5: User Story 3 - ルビ付きの日本語を読む (Priority: P3)

**Goal**: ルビによる読み補助を維持しつつ、本文と通常UIには14px下限を適用する。

**Independent Test**: ルビ `rt` の補助テキストだけを例外にし、ルビ本文およびその他の通常UIが監査対象であることをテストで確認できる。

### Tests for User Story 3

- [X] T012 [US3] `src/app/__tests__/font-size-compliance.test.ts` に、`src/app/globals.css` の `rt` スタイルだけを例外とし、ルビ本文または他のCSS小サイズ指定を許容しないテストを追加する

### Implementation for User Story 3

- [X] T013 [US3] `src/app/globals.css` のルビ `rt` スタイルを維持し、通常UIに14px未満を許容する全体スタイルがないことを確認・是正する
- [X] T014 [US3] `src/app/__tests__/font-size-compliance.test.ts` を実行し、ルビ `rt` のみが例外であることを確認する

**Checkpoint**: ルビ表示を維持したまま、例外の範囲が `rt` に限定されている。

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 画面横断の回帰確認と完了検証を行う。

- [X] T015 `specs/010-ui-font-compliance/screen-state-matrix.md` に列挙した全画面・全状態を、定義した広い・狭い表示幅でブラウザ確認し、ルビ以外の各対象テキストの算出 `font-size` が14px以上である結果を台帳に記録する
- [X] T016 `package.json` の `lint` と `test` スクリプトを実行し、lintと全テストが成功することを確認する
- [X] T017 `package.json` の `build` スクリプトを実行し、プロダクションビルドが成功することを確認する

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1**: 直ちに開始できる。
- **Phase 2**: Phase 1の監査対象確定後に開始し、すべてのユーザーストーリーをブロックする。
- **Phase 3（US1）**: Phase 2完了後に開始する。MVPとする。
- **Phase 4（US2）**: Phase 2完了後に開始できるが、全体監査の重複を避けるためUS1後に実行する。
- **Phase 5（US3）**: Phase 2完了後に開始できる。`globals.css` と監査テストに触れるため、US1・US2と同時には実行しない。
- **Phase 6**: 必要なユーザーストーリーの完了後に実行する。

### User Story Dependencies

- **US1（P1）**: Phase 2にのみ依存する。通常UIの最小実用リリース。
- **US2（P2）**: Phase 2にのみ依存するが、同じ監査テストを変更するため推奨順はUS1の後。
- **US3（P3）**: Phase 2にのみ依存するが、同じ監査テストと全体スタイルを変更するため推奨順はUS2の後。

### Parallel Opportunities

- T005、T006、T007は異なるファイルを変更するため並行実行できる。
- T015はコード変更完了後、T016およびT017と並行して実行できる。ただし、完了判定はすべての結果を確認してから行う。

## Parallel Example: User Story 1

```text
Task: "T005 src/components/discussion/AuditTimeline.tsx の小サイズ指定を是正する"
Task: "T006 src/components/discussion/PermissionGuards.tsx の小サイズ指定を是正する"
Task: "T007 src/app/discussions/[naddr]/edit/page.tsx の小サイズ指定を是正する"
```

## Implementation Strategy

### MVP First（US1のみ）

1. Phase 1で監査対象を確定する。
2. Phase 2で失敗するサイズ監査テストを追加する。
3. Phase 3で既知の通常UI違反を是正する。
4. T008でUS1を単独検証する。

### Incremental Delivery

1. US1で既知の通常UI違反を解消する。
2. US2で一時的UIと状態表示を全件確認し、残る違反を解消する。
3. US3でルビ `rt` の例外が広がっていないことを保証する。
4. Phase 6で表示幅、lint、テスト、ビルドを確認する。

## Notes

- すべてのタスクは必須のチェックリスト形式、ID、該当する場合のストーリーラベル、対象パスを含む。
- T002、T004、T009、T012は実装より先に実行し、失敗を確認してから是正する。
- 各フェーズのチェックポイントで回帰を確認し、完了タスクにはチェックを付ける。
