---

description: "Task list for location data pages and JavaScript reduction"
---

# Tasks: 場所データページのJavaScript削減

**Input**: Design documents from `/specs/023-location-data-pages/`

**Prerequisites**: `plan.md`、`spec.md`、`research.md`、`data-model.md`、`contracts/location-pages.md`、`quickstart.md`

**Tests**: AGENTS.mdのTDD方針に従い、すべての公開契約テストを本番実装より先にREDで作成し、直後にfresh test-code reviewを行う。

**Review boundary**: 本番コードの最終レビューは親エージェントが実際の差分・ハッシュ・検証結果を確認する。リポジトリ憲章に従い、tasks.mdには独立した本番コードレビューtaskを追加しない。

## Phase 1: Setup (Shared Documentation)

**Purpose**: 作業境界と削除対象を固定する

- [X] T001 Record baseline branch, HEAD, status, and allowed documentation paths in `specs/023-location-data-pages/deletion-ledger.md` without modifying source or tests
- [X] T002 Build the initial obsolete-logic ledger in `specs/023-location-data-pages/deletion-ledger.md`, classifying old detail route, client CDN loaders, address/geocode search, location state, category tabs, and area fallback as delete/move/retain/out-of-scope candidates

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: URL parsing、データ境界、状態分類を先に固定する。全User Storyをブロックする。

### Origin and route-boundary RED

- [X] T003 Add RED tests for `origin` parsing/serialization, latitude-longitude order, valid out-of-area coordinates, invalid strings/NaN, absent origin, and category-link propagation in `src/lib/location/__tests__/location-origin-query.test.ts`
- [X] T004 Perform the fresh read-only test-code review for the complete `origin` RED suite in `src/lib/location/__tests__/location-origin-query.test.ts`; report `SUBAGENT_STATUS: COMPLETE` and explicit `VERDICT: PASS` before implementation
- [X] T004A [correction] Add the missing RED contract for the explicit `町字で並べる` reset path: valid/invalid `origin` must be removed only by the reset link, in `src/lib/location/__tests__/location-origin-query.test.ts`; rerun RED before a fresh review
- [X] T005 Implement the pure origin parser/serializer and validity model in `src/lib/location/location-origin-query.ts`, preserving invalid-origin display behavior without adding persistent storage

### Server data and failure-boundary RED

- [X] T006 Add RED tests for status-preserving key-location/popular-location data loads, JSON/HTTP failures, malformed required fields, duplicate IDs, empty categories, and server-side area grouping in `src/lib/location/__tests__/location-page-data.test.ts` and `src/utils/__tests__/addressLoader.test.ts`
- [X] T007 Perform the fresh read-only test-code review for the complete server data-boundary RED suite in `src/lib/location/__tests__/location-page-data.test.ts` and `src/utils/__tests__/addressLoader.test.ts`; report `SUBAGENT_STATUS: COMPLETE` and explicit `VERDICT: PASS`
- [X] T007A [correction] Strengthen the server data-boundary RED suite with non-empty `loadLocationPageData` success preservation, explicit `error: Error` assertions for key-location failures, and versioned CDN endpoint assertions for both loaders in `src/lib/location/__tests__/location-page-data.test.ts` and `src/utils/__tests__/addressLoader.test.ts`; rerun RED before a fresh review
- [X] T008 Implement the shared server data boundary in `src/lib/location/location-page-data.ts` and `src/utils/addressLoader.ts`, including status-preserving popular-location data, key-location validation, duplicate detection, and server-safe GeoJSON loading
- [X] T009 Reuse or extract pure area grouping and distance helpers in `src/lib/location/location-list-state.ts` and `src/utils/clientGeoUtils.ts` without deleting production consumers in the foundational phase; keep deterministic input-order tie-breaking and record later deletion candidates in `deletion-ledger.md`

**Checkpoint**: Origin parsing, server data/error states, duplicate detection, and pure grouping/distance helpers are independently tested and GREEN.

---

## Phase 3: User Story 1 - カテゴリを固有URLで開く (Priority: P1) 🎯 MVP

**Goal**: `/locations`を先頭カテゴリへ解決し、カテゴリを通常URLとして直接開けるようにする。

**Independent Test**: `/locations`が先頭カテゴリURLへ解決すること、カテゴリリンク・直接アクセス・再読み込み・未知カテゴリの通常404・データエラー分離を確認する。

### RED tests for User Story 1

- [X] T010 [P] [US1] Add RED tests for `/locations` first-category resolution, zero-category data error, and standard 404 behavior in `src/app/locations/__tests__/page.test.tsx`
- [X] T011 [P] [US1] Add RED tests for valid/unknown/empty/malformed category IDs, category content, and data-load failure in `src/app/locations/[category-id]/__tests__/page.test.tsx`
- [X] T012 [P] [US1] Add RED tests for shared category navigation links, `aria-current`, encoded category IDs, and valid `origin` preservation in `src/components/features/__tests__/LocationCategoryNavigation.test.tsx`
- [X] T013 Perform the fresh read-only test-code review for all User Story 1 RED tests in `src/app/locations/__tests__/page.test.tsx`, `src/app/locations/[category-id]/__tests__/page.test.tsx`, and `src/components/features/__tests__/LocationCategoryNavigation.test.tsx`; report `SUBAGENT_STATUS: COMPLETE` and explicit `VERDICT: PASS` before implementation
- [X] T013A [correction] Harden the US1 RED suite after the first review: use a named missing-public-page RED helper, remove category-page mocks/assertions tied to internal `groupLocationsByArea`/`loadGeoJSON` exports, assert complete encoded category hrefs with only valid `origin`, and assert the legacy loader is not called in `src/app/locations/__tests__/page.test.tsx`, `src/app/locations/[category-id]/__tests__/page.test.tsx`, and `src/components/features/__tests__/LocationCategoryNavigation.test.tsx`; rerun RED before a fresh review

### Implementation for User Story 1

- [X] T014 [US1] Implement the server `/locations` entry, first-category resolution, loading boundary, and data-error boundary in `src/app/locations/page.tsx` and `src/app/locations/loading.tsx`
- [X] T015 [US1] Implement the server category page, category identifier decoding, standard 404 boundary, data-error state, and deterministic area-grouped rendering in `src/app/locations/[category-id]/page.tsx`
- [X] T015A [US1][correction] Resolve the shared DOM contract regression by using `PageHeader` for the category page h1 and replacing its non-discussion `article` summary wrapper with an allowed semantic container in `src/app/locations/[category-id]/page.tsx`; rerun the category and shared layout contract tests
- [X] T016 [US1] Implement the shared category layout and URL-aware navigation in `src/app/locations/layout.tsx` and `src/components/features/LocationCategoryNavigation.tsx`, using native links and valid `origin` preservation only between categories
- [X] T017 [US1] Run the User Story 1 focused GREEN suite for `src/app/locations/`, `src/app/locations/[category-id]/`, and `src/components/features/LocationCategoryNavigation.tsx`, plus strict TypeScript, scoped lint, and `git diff --check`; parent verifies route output, 404/data-error distinction, and changed-path scope

**Checkpoint**: A user can enter `/locations`, land on the first category, navigate categories by URL, and receive standard 404 for nonexistent category URLs.

---

## Phase 4: User Story 2 - カテゴリから場所詳細へ移動し、元のカテゴリへ戻る (Priority: P1)

**Goal**: `/locations/location-detail/[id]`を正規詳細ページにし、旧routeを残さず、存在しない詳細URLは通常404にする。

**Independent Test**: 有効な詳細リンク、直接アクセス、詳細からカテゴリへの戻り、目的地リンク、未知/不正IDの通常404、重複/データ取得失敗のデータエラーを確認する。

### RED tests for User Story 2

- [X] T018 [P] [US2] Add RED tests for valid nested detail rendering, metadata, destination link, category back link without `origin`, and optional fields in `src/app/locations/location-detail/[id]/__tests__/page.test.tsx`
- [X] T019 [P] [US2] Add RED tests for standard 404 on unknown/malformed detail IDs and separate data-error states for duplicate IDs, malformed payloads, and loader failures in `src/app/locations/location-detail/[id]/__tests__/page.test.tsx`
- [X] T020 [US2] Perform the fresh read-only test-code review for the complete nested detail RED suite; report `SUBAGENT_STATUS: COMPLETE` and explicit `VERDICT: PASS`
- [X] T020A [correction] Strengthen the nested detail RED suite after review: assert loader/resolver calls and arguments, cover direct access with no identifiable category using the safe `/locations` fallback, and audit optional labels/values and external-link collection across the page; leave old-route negative census to T025–T027 in `src/app/locations/location-detail/[id]/__tests__/page.test.tsx`, then rerun RED before a fresh review
- [X] T020B [correction] Strengthen the nested detail RED suite after review with the image alternative-text/role contract, explicit `dt`→`dd` pairing for region and provider information, and `target="_blank"`/`rel="noopener noreferrer"` assertions for external links in `src/app/locations/location-detail/[id]/__tests__/page.test.tsx`; rerun RED before a fresh review

### Implementation for User Story 2

- [X] T021 [US2] Implement the server nested detail page, shared resolver usage, metadata, loading boundary, standard 404, data-error states, and category back-link in `src/app/locations/location-detail/[id]/page.tsx` and `src/app/locations/location-detail/[id]/loading.tsx`
- [X] T022A [US2][RED] Add RED tests for `LocationCard`'s nested canonical detail href, supplied area rendering, and absence of client GeoJSON lookup in `src/components/features/__tests__/LocationCard.test.tsx`
- [X] T022B [US2] Perform the fresh read-only test-code review for the T022A `LocationCard` RED tests; report `SUBAGENT_STATUS: COMPLETE` and explicit `VERDICT: PASS`
- [X] T022 [US2] Convert the location summary card to the nested native detail link and server-provided area boundary in `src/components/features/LocationCard.tsx`
- [X] T023 [US2] Record the settled detail-page replacement contract, changed paths, optional-field fixture matrix, and old-route cleanup evidence in `specs/023-location-data-pages/deletion-ledger.md`
- [X] T024 [US2] Run the User Story 2 focused GREEN suite for `src/app/locations/location-detail/[id]/` and `src/components/features/LocationCard.tsx`, plus strict TypeScript, scoped lint, and `git diff --check`; parent verifies standard 404 versus data-error behavior and destination query preservation

### Obsolete route removal gate for User Story 2

- [X] T025 [US2] Census all production consumers and tests of `src/app/location-detail/[id]/`, `/location-detail/[id]`, old detail imports, redirects, and old route-specific fixtures in `specs/023-location-data-pages/deletion-ledger.md`
- [X] T026 [US2] After T024 is GREEN, delete the obsolete `src/app/location-detail/[id]/` route and update/remove only its superseded tests; do not add a compatibility redirect or alias
- [X] T027 [US2] Run production-only negative searches for the old detail route/import/redirect, then run the nested detail suite, TypeScript, lint, and `git diff --check`; record zero production consumers in `deletion-ledger.md`

**Checkpoint**: Detail pages use only the nested URL; unknown/malformed detail URLs use standard 404; old route logic is deleted and proven unused.

---

## Phase 5: User Story 3 - 場所データを安定して利用する (Priority: P1)

**Goal**: ホームのpopular dataをserver boundaryから注入し、カテゴリページにGPS-onlyの町字/距離並べ替えを提供する。

**Independent Test**: ブラウザCDN fetchなしのホーム表示、施設選択、カテゴリ下の2操作、origin保持/破棄、invalid origin、GPS拒否、再取得失敗、住所検索不在を確認する。

### RED tests for home data injection

- [X] T028 [P] [US3] Add RED tests proving the home server boundary supplies popular facility data without browser CDN loading while preserving destination selection in `src/app/__tests__/page.test.tsx` and `src/components/features/__tests__/LocationSuggestions.test.tsx`
- [X] T029 [US3] Perform the fresh read-only test-code review for the home data-injection RED suite; report `SUBAGENT_STATUS: COMPLETE` and explicit `VERDICT: PASS`
- [X] T029A [correction] Harden the home data-injection RED tests after review: migrate synchronous legacy Home assertions to the async server/client boundary, constrain legacy-hook fallback to page invocation only, exercise a real browser fetch boundary, and assert exact popular-category props/callback propagation in `src/app/__tests__/page.test.tsx` and `src/components/features/__tests__/LocationSuggestions.test.tsx`; rerun RED before a fresh review

### Implementation for home data injection

- [X] T030 [US3] Split the current interactive home implementation into a server data wrapper in `src/app/page.tsx` and a client form boundary in `src/components/features/HomeRouteForm.tsx` without changing route-form behavior
- [X] T030A [US3][correction] Migrate the existing destination deep-link contract test to invoke the async server Home boundary and render its client form element without weakening the destination state or URL-clearing assertion in `src/app/__tests__/page-navigation-contract.test.tsx`
- [X] T030B [US3] Perform the fresh read-only test-code review for the T030A async Home navigation-contract correction; report `SUBAGENT_STATUS: COMPLETE` and explicit `VERDICT: PASS`
- [X] T031 [US3] Change `src/components/features/DestinationSelector.tsx` and `src/components/features/LocationSuggestions.tsx` to receive server-provided popular categories and remove their client-side location-data CDN fetch
- [X] T032 [US3] Run the home data-injection focused GREEN suite for `src/app/page.tsx`, `src/components/features/HomeRouteForm.tsx`, `src/components/features/DestinationSelector.tsx`, and `src/components/features/LocationSuggestions.tsx`, plus strict TypeScript, scoped lint, and browser/network evidence; parent verifies no browser request to popular-location CDN and unchanged destination handoff

### RED tests for GPS sort controls and origin propagation

- [X] T033 [P] [US3] Add RED tests for the two sort controls, GPS success/denied/timeout, valid out-of-area origin, invalid origin error plus town list, existing-origin re-acquisition failure, and no name/address search in `src/components/features/__tests__/LocationSortControls.test.tsx` and `src/lib/location/__tests__/location-origin-query.test.ts`
- [X] T034 [US3] Perform the fresh read-only test-code review for the complete GPS/origin RED suite; report `SUBAGENT_STATUS: COMPLETE` and explicit `VERDICT: PASS`
- [X] T034A [correction] Harden the GPS/origin RED tests after review: assert the real browser URL retains an existing origin after reacquisition failure, remove nullable early-return guards, strengthen no-search selectors to include input/textarea/searchbox and link/button names, and assert no fetch on failure paths in `src/components/features/__tests__/LocationSortControls.test.tsx`; rerun RED before a fresh review

### Implementation for GPS sort controls

- [X] T035 [US3] Implement `LocationSortControls` in `src/components/features/LocationSortControls.tsx` with explicit-click geolocation, Japanese loading/error states, valid-origin serialization, and preservation of an existing valid origin after GPS failure
- [X] T035A [US3][correction] Add the repository-required `text-base` and DaisyUI `gap-0` classes to both sort controls without changing their GPS/origin behavior in `src/components/features/LocationSortControls.tsx`; rerun the style contracts and GPS suite
- [X] T036 [US3] Integrate server-side origin parsing and distance sorting into `src/app/locations/[category-id]/page.tsx` and `src/lib/location/location-origin-query.ts`, accepting numeric coordinates outside Chiyoda and rejecting unparseable values
- [X] T037 [US3] Update `src/components/features/LocationCategoryNavigation.tsx` to preserve valid `origin` across category links, while `LocationCard` and detail/other links omit it
- [X] T038 [US3] Implement the `町字で並べる` query-clearing link and accessible selected-mode contract in `src/components/features/LocationSortControls.tsx` and its page integration
- [X] T039 [US3] Run the GPS/origin focused GREEN suite for `src/components/features/LocationSortControls.tsx`, `src/lib/location/location-origin-query.ts`, and `src/app/locations/[category-id]/page.tsx`, plus strict TypeScript, scoped lint, `git diff --check`, and browser acceptance for permissions, URL transitions, and retained distance view
- [X] T039A [US3][correction][RED] Add regression RED tests for server-side GeoJSON fallback when the local snapshot is absent and for the runtime standard-404 status of unknown category/detail URLs in `src/utils/__tests__/geoUtils.test.ts` and `src/app/__tests__/location-pages-404.test.ts`
- [X] T039B [US3] Perform the fresh read-only test-code review for the T039A GeoJSON/HTTP-404 correction RED tests; report `SUBAGENT_STATUS: COMPLETE` and explicit `VERDICT: PASS`
- [X] T039C [US3][correction] Implement the server GeoJSON fallback/cache boundary and correct unknown category/detail HTTP 404 behavior without changing data-error semantics or browser-fetch/privacy boundaries in `src/utils/geoUtils.ts` and the named location route pages
- [X] T039D [US3][correction][RED] Add a runtime RED regression for a known category URL with valid `origin` to require distance-mode HTML on a production GET, proving that static route configuration does not discard the query in `src/app/__tests__/location-pages-origin-runtime.test.ts`
- [X] T039E [US3] Perform the fresh read-only test-code review for the T039D runtime origin RED test; report `SUBAGENT_STATUS: COMPLETE` and explicit `VERDICT: PASS`
- [X] T039F [US3][correction] Restore dynamic `origin` query rendering while retaining static unknown-path 404 protection for category/detail routes in the named location route pages; rerun the GeoJSON/404/origin runtime contracts
- [X] T039G [US3][correction] Execute the selected dynamic-origin strategy after the incomplete T039F attempt: keep the category route dynamically rendering `origin`, retain `dynamicParams=false`/known-path 404 protection, remove any experimental search-parameter introspection, and prevent the locations layout, parent `src/app/locations/loading.tsx`, or category `src/app/locations/[category-id]/loading.tsx` streaming boundary from softening unknown-category HTTP 404 responses while retaining the common navigation/Suspense and detail 404 contract

### Obsolete name/address-search removal gate for User Story 3

- [X] T040 [US3] Census production consumers of `geocodeAddress`, `GeocodingResult`, address-search state, location-page rate-limit source, old location search controls, and old distance/position orchestration in `specs/023-location-data-pages/deletion-ledger.md`; explicitly mark route-form consumers as retained/out of scope
- [X] T041 [P] [US3] Add RED negative-contract tests proving location pages do not render name/address search controls or invoke the location-page geocode/rate-limit branch in `src/app/locations/__tests__/page.test.tsx` and `src/lib/location/__tests__/location-list-state.test.ts`
- [X] T042 [US3] Perform the fresh read-only test-code review for the User Story 3 deletion tests; report `SUBAGENT_STATUS: COMPLETE` and explicit `VERDICT: PASS`
- [X] T043 [US3] Delete obsolete location-page address/name search UI, `geocodeAddress`/geocoding result code, address/search state, and dedicated locations rate-limit branch from the production paths recorded in `deletion-ledger.md`; preserve any verified route-form consumer
- [X] T044 [US3] Run production-only negative searches for deleted geocode/search/rate-limit symbols and old client location-data imports, then run GPS/home/category tests, TypeScript, lint, and `git diff --check`; record zero unintended production consumers in `deletion-ledger.md`

**Checkpoint**: Home popular data is server-supplied; categories support two sort modes; origin propagation and privacy boundaries match the contract; address/name search logic is removed without touching route-form consumers.

---

## Phase 6: User Story 4 - 標準的なページ構造で場所を探す (Priority: P2)

**Goal**: 共通ナビゲーション、並べ替え操作、404/data-error、見出し・リンク・キーボード契約を整える。

**Independent Test**: `/locations`、カテゴリ、詳細、404、data-error、町字/距離操作をキーボードとアクセシビリティ境界で確認する。

### RED tests for User Story 4

- [X] T045 [P] [US4] Add RED tests for native navigation structure, `nav`/link roles, `aria-current`, keyboard traversal, the two sort controls, and standard 404 versus data-error in `src/components/features/__tests__/LocationCategoryNavigation.test.tsx`, `src/components/features/__tests__/LocationSortControls.test.tsx`, and `src/app/__tests__/location-pages-404.test.ts`
- [X] T046 [US4] Perform the fresh read-only test-code review for the complete accessibility/error-boundary RED suite; report `SUBAGENT_STATUS: COMPLETE` and explicit `VERDICT: PASS`

### Implementation for User Story 4

- [X] T047 [US4] Implement the settled native navigation and accessibility contract in `src/components/features/LocationCategoryNavigation.tsx`, `src/components/features/LocationSortControls.tsx`, and the locations layout/page boundaries without introducing an application tab widget
- [X] T047A [US4][correction] Preserve the T045 initial-HTML navigation contract and T039 dynamic-origin behavior while restoring the detail 404 boundary regressed by dynamic locations layout: first verify a detail-only static route segment configuration (`dynamic="force-static"` with existing `dynamicParams=false`/static params) that keeps the existing detail `loading.tsx`; if Next rejects that composition, move the Japanese loading UI to a normal reusable component and update only its existing contract-test import while deleting the special-file streaming boundary. In either case retain standard detail HTTP 404, detail data-error separation, and all detail content/link contracts
- [X] T048 [US4] Align Japanese loading, invalid-origin, GPS failure, data-error, and standard 404 rendering in the named page boundaries and ensure each state has the required heading/status/link contract
- [X] T049 [US4] Run the User Story 4 focused GREEN suite for `src/components/features/LocationCategoryNavigation.tsx`, `src/components/features/LocationSortControls.tsx`, and `src/app/__tests__/location-pages-404.test.ts`, plus strict TypeScript, scoped lint, keyboard/browser checks, and `git diff --check`

### Obsolete navigation/state removal gate for User Story 4

- [X] T050 [US4] Census production consumers of the old `CategoryTabs`, active-category state, client-only location page wrappers, client area lookup fallback, and obsolete location-list reducer paths in `specs/023-location-data-pages/deletion-ledger.md`
- [X] T051 [US4] After the replacement navigation tests are GREEN, remove old location-page `CategoryTabs` usage, obsolete active-category state, and any unused client-only area/state path; delete `CategoryTabs` only if the production-consumer census proves no other runtime consumer remains
- [X] T052 [US4] Run production-only negative searches for the deleted navigation/state/import paths, then run all focused location suites, TypeScript, lint, keyboard checks, and `git diff --check`; record final deletion evidence in `deletion-ledger.md`

**Checkpoint**: All location pages use URL navigation and standard 404/data-error semantics; obsolete navigation/state paths are deleted or explicitly retained with evidence.

---

## Phase 7: Polish & Cross-Cutting Verification

**Purpose**: 削除台帳を閉じ、全体検証と実ブラウザ確認を行う

- [X] T053 [P] Run a final production-only reference census over old routes, client CDN loaders, address/geocode search, obsolete state, compatibility redirects, and unused exports; update `specs/023-location-data-pages/deletion-ledger.md` with zero unresolved delete candidates
- [X] T053A [P][correction][RED] Add a test-only RED contract for the four unresolved production candidates from T053—legacy `loadAddressData()`, unconsumed `LocationCard`, test-only `LocationDetailLoading`, and test-only `buildLocationHref`/`LocationLinkKind`—while preserving `loadAddressDataResult`, server location boundaries, and route-form contracts
- [X] T053B [correction] Perform the fresh read-only test-code review for the T053A unused-export/dead-module RED contract; report `SUBAGENT_STATUS: COMPLETE` and explicit `VERDICT: PASS`
- [X] T053C [correction] Delete the four unresolved unused production candidates and only their superseded test/accessibility references, retaining server loaders, route-form consumers, distance/origin primitives, and all public location-page behavior
- [X] T053D [correction][RED] Update only the finite `card-title` contract's verified production occurrence count and description after the required LocationCard deletion; preserve fail-closed scanning and all class/violation assertions in `src/app/__tests__/card-title-style-contract.test.ts`
- [X] T053E [correction] Perform the fresh read-only test-code review for the T053D finite-contract correction; report `SUBAGENT_STATUS: COMPLETE` and explicit `VERDICT: PASS`
- [X] T054 [P] Run `npx tsc --noEmit --incremental false` over `src/` and record the result in the implementation evidence
- [X] T055 [P] Run `npm run lint` over the repository source paths and classify existing warning-only output separately from new errors
- [X] T056 Run the full Jest suite covering `src/**/__tests__` and `src/**/*.test.tsx` with `npm test -- --runInBand`, record suite/test counts, and verify all focused contracts remain GREEN
- [X] T057 Run the browser acceptance walkthrough in `specs/023-location-data-pages/quickstart.md` at desktop and narrow mobile widths, including URL/origin propagation, GPS failures, standard 404, data errors, and no browser CDN fetch
- [X] T058 Run `git diff --check`, `git status --short --untracked-files=all`, and `npm run build` using `package.json`; record exact exit codes and side effects
- [X] T059 Parent-owned final verification: reconcile `specs/023-location-data-pages/deletion-ledger.md`, production-only negative searches, changed paths, `spec.md`/`plan.md`/`tasks.md` coverage, and all verification evidence before any commit or push

---

## Requirement Traceability

The mappings below are explicit planning traceability. The task descriptions remain independently executable; the IDs make coverage review deterministic.

| Requirement range | Covering tasks |
|---|---|
| FR-001–FR-002 | T006–T009, T028–T032, T044, T057 |
| FR-003–FR-005 | T010–T017, T045–T049 |
| FR-006–FR-008 | T018–T024 |
| FR-009–FR-011 | T018–T027 |
| FR-012 | T028–T032 |
| FR-013–FR-016 | T006–T009, T033–T044, T048 |
| FR-017–FR-019 | T003, T010–T017, T045–T049 |
| FR-020–FR-021 | T003, T033–T039 |
| FR-022–FR-023 | T033–T044, T045–T049 |
| FR-024–FR-026 | T003, T033–T039, T045–T049 |

| Success criteria range | Covering tasks |
|---|---|
| SC-001–SC-004 | T006–T017, T018–T027, T028–T032, T045–T049, T057 |
| SC-005–SC-006 | T018–T024, T028–T032 |
| SC-007–SC-008 | T033–T052, T057 |
| SC-009–SC-011 | T001–T002, T025–T027, T040–T052, T053–T059 |
| SC-012–SC-013 | T003, T033–T039, T057 |

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: no implementation dependency; freezes baseline and creates the deletion ledger
- **Phase 2 Foundational**: depends on Setup and blocks all user stories
- **Phase 3 US1**: depends on Foundational; establishes server category route and navigation
- **Phase 4 US2**: depends on Foundational and category data boundary; uses US1 route/navigation contracts
- **Phase 5 US3**: depends on Foundational and server category data; home injection may proceed after shared loader contracts
- **Phase 6 US4**: depends on US1–US3 replacement behavior so obsolete navigation/state deletion is evidence-based
- **Phase 7 Polish**: depends on all desired stories and all deletion gates

### User Story Dependencies

- **US1 (P1)**: foundation only; MVP route/category slice
- **US2 (P1)**: foundation + shared category data; integrates with US1 URLs
- **US3 (P1)**: foundation + category data; integrates with US1 navigation and origin propagation
- **US4 (P2)**: follows the settled US1–US3 public UI contracts and owns final navigation/accessibility cleanup

### Within Each Story

- RED tests first
- Fresh test-code review immediately after each complete test chapter
- Production implementation only after the corresponding `VERDICT: PASS`
- Focused GREEN and parent-owned diff/scope verification after implementation
- Deletion only after replacement behavior is GREEN
- Negative production search after every deletion group

### Parallel Opportunities

- T003 and T006 test chapters touch distinct files and can be authored in parallel; their review/implementation gates remain separate.
- T010–T012 can be authored in parallel before T013 review.
- T018–T019 can be authored in parallel before T020 review.
- T028 and T033 can be authored in parallel after the relevant shared boundaries are frozen; each has its own review gate.
- T045 can begin after the replacement navigation/control DOM is settled, but cannot bypass T013/T020/T034.
- T054/T055 and T053 can run in parallel after all production edits stop.

## Implementation Strategy

### MVP first

1. Foundation: origin parser, server data status, area/distance helpers.
2. US1: `/locations` first-category resolution, category pages, shared URL navigation, standard 404.
3. Stop and validate the category journey independently.

### Incremental delivery

1. Add US2 nested detail pages and delete the old route.
2. Add US3 server-injected popular data and GPS sort controls; delete address/name search logic.
3. Add US4 accessibility/error contracts and delete obsolete navigation/state paths.
4. Complete deletion ledger, browser acceptance, full tests, lint, typecheck, and build.

## Notes

- `tasks.md` explicitly includes deletion-ledger, reference-census, replacement-test, negative-search, and verification tasks. There is no generic cleanup-only task.
- No production review task is added because the repository constitution assigns final production review to the parent; test-code review tasks remain blocking and explicit.
- A task that modifies tests or production files invalidates any prior review verdict for those bytes.
