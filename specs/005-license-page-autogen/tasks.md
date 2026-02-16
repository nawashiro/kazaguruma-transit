# Tasks: ライセンス情報自動生成

**Input**: Design documents from `/specs/005-license-page-autogen/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: 本機能は仕様・planでTDDが明示されているため、各ユーザーストーリーでテストタスクを含める。

**Organization**: タスクはユーザーストーリー単位で独立実装・独立検証できるように構成する。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並列実行可能（別ファイル、依存なし）
- **[Story]**: ユーザーストーリー対応ラベル（US1, US2, US3）
- すべてのタスク記述に対象ファイルパスを含める

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 実装前の共通準備

- [X] T001 Create license module directories for implementation in `src/lib/license/` and `src/lib/license/__tests__/`
- [X] T002 Create open-data source file scaffold in `src/lib/license/openDataLicenses.json`
- [X] T003 [P] Create license domain type scaffold in `src/types/license.ts`
- [X] T004 [P] Create API test target directory for license endpoint in `src/app/api/__tests__/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 全ユーザーストーリーの前提となる共通基盤

**⚠️ CRITICAL**: このフェーズ完了前にユーザーストーリー実装へ進まない

- [X] T005 [P] Add contract test for `GET /api/licenses` response shape in `src/app/api/__tests__/licenses.route.contract.test.ts`
- [X] T006 [P] Add unit tests for required project metadata parsing in `src/lib/license/__tests__/projectMetadata.required.test.ts`
- [X] T007 [P] Add unit tests for open-data JSON loader baseline behavior in `src/lib/license/__tests__/openDataLicenses.loader.test.ts`
- [X] T008 Implement shared license domain types from data-model in `src/types/license.ts`
- [X] T009 Implement project metadata parser with required-field validation in `src/lib/license/projectMetadata.ts`
- [X] T010 Implement open-data JSON loader entrypoint in `src/lib/license/openDataLicenses.ts`
- [X] T011 Implement dependency license loader entrypoint in `src/lib/license/dependencyLicenses.ts`
- [X] T012 Implement payload aggregator service for API and page consumption in `src/lib/license/licensePayload.ts`
- [X] T013 Implement baseline `GET /api/licenses` route wiring in `src/app/api/licenses/route.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - 情報源別に3セクション表示する (Priority: P1) 🎯 MVP

**Goal**: 閲覧者が本ソフトウェア・オープンデータ・導入パッケージを区別して確認できる

**Independent Test**: ライセンスページ表示時に3セクションが分離され、各項目名とライセンス情報の対応が読める

### Tests for User Story 1

- [X] T014 [P] [US1] Add page rendering test for three section headings in `src/app/license/__tests__/page.sections.test.tsx`
- [X] T015 [P] [US1] Add API integration test for section-wise payload mapping in `src/app/api/__tests__/licenses.sections.integration.test.ts`

### Implementation for User Story 1

- [X] T016 [US1] Refactor license page to consume aggregated API payload in `src/app/license/page.tsx`
- [X] T017 [US1] Implement DaisyUI-first section layouts (Card/List/Divider/Badge) in `src/app/license/page.tsx`
- [X] T018 [US1] Add accessibility labels and safe external-link attributes in `src/app/license/page.tsx`
- [X] T019 [US1] Implement required-field fallback display handling in `src/lib/license/licensePayload.ts`

**Checkpoint**: User Story 1 is independently functional and testable

---

## Phase 4: User Story 2 - package.json情報を自動反映する (Priority: P2)

**Goal**: 本ソフトウェア情報を手編集なしで更新反映し、`repository` と `funding` を条件表示する

**Independent Test**: package.jsonの更新後、名前/バージョン/ライセンス/権利者が反映され、`repository`/`funding` は値がある場合のみ表示される

### Tests for User Story 2

- [X] T020 [P] [US2] Add unit tests for author/repository/funding normalization in `src/lib/license/__tests__/projectMetadata.optionalFields.test.ts`
- [X] T021 [P] [US2] Add page test for conditional repository/funding rendering in `src/app/license/__tests__/page.software-metadata.test.tsx`

### Implementation for User Story 2

- [X] T022 [US2] Implement optional metadata normalization rules for package.json variants in `src/lib/license/projectMetadata.ts`
- [X] T023 [US2] Extend software payload mapping for repository/funding fields in `src/lib/license/licensePayload.ts`
- [X] T024 [US2] Render repository/funding as conditional DaisyUI list items in `src/app/license/page.tsx`

**Checkpoint**: User Stories 1 and 2 both work independently

---

## Phase 5: User Story 3 - オープンデータJSON管理と導入パッケージ自動収集 (Priority: P3)

**Goal**: オープンデータ情報をJSONへ移行し、依存パッケージライセンスをデフォルト設定で自動反映する

**Independent Test**: open-data JSONの変更と依存パッケージ更新がページ本文の手編集なしで反映される

### Tests for User Story 3

- [X] T025 [P] [US3] Add unit tests for open-data schema validation and duplicate detection in `src/lib/license/__tests__/openDataLicenses.validation.test.ts`
- [X] T026 [P] [US3] Add integration tests for dependency license ingestion defaults in `src/lib/license/__tests__/dependencyLicenses.integration.test.ts`
- [X] T027 [P] [US3] Add API integration test for combined openData/dependencies payload in `src/app/api/__tests__/licenses.combined.integration.test.ts`

### Implementation for User Story 3

- [X] T028 [US3] Migrate hardcoded open-data entries into managed JSON source in `src/lib/license/openDataLicenses.json`
- [X] T029 [US3] Implement open-data normalization and id uniqueness checks in `src/lib/license/openDataLicenses.ts`
- [X] T030 [US3] Implement webpack-license-plugin output reader using default scope behavior in `src/lib/license/dependencyLicenses.ts`
- [X] T031 [US3] Configure webpack-license-plugin output generation in `next.config.ts`
- [X] T032 [US3] Implement unknown-license fallback mapping for dependencies in `src/lib/license/licensePayload.ts`

**Checkpoint**: All user stories are independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 複数ストーリー横断の最終調整

- [X] T033 [P] Update license feature operation notes and maintenance flow in `docs/license-page.md`
- [X] T034 [P] Add regression rendering test for three-section stability in `src/app/license/__tests__/page.regression.test.tsx`
- [X] T035 Align API contract and implementation fields in `specs/005-license-page-autogen/contracts/license-api.openapi.yaml`
- [X] T036 Run full verification checklist and record results in `specs/005-license-page-autogen/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 依存なし
- **Phase 2 (Foundational)**: Phase 1完了後に開始、全USをブロック
- **Phase 3-5 (User Stories)**: Phase 2完了後に開始可能
- **Phase 6 (Polish)**: すべての対象US完了後

### User Story Dependencies

- **US1 (P1)**: Phase 2完了後に単独着手可能（MVP）
- **US2 (P2)**: Phase 2完了後に着手可能、US1と並行可能
- **US3 (P3)**: Phase 2完了後に着手可能、US1/US2と並行可能

### Within Each User Story

- テストタスクを先に作成し、失敗を確認してから実装へ進む
- データ変換ロジックを先に実装し、API/UIを後から接続する
- ストーリー単位で完了判定して次へ進む

### Dependency Graph (Story Order)

- Foundation → US1 (MVP)
- Foundation → US2
- Foundation → US3
- US1, US2, US3 → Polish

### Parallel Opportunities

- Setup: T003, T004
- Foundational: T005, T006, T007
- US1: T014, T015
- US2: T020, T021
- US3: T025, T026, T027
- Polish: T033, T034

---

## Parallel Example: User Story 1

```bash
Task: "T014 [US1] Add page rendering test for three section headings in src/app/license/__tests__/page.sections.test.tsx"
Task: "T015 [US1] Add API integration test for section-wise payload mapping in src/app/api/__tests__/licenses.sections.integration.test.ts"
```

## Parallel Example: User Story 2

```bash
Task: "T020 [US2] Add unit tests for author/repository/funding normalization in src/lib/license/__tests__/projectMetadata.optionalFields.test.ts"
Task: "T021 [US2] Add page test for conditional repository/funding rendering in src/app/license/__tests__/page.software-metadata.test.tsx"
```

## Parallel Example: User Story 3

```bash
Task: "T025 [US3] Add unit tests for open-data schema validation and duplicate detection in src/lib/license/__tests__/openDataLicenses.validation.test.ts"
Task: "T026 [US3] Add integration tests for dependency license ingestion defaults in src/lib/license/__tests__/dependencyLicenses.integration.test.ts"
Task: "T027 [US3] Add API integration test for combined openData/dependencies payload in src/app/api/__tests__/licenses.combined.integration.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 Setup を完了
2. Phase 2 Foundation を完了
3. Phase 3 US1 を完了
4. US1の独立テストを実施してMVP判定

### Incremental Delivery

1. Setup + Foundation で共通基盤を安定化
2. US1 を完成・検証して先行価値提供
3. US2 を追加して本ソフトウェア情報の自動反映を強化
4. US3 を追加してデータ移行と依存ライセンス自動化を完成
5. Polish で契約整合と回帰確認

### Parallel Team Strategy

1. 1名が Foundation を主導
2. Foundation完了後に担当分割
- 開発者A: US1
- 開発者B: US2
- 開発者C: US3
3. 最後に全員で Phase 6 を実施

---

## Notes

- 本計画は DaisyUI優先（独自UI部品最小化）の方針を前提とする
- すべてのストーリーは単独で実装・検証・デモ可能な粒度に分割済み
