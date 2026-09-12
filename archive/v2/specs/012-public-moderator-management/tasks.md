# Tasks: 公開モデレーター管理

**Input**: Design documents from `/specs/012-public-moderator-management/`

**Prerequisites**: [plan.md](./plan.md)、[spec.md](./spec.md)、[research.md](./research.md)、[data-model.md](./data-model.md)、[UI状態契約](./contracts/ui-state-contract.md)、[quickstart.md](./quickstart.md)

**Tests**: リポジトリのTDD方針に従い、各振る舞いのテストを実装より先に追加し、失敗を確認してから実装する。

**Organization**: タスクはユーザーストーリー単位で整理する。各ストーリーは前段の共通基盤を完了後、独立して検証できる。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 前提完了後、別ファイルで並行できるタスク
- **[Story]**: タスクが属するユーザーストーリー

## Phase 1: Setup（共有準備）

**Purpose**: 012で廃止する旧UIのテストと、新しいルート・テスト配置を特定する。

- [ ] T001 現行の編集画面にあるモデレーター申請・承認・却下テストを、新ルートへ移す対象として `src/app/discussions/[naddr]/edit/__tests__/page.test.tsx` に記録する
- [ ] T002 [P] 新しい公開モデレーター画面のテストファイルを `src/app/discussions/[naddr]/moderators/__tests__/page.test.tsx` に作成する
- [ ] T003 [P] 共通タブの権限別表示とキーボード操作を更新する対象として `src/components/discussion/__tests__/DiscussionTabLayout.test.tsx` を整理する

---

## Phase 2: Foundational（全ストーリーの共通基盤）

**Purpose**: リレーの公開イベントから現在のモデレーター状態と申請中状態を一貫して導出し、一回の確定で安全に更新できる基盤を作る。

**⚠️ CRITICAL**: このフェーズが終わるまで、各画面の実装を始めない。

- [ ] T004 [P] `src/lib/discussion/__tests__/moderator-application-state.test.ts` に、申請の時刻境界（前・同時刻・後）、対象会話・申請タグの検証、申請者ごとの重複排除、モデレーター優先除外、入力順不変をテストとして記述する
- [ ] T005 [P] `src/lib/nostr/__tests__/discussion-ndk-gateway.test.ts` に、許可・直接追加・削除を一つのkind 34550へ反映し、非モデレーターの`p`タグ・会話メタデータ・本文を保持するテストを追加する
- [ ] T006 [P] `src/components/discussion/__tests__/DiscussionTabLayout.test.tsx` に、同時刻のkind 34550候補を決定的に選び、会話作成者だけに基本情報タブを表示する失敗テストを追加する
- [ ] T007 `src/types/discussion.ts` に、公開モデレーター申請と保留中の一括変更を表す共有型を追加する
- [ ] T008 `src/lib/discussion/moderator-application-state.ts` に、現在のkind 34550と公開申請イベントから申請中一覧を導出し、許可・追加・削除の次のモデレーター集合と単調増加する確定時刻を計算する純粋関数を実装する
- [ ] T009 `src/lib/nostr/discussion-ndk-gateway.ts` の一人ずつの承認・却下ドラフトを、一括のモデレーター更新ドラフトへ置き換え、モデレーターを表す`p`タグだけを更新する
- [ ] T010 `src/components/discussion/DiscussionTabLayout.tsx` の最新kind 34550選択と候補取得を、時刻・イベントIDで決定的に扱えるように更新する

**Checkpoint**: 時刻基準、モデレーター集合更新、最新会話選択のユニットテストが通り、画面は共通基盤を安全に利用できる。

---

## Phase 3: User Story 1 - 公開されたモデレーター状況を確認する (Priority: P1) 🎯 MVP

**Goal**: 誰でも、現在のモデレーターと申請中ユーザーを別々の公開一覧で確認できる。

**Independent Test**: 未ログインで公開モデレーター画面を開き、空・モデレーターのみ・申請のみ・両方ありの各状態で、ニーモニック、完全なユーザーID、申請日時・理由を確認できる。

### Tests for User Story 1

- [ ] T011 [P] [US1] `src/components/discussion/__tests__/ModeratorManagementSection.test.tsx` に、二一覧、同一人物の非重複表示、ニーモニックと完全なユーザーIDの同一カード表示、IDコピーのアクセシブルな名前を検証する失敗テストを追加する
- [ ] T012 [P] [US1] `src/app/discussions/[naddr]/moderators/__tests__/page.test.tsx` に、未ログイン利用者でも公開一覧・空状態・読み込み/失敗/再試行状態を確認できる失敗テストを追加する

### Implementation for User Story 1

- [ ] T013 [US1] `src/components/discussion/ModeratorManagementSection.tsx` に、公開二一覧、ユーザー識別カード、完全なユーザーIDのコピー、状態メッセージを実装する
- [ ] T014 [US1] `src/app/discussions/[naddr]/moderators/page.tsx` に、会話メタデータとモデレーター申請を読み取り、導出済みの公開一覧を表示する画面を実装する
- [ ] T015 [US1] `src/components/discussion/DiscussionTabLayout.tsx` に、全利用者向けの「モデレーター」タブと現在地表示を追加する

**Checkpoint**: 未ログイン利用者が公開モデレーター情報を読み取れる。基本情報編集はまだ不要。

---

## Phase 4: User Story 2 - モデレーターを申請する (Priority: P1)

**Goal**: ログイン済み一般ユーザーが公開画面から一度だけ申請でき、未ログイン利用者には同じ位置にログイン導線がある。

**Independent Test**: 一般ユーザーが申請理由を送信すると申請中状態になり、再読み込み後も重複送信できない。未ログイン、申請中、現モデレーター、会話作成者のそれぞれで操作が正しく分岐する。

### Tests for User Story 2

- [ ] T016 [US2] `src/app/discussions/[naddr]/moderators/__tests__/page.test.tsx` に、未ログインの単一ログイン導線、一般ユーザーの申請送信、申請中の重複抑止、モデレーター・会話作成者の申請非表示の失敗テストを追加する

### Implementation for User Story 2

- [ ] T017 [US2] `src/app/discussions/[naddr]/moderators/page.tsx` に、認証状態と導出済み申請状態に応じたログイン導線、申請理由入力、申請送信、自分の申請中表示を実装する
- [ ] T018 [US2] `src/lib/discussion/user-creation-flow.ts` と `src/lib/discussion/__tests__/user-creation-flow.test.ts` に、公開モデレーター画面から使う申請草案の対象会話・会話作成者・申請者・理由の契約を維持するテストを追加・更新する

**Checkpoint**: 公開一覧の文脈で、資格のある一般ユーザーだけが申請できる。

---

## Phase 5: User Story 3 - 会話作成者がモデレーターを管理する (Priority: P1)

**Goal**: 会話作成者が許可・直接追加・削除を選択し、変更を確認して一回だけ確定できる。

**Independent Test**: 会話作成者が複数の許可・削除と直接追加を選択しても確定前の公開状態は変わらず、確定後に一つの署名・公開で二一覧が更新される。非作成者には選択・確定操作がない。

### Tests for User Story 3

- [ ] T019 [US3] `src/components/discussion/__tests__/ModeratorManagementSection.test.tsx` に、許可・削除のチェックボックス、変更要約、変更なし時の確定無効化、確定中の入力無効化、チェックボックスのアクセシブルな名前の失敗テストを追加する
- [ ] T020 [US3] `src/app/discussions/[naddr]/moderators/__tests__/page.test.tsx` に、確定前の非変更、確定時の署名・公開各一回、成功時の二一覧更新、失敗時の選択保持、非作成者の操作非表示の失敗テストを追加する

### Implementation for User Story 3

- [ ] T021 [US3] `src/components/discussion/ModeratorManagementSection.tsx` に、会話作成者だけの許可・削除チェックボックス、直接追加、変更要約、一つの「変更を確定」操作、ライブリージョンを実装する
- [ ] T022 [US3] `src/app/discussions/[naddr]/moderators/page.tsx` に、保留中の変更を一括草案へ渡し、署名・公開・成功後の再読込・失敗時の選択保持を実装する
- [ ] T023 [US3] `src/app/discussions/[naddr]/edit/page.tsx` と `src/app/discussions/[naddr]/edit/__tests__/page.test.tsx` から、モデレーター入力・申請ストリーム・許可/却下処理および旧テストを削除する

**Checkpoint**: 会話作成者だけが一つの確定操作でモデレーター構成を安全に更新でき、「却下」と即時操作は存在しない。

---

## Phase 6: User Story 4 - 会話作成者だけが基本情報を管理する (Priority: P2)

**Goal**: 会話作成者だけが基本情報・掲載申請・会話削除を管理し、一般ユーザーには編集フォームを見せない。

**Independent Test**: 会話作成者には「基本情報」タブと管理画面が表示され、非作成者には表示されず、直接URLでも会話に戻る案内だけが示される。

### Tests for User Story 4

- [ ] T024 [P] [US4] `src/components/discussion/__tests__/DiscussionTabLayout.test.tsx` に、会話作成者だけの「基本情報」タブ、4/3タブ時のArrow/Home/Endフォーカス順、現在地表示の失敗テストを追加する
- [ ] T025 [P] [US4] `src/app/discussions/[naddr]/edit/__tests__/page.test.tsx` に、非作成者の直接アクセスでフォーム・危険な操作・モデレーター管理を表示せず会話へ戻る導線だけを示す失敗テストを追加する

### Implementation for User Story 4

- [ ] T026 [US4] `src/components/discussion/DiscussionTabLayout.tsx` に、会話作成者だけへ「基本情報」タブを表示し、既存タブのキーボード操作・選択状態を維持する実装を追加する
- [ ] T027 [US4] `src/app/discussions/[naddr]/edit/page.tsx` に、会話作成者以外の早期ガードと、タイトル・説明、掲載申請、会話削除だけを残す基本情報管理画面を実装する
- [ ] T028 [US4] `src/app/discussions/[naddr]/page.tsx` と `src/app/discussions/[naddr]/__tests__/page.test.tsx` の会話作成者向け入口・ロール文言を「基本情報」「会話作成者」に統一する

**Checkpoint**: 編集権限のない利用者に管理フォームが見えず、公開モデレーター画面と基本情報管理画面の目的が分離される。

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 画面幅、アクセシビリティ、回帰、仕様どおりの表示を横断的に確認する。

- [ ] T029 [P] `src/app/discussions/[naddr]/moderators/__tests__/page.streaming.test.tsx` に、リレー取得の遅延・失敗・再試行と、古い申請が確定後に復活しない回帰テストを追加する
- [ ] T030 [P] `src/app/discussions/[naddr]/edit/__tests__/page.streaming.test.tsx` に、会話作成者専用の基本情報表示とモデレーターUI非表示のストリーミング回帰テストを追加する
- [ ] T031 `src/components/discussion/ModeratorManagementSection.tsx` と `src/app/discussions/[naddr]/moderators/page.tsx` を、長いID・長い申請理由・幅320px/390px/1440pxで横方向オーバーフローがないよう調整する
- [ ] T032 `specs/012-public-moderator-management/quickstart.md` の公開一覧、時刻境界、一括確定、基本情報分離の手動確認を実施し、結果を作業記録に残す
- [ ] T033 `package.json` の定義に従い `npm run lint`、対象Jestテスト、`npm test`、`npm run build` を実行し、発生したエラーを修正する

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1**: すぐ開始できる。
- **Phase 2**: Phase 1完了後に開始し、すべてのユーザーストーリーをブロックする。
- **US1 / US2 / US3 / US4**: Phase 2完了後に開始できる。実装上は公開モデレーター画面を共有するため、US1 → US2 → US3、基本情報分離のUS4はUS1と並行可能。
- **Phase 7**: 必要なユーザーストーリーの完了後に実施する。

### User Story Dependencies

- **US1（公開一覧）**: Phase 2のみを前提とする。公開画面のMVP。
- **US2（申請）**: US1の公開画面を前提とする。
- **US3（一括管理）**: US1の公開画面とPhase 2の一括更新草案を前提とする。US2とは機能上独立だが、同じ画面ファイルを変更するため順番に統合する。
- **US4（基本情報分離）**: Phase 2のみを前提とし、US1と並行可能。

### Parallel Opportunities

- Phase 2のT004、T005、T006は別ファイルのテストとして並行可能。
- US1のT011、T012は並行可能。
- US4のT024、T025は並行可能。
- Phase 7のT029、T030は並行可能。

## Parallel Example: Foundational Phase

```text
Task: "T004 `src/lib/discussion/__tests__/moderator-application-state.test.ts` に時刻境界と重複排除の失敗テストを追加する"
Task: "T005 `src/lib/nostr/__tests__/discussion-ndk-gateway.test.ts` に一括kind 34550更新の失敗テストを追加する"
Task: "T006 `src/components/discussion/__tests__/DiscussionTabLayout.test.tsx` に権限別タブと決定的な会話選択の失敗テストを追加する"
```

## Parallel Example: User Story 4

```text
Task: "T024 `src/components/discussion/__tests__/DiscussionTabLayout.test.tsx` に会話作成者だけの基本情報タブの失敗テストを追加する"
Task: "T025 `src/app/discussions/[naddr]/edit/__tests__/page.test.tsx` に非作成者の直接アクセスガードの失敗テストを追加する"
```

## Implementation Strategy

### MVP First（US1のみ）

1. Phase 1とPhase 2を完了する。
2. US1を実装し、未ログイン利用者が公開二一覧を閲覧できることを検証する。
3. 時刻境界、重複排除、ニーモニックと完全IDの同居、幅320pxの表示を確認する。

### Incremental Delivery

1. 共通の時刻・一括更新基盤を完成させる。
2. US1で公開性を提供する。
3. US2で一般ユーザーの申請導線を加える。
4. US3で会話作成者の一括確定を加え、旧却下ロジックを除去する。
5. US4で基本情報管理を会話作成者専用に分離する。
6. 横断検証でアクセシビリティ、レスポンシブ、リレー障害時の回復を確認する。
