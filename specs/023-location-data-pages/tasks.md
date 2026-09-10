---

description: "Task list for location data pages and JavaScript reduction"
---

# Tasks: 場所データページのJavaScript削減

**Input**: Design documents from `/specs/023-location-data-pages/`

**Prerequisites**: `plan.md`、`spec.md`、`research.md`、`data-model.md`、`contracts/location-pages.md`、`quickstart.md`

**Tests**: AGENTS.mdのTDD方針に従い、すべての公開契約テストを本番実装より先にREDで作成し、直後にfresh test-code reviewを行う。

**Review boundary**: 本番コードの最終レビューは親エージェントが実際の差分・ハッシュ・検証結果を確認する。リポジトリ憲章に従い、tasks.mdには独立した本番コードレビューtaskを追加しない。補正RED後の`[correction-review]`は、既存の作業履歴に不足していたテストコードレビュー証跡を補う追補taskであり、過去の完了表示を事後に捏造しない。今後の実装変更は、対応するreviewの`VERDICT: PASS`後にのみ受け入れる。

**Q21追加対応の位置づけ**: Q21はspec023へ後から追加されたデータ境界である。T003–T059は、既存のserver-side data boundaryを前提にURL・ページ・UI・削除契約を整える前段作業として扱う。T003–T059の時点で実装が外部データローダーを使用していても、それ自体を仕様違反や未完了の重複実装とは判定しない。ただし、T060–T068が完了するまでは、ビルド生成物だけを読む最終契約を満たしたことにしない。T060–T068は前段のruntime loader／fallbackを生成物readerへ置き換える追補であり、完了後の状態をrelease boundaryとする。

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
- [X] T004B [correction-review] Perform the fresh read-only review for the T004A corrected `origin` RED contract; report `SUBAGENT_STATUS: COMPLETE` and explicit `VERDICT: PASS` before treating any subsequent origin implementation change as accepted
- [X] T005 Implement the pure origin parser/serializer and validity model in `src/lib/location/location-origin-query.ts`, preserving invalid-origin display behavior without adding persistent storage

### Server data and failure-boundary RED

- [X] T006 Add RED tests for status-preserving key-location/popular-location data loads, JSON/HTTP failures, malformed required fields, duplicate IDs, empty categories, and server-side area grouping in `src/lib/location/__tests__/location-page-data.test.ts` and `src/utils/__tests__/addressLoader.test.ts`
- [X] T007 Perform the fresh read-only test-code review for the complete server data-boundary RED suite in `src/lib/location/__tests__/location-page-data.test.ts` and `src/utils/__tests__/addressLoader.test.ts`; report `SUBAGENT_STATUS: COMPLETE` and explicit `VERDICT: PASS`
- [X] T007A [correction] Strengthen the server data-boundary RED suite with non-empty `loadLocationPageData` success preservation, explicit `error: Error` assertions for key-location failures, and versioned CDN endpoint assertions for both loaders in `src/lib/location/__tests__/location-page-data.test.ts` and `src/utils/__tests__/addressLoader.test.ts`; rerun RED before a fresh review
- [X] T007B [correction-review] Perform the fresh read-only review for the T007A corrected server data-boundary RED suite; report `SUBAGENT_STATUS: COMPLETE` and explicit `VERDICT: PASS` before treating any subsequent data-boundary implementation change as accepted
- [X] T008 Implement the shared server data boundary in `src/lib/location/location-page-data.ts` and `src/utils/addressLoader.ts`, including status-preserving popular-location data, key-location validation, duplicate detection, and server-safe GeoJSON loading
- [X] T009 [pre-Q21] Reuse or extract pure area grouping and distance helpers from the then-existing `src/lib/location/location-list-state.ts` and `src/utils/clientGeoUtils.ts` without deleting production consumers in the foundational phase; keep deterministic input-order tie-breaking, record later migration/deletion candidates in `deletion-ledger.md`, and do not recreate the client module after the server/artifact boundary is adopted

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
- [X] T013B [correction-review] Perform the fresh read-only review for the T013A corrected User Story 1 RED suite; report `SUBAGENT_STATUS: COMPLETE` and explicit `VERDICT: PASS` before treating any subsequent US1 implementation change as accepted

### Implementation for User Story 1

- [X] T014 [US1] Implement the server `/locations` entry, first-category resolution, loading boundary, and data-error boundary in `src/app/locations/page.tsx` and `src/app/locations/loading.tsx`
- [X] T015 [US1] Implement the server category page, category identifier decoding, standard 404 boundary, data-error state, and deterministic area-grouped rendering in `src/app/locations/[category-id]/page.tsx`
- [X] T015A [US1] [correction] Resolve the shared DOM contract regression by using `PageHeader` for the category page h1 and replacing its non-discussion `article` summary wrapper with an allowed semantic container in `src/app/locations/[category-id]/page.tsx`; rerun the category and shared layout contract tests
- [X] T016 [US1] Implement the category-only layout and URL-aware navigation in `src/app/locations/[category-id]/layout.tsx` and `src/components/features/LocationCategoryNavigation.tsx`; keep `src/app/locations/layout.tsx` as a common shell/error boundary without category navigation, and use native links with valid `origin` preservation only between categories
- [X] T017 [US1] Run the User Story 1 focused GREEN suite for `src/app/locations/`, `src/app/locations/[category-id]/`, and `src/components/features/LocationCategoryNavigation.tsx`, plus strict TypeScript, scoped lint, and `git diff --check`; parent verifies route output, 404/data-error distinction, and changed-path scope

**Checkpoint**: A user can enter `/locations`, land on the first category, navigate categories by URL, and receive standard 404 for nonexistent category URLs.

---

## Phase 4: User Story 2 - カテゴリから場所詳細へ移動し、元のカテゴリへ戻る (Priority: P1)

**Goal**: `/locations/location-detail/[id]`を正規詳細ページにし、旧routeを残さず、存在しない詳細URLは通常404にする。

**Independent Test**: 有効な詳細リンク、直接アクセス、詳細からカテゴリへの戻り、目的地リンク、未知/不正IDの通常404、ビルド時の重複/データ取得失敗による公開用ビルド失敗、ビルド後の生成物エラーを確認する。

### RED tests for User Story 2

- [X] T018 [P] [US2] Add RED tests for valid nested detail rendering, metadata, destination link, category back link without `origin`, and optional fields in `src/app/locations/location-detail/[id]/__tests__/page.test.tsx`
- [X] T019 [P] [US2] Add RED tests for standard 404 on unknown/malformed detail IDs and separate data-error states for duplicate IDs, malformed payloads, and loader failures in `src/app/locations/location-detail/[id]/__tests__/page.test.tsx`
- [X] T020 [US2] Perform the fresh read-only test-code review for the complete nested detail RED suite; report `SUBAGENT_STATUS: COMPLETE` and explicit `VERDICT: PASS`
- [X] T020A [correction] Strengthen the nested detail RED suite after review: assert loader/resolver calls and arguments, cover direct access with no identifiable category using the safe `/locations` fallback, and audit optional labels/values and external-link collection across the page; leave old-route negative census to T025–T027 in `src/app/locations/location-detail/[id]/__tests__/page.test.tsx`, then rerun RED before a fresh review
- [X] T020B [correction] Strengthen the nested detail RED suite after review with the image alternative-text/role contract, explicit `dt`→`dd` pairing for region and provider information, and `target="_blank"`/`rel="noopener noreferrer"` assertions for external links in `src/app/locations/location-detail/[id]/__tests__/page.test.tsx`; rerun RED before a fresh review
- [X] T020C [correction-review] Perform the fresh read-only review for the complete T020A/T020B corrected nested-detail RED suite; report `SUBAGENT_STATUS: COMPLETE` and explicit `VERDICT: PASS` before treating any subsequent US2 implementation change as accepted

### Implementation for User Story 2

- [X] T021 [US2] Implement the server nested detail page, shared resolver usage, metadata, loading boundary, standard 404, data-error states, and category back-link in `src/app/locations/location-detail/[id]/page.tsx` and `src/app/locations/location-detail/[id]/loading.tsx`
- [X] T022A [US2] [pre-cleanup] [RED] Add RED tests for the then-existing `LocationCard`'s nested canonical detail href, supplied area rendering, and absence of client GeoJSON lookup in `src/components/features/__tests__/LocationCard.test.tsx`
- [X] T022B [US2] [pre-cleanup] Perform the fresh read-only test-code review for the T022A `LocationCard` RED tests; report `SUBAGENT_STATUS: COMPLETE` and explicit `VERDICT: PASS`
- [X] T022 [US2] [pre-cleanup] Convert the then-existing location summary card to the nested native detail link and server-provided area boundary in `src/components/features/LocationCard.tsx`; T053C later deletes this unconsumed intermediate module
- [X] T023 [US2] Record the settled detail-page replacement contract, changed paths, optional-field fixture matrix, and old-route cleanup evidence in `specs/023-location-data-pages/deletion-ledger.md`
- [X] T024 [US2] [pre-cleanup] Run the User Story 2 focused GREEN suite for `src/app/locations/location-detail/[id]/` and the then-existing `src/components/features/LocationCard.tsx`, plus strict TypeScript, scoped lint, and `git diff --check`; parent verifies standard 404 versus data-error behavior and destination query preservation

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
- [X] T029B [correction-review] Perform the fresh read-only review for the T029A corrected home data-injection RED suite; report `SUBAGENT_STATUS: COMPLETE` and explicit `VERDICT: PASS` before treating any subsequent US3 home implementation change as accepted

### Implementation for home data injection

- [X] T030 [US3] Split the current interactive home implementation into a server data wrapper in `src/app/page.tsx` and a client form boundary in `src/components/features/HomeRouteForm.tsx` without changing route-form behavior
- [X] T030A [US3] [correction] Migrate the existing destination deep-link contract test to invoke the async server Home boundary and render its client form element without weakening the destination state or URL-clearing assertion in `src/app/__tests__/page-navigation-contract.test.tsx`
- [X] T030B [US3] Perform the fresh read-only test-code review for the T030A async Home navigation-contract correction; report `SUBAGENT_STATUS: COMPLETE` and explicit `VERDICT: PASS`
- [X] T031 [US3] Change `src/components/features/DestinationSelector.tsx` and `src/components/features/LocationSuggestions.tsx` to receive server-provided popular categories and remove their client-side location-data CDN fetch
- [X] T032 [US3] Run the home data-injection focused GREEN suite for `src/app/page.tsx`, `src/components/features/HomeRouteForm.tsx`, `src/components/features/DestinationSelector.tsx`, and `src/components/features/LocationSuggestions.tsx`, plus strict TypeScript, scoped lint, and browser/network evidence; parent verifies no browser request to popular-location CDN and unchanged destination handoff

### RED tests for GPS sort controls and origin propagation

- [X] T033 [P] [US3] Add RED tests for the two sort controls, GPS success/denied/timeout, valid out-of-area origin, invalid origin error plus town list, existing-origin re-acquisition failure, and no name/address search in `src/components/features/__tests__/LocationSortControls.test.tsx` and `src/lib/location/__tests__/location-origin-query.test.ts`
- [X] T034 [US3] Perform the fresh read-only test-code review for the complete GPS/origin RED suite; report `SUBAGENT_STATUS: COMPLETE` and explicit `VERDICT: PASS`
- [X] T034A [correction] Harden the GPS/origin RED tests after review: assert the real browser URL retains an existing origin after reacquisition failure, remove nullable early-return guards, strengthen no-search selectors to include input/textarea/searchbox and link/button names, and assert no fetch on failure paths in `src/components/features/__tests__/LocationSortControls.test.tsx`; rerun RED before a fresh review
- [X] T034B [correction-review] Perform the fresh read-only review for the T034A corrected GPS/origin RED suite; report `SUBAGENT_STATUS: COMPLETE` and explicit `VERDICT: PASS` before treating any subsequent US3 GPS/origin implementation change as accepted

### Implementation for GPS sort controls

- [X] T035 [US3] Implement `LocationSortControls` in `src/components/features/LocationSortControls.tsx` with explicit-click geolocation, Japanese loading/error states, valid-origin serialization, and preservation of an existing valid origin after GPS failure
- [X] T035A [US3] [correction] Add the repository-required `text-base` and DaisyUI `gap-0` classes to both sort controls without changing their GPS/origin behavior in `src/components/features/LocationSortControls.tsx`; rerun the style contracts and GPS suite
- [X] T036 [US3] Integrate server-side origin parsing and distance sorting into `src/app/locations/[category-id]/page.tsx` and `src/lib/location/location-origin-query.ts`, accepting numeric coordinates outside Chiyoda and rejecting unparseable values
- [X] T037 [US3] Update `src/components/features/LocationCategoryNavigation.tsx` to preserve valid `origin` across category links, while location-summary and detail/other links omit it; do not make the deleted `LocationCard` component a new runtime dependency
- [X] T038 [US3] Implement the `町字で並べる` query-clearing link and accessible selected-mode contract in `src/components/features/LocationSortControls.tsx` and its page integration
- [X] T039 [US3] Run the GPS/origin focused GREEN suite for `src/components/features/LocationSortControls.tsx`, `src/lib/location/location-origin-query.ts`, and `src/app/locations/[category-id]/page.tsx`, plus strict TypeScript, scoped lint, `git diff --check`, and browser acceptance for permissions, URL transitions, and retained distance view
- [X] T039A [US3] [correction] [pre-Q21 RED] Add regression tests for the intermediate server-side GeoJSON fallback and for the runtime standard-404 status of unknown category/detail URLs in `src/utils/__tests__/geoUtils.test.ts` and `src/app/__tests__/location-pages-404.test.ts`; the fallback contract is superseded by Q21 T060–T068 and is not the release boundary
- [X] T039B [US3] Perform the fresh read-only test-code review for the T039A GeoJSON/HTTP-404 correction RED tests; report `SUBAGENT_STATUS: COMPLETE` and explicit `VERDICT: PASS`
- [X] T039C [US3] [correction] [pre-Q21] Implement the intermediate server GeoJSON fallback/cache boundary and correct unknown category/detail HTTP 404 behavior without changing data-error semantics or browser-fetch/privacy boundaries in `src/utils/geoUtils.ts` and the named location route pages; T065 must later replace this fallback with the generated-artifact reader
- [X] T039D [US3] [correction] [RED] Add a runtime RED regression for a known category URL with valid `origin` to require distance-mode HTML on a production GET, proving that static route configuration does not discard the query in `src/app/__tests__/location-pages-origin-runtime.test.ts`
- [X] T039E [US3] Perform the fresh read-only test-code review for the T039D runtime origin RED test; report `SUBAGENT_STATUS: COMPLETE` and explicit `VERDICT: PASS`
- [X] T039F [US3] [correction] Restore dynamic `origin` query rendering while retaining static unknown-path 404 protection for category/detail routes in the named location route pages; rerun the GeoJSON/404/origin runtime contracts
- [X] T039G [US3] [correction] Execute the selected dynamic-origin strategy after the incomplete T039F attempt: keep the category route dynamically rendering `origin`, retain `dynamicParams=false`/known-path 404 protection, remove any experimental search-parameter introspection, and prevent the locations layout, parent `src/app/locations/loading.tsx`, or category `src/app/locations/[category-id]/loading.tsx` streaming boundary from softening unknown-category HTTP 404 responses while retaining the common navigation/Suspense and detail 404 contract

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

- [X] T047 [US4] Implement the settled native navigation and accessibility contract in `src/components/features/LocationCategoryNavigation.tsx`, `src/components/features/LocationSortControls.tsx`, `src/app/locations/layout.tsx`, and `src/app/locations/[category-id]/layout.tsx` without introducing an application tab widget; keep category-only UI outside the detail route
- [X] T047A [US4] [correction] Preserve the T045 initial-HTML navigation contract and T039 dynamic-origin behavior while restoring the detail 404 boundary regressed by dynamic locations layout: first verify a detail-only static route segment configuration (`dynamic="force-static"` with existing `dynamicParams=false`/static params) that keeps the existing detail `loading.tsx`; if Next rejects that composition, move the Japanese loading UI to a normal reusable component and update only its existing contract-test import while deleting the special-file streaming boundary. In either case retain standard detail HTTP 404, detail data-error separation, and all detail content/link contracts
- [X] T047B [US4] [conditional-review] If T047A changes any test source, perform a fresh read-only review of the changed detail 404/loading contract and report `SUBAGENT_STATUS: COMPLETE` and explicit `VERDICT: PASS`; if no test source changes, record `N/A` before T048
- [X] T048 [US4] Align Japanese loading, invalid-origin, GPS failure, data-error, and standard 404 rendering in `src/app/locations/`, `src/components/features/LocationSortControls.tsx`, and `src/app/__tests__/location-pages-404.test.ts`, ensuring each state has the required heading/status/link contract
- [X] T049 [US4] Run the User Story 4 focused GREEN suite for `src/components/features/LocationCategoryNavigation.tsx`, `src/components/features/LocationSortControls.tsx`, and `src/app/__tests__/location-pages-404.test.ts`, plus strict TypeScript, scoped lint, keyboard/browser checks, and `git diff --check`

### Obsolete navigation/state removal gate for User Story 4

- [X] T050 [US4] Census production consumers of the old `CategoryTabs`, active-category state, client-only location page wrappers, client area lookup fallback, and obsolete location-list reducer paths in `specs/023-location-data-pages/deletion-ledger.md`
- [X] T051 [US4] After the replacement navigation tests are GREEN, remove old location-page `CategoryTabs` usage, obsolete active-category state, and any unused client-only area/state path; delete `CategoryTabs` only if the production-consumer census proves no other runtime consumer remains
- [X] T052 [US4] Run production-only negative searches for the deleted navigation/state/import paths, then run all focused location suites, TypeScript, lint, keyboard checks, and `git diff --check`; record final deletion evidence in `deletion-ledger.md`

**Checkpoint**: All location pages use URL navigation and standard 404/data-error semantics; obsolete navigation/state paths are deleted or explicitly retained with evidence.

---

## Phase 7: User Story 5 - dev準拠の見た目で狭い画面でも場所を探す (Priority: P1)

**Goal**: `origin/dev`の既存場所ページを視覚基準にし、ページ見出し、Card構成、通常リンクのカテゴリナビゲーション、レスポンシブな場所カード、距離帯、データ提供元表示を、JavaScript削減後も維持する。

**Independent Test**: `origin/dev`の参照ファイルと`origin/dev@7cbf0a5a57c66b0e8e114e28cc3871ab1f46fd15`を基準に、カテゴリページを320px、375px、390px、768px、1024px、1440pxで表示し、見出し・説明・Card順序・全カテゴリラベル・場所カード・距離帯・データ提供元・詳細ページのカテゴリナビゲーション非表示を、キーボードと横はみ出しなしで確認する。

### RED tests for User Story 5

- [X] T052A [P] [US5] [RED] Add RED DOM-contract tests for the unique `PageHeader` H1, the exact description, the `Card` ordering and labels, the category-selection/nearby/data-provider regions, and the absence of the auxiliary carousel in `src/app/locations/[category-id]/__tests__/page.visual-contract.test.tsx`; use `git show origin/dev:src/app/locations/page.tsx`, `git show origin/dev:src/components/layouts/PageHeader.tsx`, and `git show origin/dev:src/components/ui/Card.tsx` as the visual reference
- [X] T052B [P] [US5] [RED] Add RED navigation visual/accessibility contract tests for every untruncated category label, native links, `aria-current="page"`, visible focus, absence of `role="tablist"`/`role="tab"`, and absence of page-wide `overflow-x-auto`/`min-w-max` in `src/components/features/__tests__/LocationCategoryNavigation.test.tsx` and `src/app/__tests__/location-pages-responsive-contract.test.tsx`; compare visual classes with `git show origin/dev:src/components/ui/CategoryTabs.tsx` without importing its tab-state behavior
- [X] T052C [P] [US5] [RED] Add RED tests for responsive location-card grids, image/long-name containment, rounded distance-band headings and grouping, town-area sections, data-provider content, and the absence of category navigation on detail pages in `src/app/locations/[category-id]/__tests__/page.visual-contract.test.tsx` and `src/app/locations/location-detail/[id]/__tests__/page.visual-contract.test.tsx`; use `git show origin/dev:src/components/features/LocationCard.tsx` and `git show origin/dev:src/components/layouts/SidebarLayout.tsx` as visual references
- [X] T052D Perform the fresh read-only test-code review for the complete `origin/dev` visual-contract RED suite in `src/app/locations/[category-id]/__tests__/page.visual-contract.test.tsx`, `src/app/locations/location-detail/[id]/__tests__/page.visual-contract.test.tsx`, `src/components/features/__tests__/LocationCategoryNavigation.test.tsx`, and `src/app/__tests__/location-pages-responsive-contract.test.tsx`; report `SUBAGENT_STATUS: COMPLETE` and explicit `VERDICT: PASS` before UI implementation

### Implementation for User Story 5

- [X] T052E [US5] Implement the category-page composition from the `origin/dev` reference—`PageHeader` with the single `場所をさがす` H1 and description, `Card` sections in the required order, native category navigation, sort controls, grouped location content, and data-provider card—in `src/app/locations/[category-id]/page.tsx`, `src/app/locations/[category-id]/layout.tsx`, `src/app/locations/layout.tsx` only where the common shell is required, and the named feature components; preserve the URL/GPS/data-boundary contracts and do not add the carousel, address search, or client tab state
- [X] T052F [US5] Replace the category navigation's fixed single-row behavior with a responsive `flex-wrap` presentation that keeps labels `whitespace-nowrap`, removes page-wide `overflow-x-auto`/`min-w-max`, preserves the `CategoryTabs` visual vocabulary only, and retains native-link/`aria-current`/keyboard behavior in `src/components/features/LocationCategoryNavigation.tsx` and `src/app/locations/[category-id]/layout.tsx`; do not expose the navigation through the detail route
- [X] T052G [US5] Align location summaries with the `origin/dev` card/grid contract—`grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`, responsive images, 16px-or-larger body text, area labels, and hover/focus treatment—and render distance results as ascending rounded-kilometre sections headed `Nキロ離れています` in `src/app/locations/[category-id]/page.tsx` without recreating the deleted unconsumed `LocationCard` module
- [X] T052G-A [correction] Apply the Q20 display-only `東京都千代田区` prefix removal to the detail page's GeoJSON-derived `地域` value, while preserving full addresses, source data, unknown-region behavior, and existing detail links in `src/app/locations/location-detail/[id]/page.tsx`
- [X] T052H [US5] Run the visual-contract GREEN suite, strict TypeScript, scoped lint, `git diff --check`, keyboard checks, and browser acceptance at 320px/375px/390px/768px/1024px/1440px; record the `origin/dev` comparison, zero unintended horizontal overflow, and detail-page navigation omission in `specs/023-location-data-pages/quickstart.md` and `specs/023-location-data-pages/deletion-ledger.md`

**Checkpoint**: Category and detail pages preserve the `origin/dev` visual structure while using URL navigation and artifact-backed data; all required widths show every category label and location action without unintended horizontal overflow.

---

## Phase 8: Polish & Cross-Cutting Verification

**Purpose**: Q21追加対応前の削除台帳・UI・ルート境界を確認する。ここは中間チェックポイントであり、runtimeの生成物専用境界を完了扱いにしない

- [X] T053 [P] [pre-Q21] Run the production-only reference census for completed route/UI cleanup over old routes, client CDN loaders, address/geocode search, obsolete state, compatibility redirects, and unused exports; update `specs/023-location-data-pages/deletion-ledger.md` with zero unresolved candidates for that cleanup scope, while leaving Q21 runtime-loader/fallback replacement explicitly open for T060–T068
- [X] T053A [P] [correction] [RED] Add a test-only RED contract for the four unresolved production candidates from T053—legacy `loadAddressData()`, unconsumed `LocationCard`, test-only `LocationDetailLoading`, and test-only `buildLocationHref`/`LocationLinkKind`—while preserving `loadAddressDataResult`, server location boundaries, and route-form contracts
- [X] T053B [correction] Perform the fresh read-only test-code review for the T053A unused-export/dead-module RED contract; report `SUBAGENT_STATUS: COMPLETE` and explicit `VERDICT: PASS`
- [X] T053C [correction] Delete the four unresolved unused production candidates and only their superseded test/accessibility references in `src/utils/addressLoader.ts`, `src/components/features/LocationCard.tsx`, `src/components/features/LocationDetailLoading.tsx`, `src/lib/location/location-href.ts`, and `src/app/__tests__/unused-location-candidates.test.ts`, retaining server loaders, route-form consumers, distance/origin primitives, and all public location-page behavior
- [X] T053D [correction] [RED] Update only the finite `card-title` contract's verified production occurrence count and description after the required LocationCard deletion; preserve fail-closed scanning and all class/violation assertions in `src/app/__tests__/card-title-style-contract.test.ts`
- [X] T053E [correction] Perform the fresh read-only test-code review for the T053D finite-contract correction; report `SUBAGENT_STATUS: COMPLETE` and explicit `VERDICT: PASS`
- [X] T054 [P] Run `npx tsc --noEmit --incremental false` over `src/` and record the result in the implementation evidence
- [X] T055 [P] Run `npm run lint` over the repository source paths and classify existing warning-only output separately from new errors
- [X] T056 Run the full Jest suite covering `src/**/__tests__` and `src/**/*.test.tsx` with `npm test -- --runInBand`, record suite/test counts, and verify all focused contracts remain GREEN
- [X] T057 [pre-Q21] Run the browser acceptance walkthrough in `specs/023-location-data-pages/quickstart.md` at desktop and narrow mobile widths, including URL/origin propagation, GPS failures, standard 404, data errors, and no browser CDN fetch; defer runtime server no-network proof to T063–T067
- [X] T058 [pre-Q21] Run `git diff --check`, `git status --short --untracked-files=all`, and the current `npm run build` using `package.json`; record exact exit codes and side effects as an intermediate checkpoint, not as proof of the final Q21 artifact boundary
- [X] T059 [pre-Q21] Parent-owned intermediate verification: reconcile `specs/023-location-data-pages/deletion-ledger.md`, production-only negative searches, changed paths, `spec.md`/`plan.md`/`tasks.md` coverage, and all pre-Q21 verification evidence before any commit or push; final release verification is T068

---

## Phase 9: Q21追加対応 — ビルド時データ生成物境界

**Purpose**: 場所データ・町字GeoJSONをビルド時に取得・検証して生成物へ固定し、ビルド後のホーム・カテゴリ・詳細が外部データ源を再取得しないことを実装・検証する。

**Q21 validation boundary**: T060/T062はplanの「Build-time location data generation boundary」にあるソース別検証表を正本とする。ビルド時の空カテゴリ・取得失敗・形式不正・required fieldの欠落または明示的なnull・任意項目のnull以外の型/形式不正・非有限数値・重複識別子は非ゼロのビルド失敗とし、任意項目の明示的なnullは欠落相当としてartifactへ保持する。ビルド後に生成物が欠落・破損した場合は、404ではなく日本語data-errorとして扱い、外部取得で補わない。

- [X] T060 [Q21] [RED] Add RED tests for build-time acquisition and validation of `main_facilities.json`, `key_locations.json`, and town GeoJSON—including URI configuration, HTTP/JSON/GeoJSON-shape, required-field, optional-field-type, empty-category, duplicate-category-ID, and duplicate-location-ID failures—in `scripts/__tests__/generate-location-artifact.test.ts` and `src/lib/location/__tests__/location-artifact.test.ts`
- [X] T061 [Q21] Perform the fresh read-only test-code review for the complete build-time acquisition/validation RED suite in `scripts/__tests__/generate-location-artifact.test.ts` and `src/lib/location/__tests__/location-artifact.test.ts`; report `SUBAGENT_STATUS: COMPLETE` and explicit `VERDICT: PASS` before implementation
- [X] T062 [Q21] Implement `scripts/generate-location-artifact.ts` and `src/lib/location/location-artifact.ts` to read the complete `townGeoJsonUri` and other source URIs from `app-config.json`, acquire and validate all required sources, derive GeoJSON regions/display names, write `public/generated/location-data.json`, and propagate every acquisition/validation failure as a non-zero build failure
- [X] T063 [Q21] [RED] Add RED tests proving the home, category, and detail runtime data paths read `public/generated/location-data.json` and never call CDN, GeoJSON provider, legacy source, or fallback fetches after build in `src/app/__tests__/location-runtime-no-network.test.tsx`, `src/lib/location/__tests__/location-artifact.test.ts`, `src/app/__tests__/page.test.tsx`, `src/app/locations/[category-id]/__tests__/page.test.tsx`, and `src/app/locations/location-detail/[id]/__tests__/page.test.tsx`
- [X] T064 [Q21] Perform the fresh read-only test-code review for the complete runtime artifact/no-network RED suite in `src/app/__tests__/location-runtime-no-network.test.tsx`, `src/lib/location/__tests__/location-artifact.test.ts`, `src/app/__tests__/page.test.tsx`, `src/app/locations/[category-id]/__tests__/page.test.tsx`, and `src/app/locations/location-detail/[id]/__tests__/page.test.tsx`; report `SUBAGENT_STATUS: COMPLETE` and explicit `VERDICT: PASS` before implementation
- [X] T065 [Q21] Replace runtime external location-data loading with the reader in `src/lib/location/location-artifact.ts` across `src/app/page.tsx`, `src/app/locations/`, `src/app/locations/location-detail/[id]/page.tsx`, and `src/lib/location/location-page-data.ts`, preserving runtime `origin` parsing/distance calculation and Japanese artifact-error states without external fallback
- [X] T066 [Q21] Run focused GREEN tests in `scripts/__tests__/generate-location-artifact.test.ts`, `src/lib/location/__tests__/location-artifact.test.ts`, `src/app/__tests__/location-runtime-no-network.test.tsx`, and the existing home/category/detail page suites for build generation, artifact reading, GeoJSON-derived region display, runtime no-network behavior, and page error boundaries; parent verifies that `origin` sorting still works from the artifact
- [X] T067 [Q21] Run `npm run build` and injected URI-configuration, HTTP, JSON/GeoJSON-shape, required-field, optional-field-type, empty-category, duplicate-category-ID, and duplicate-location-ID failure cases against `scripts/generate-location-artifact.ts`; then run a `next start`-equivalent home/category/detail probe with `public/generated/location-data.json` and external data sources blocked. Record exact non-zero/zero outcomes and artifact evidence in `specs/023-location-data-pages/quickstart.md`
- [X] T068 [Q21] Parent-owned final verification: reconcile Q21 coverage across `specs/023-location-data-pages/spec.md`, `specs/023-location-data-pages/plan.md`, `specs/023-location-data-pages/research.md`, `specs/023-location-data-pages/data-model.md`, `specs/023-location-data-pages/contracts/location-pages.md`, `specs/023-location-data-pages/quickstart.md`, `specs/023-location-data-pages/tasks.md`, and `specs/023-location-data-pages/deletion-ledger.md`, then rerun the full required test/type/lint/build checks

**Checkpoint**: Q21追加対応後の成功ビルドに検証済み場所データ生成物が含まれ、必須ソースの失敗でビルドが停止する。runtimeのホーム・カテゴリ・詳細ページは生成物だけを使い、外部データ要求なしでURLの`origin`並べ替えを継続できる。T068をrelease gateとする。

---

## Phase 10: レビュー指摘対応 — UI・エラー・設定・町字順

**Purpose**: 023仕様PRのレビューで判明した視覚・意味論・運用境界・表示順の差分を、公開契約テストを先に追加してから補正する。

**Correction boundary**: T069/T071/T073/T075/T083/T085/T087/T089は互いに書込ファイルが重ならないRED章である。各章の直後のreview taskが`SUBAGENT_STATUS: COMPLETE`かつ`VERDICT: PASS`になるまで、対応する本番ファイルを変更しない。レビュー後のテスト変更は旧verdictを無効にする。

### RED tests and fresh reviews

- [X] T069 [P] [US5] [RED] ルートの「よく利用される施設から選択」と同じ`tabs tabs-box` / `tab text-base px-4 text-base-content ruby-text gap-0`の視覚クラス、`並べ替え`Cardタイトル、通常リンク・tab role不使用・既存レスポンシブ条件を公開DOM契約として追加し、`src/components/features/__tests__/LocationCategoryNavigation.test.tsx`と`src/app/locations/[category-id]/__tests__/page.visual-contract.test.tsx`に記録する
- [X] T070 [US5] [correction-review] T069の変更後テストだけをread-onlyでレビューし、視覚クラス、Card階層・順序、通常リンク、禁止されたtab semantics、負の契約が仕様を過不足なく表すことを確認して`SUBAGENT_STATUS: COMPLETE`と`VERDICT: PASS`を報告する。書込先は持たない
- [X] T071 [P] [US3] [RED] GPS拒否・タイムアウト・未対応・無効な`origin`のエラーが`role="alert"`、DaisyUI`alert-soft`、視認可能な「エラー」タイトル、具体的な日本語説明を持ち、色だけに依存しないことを`src/components/features/__tests__/LocationSortControls.test.tsx`で公開境界テストにする
- [X] T072 [US3] [correction-review] 初回レビューは無効originのrouter非呼出しassertion不足を検出してBLOCK。補正T083と再レビューT084/T088で不足を解消し、最終ゲートはPASSとした。書込先は持たない
- [X] T073 [P] [US3] [RED] `app-config.json`欠落時のビルド失敗、exampleからの自動生成なし、CIだけの明示的コピーを、script/package/Docker/CIの公開境界で検出するテストとして`src/app/__tests__/app-config-build-boundary.test.ts`と`scripts/__tests__/ensure-app-config.test.ts`へ追加する
- [X] T074 [US3] [correction-review] T073の変更後テストだけをread-onlyでレビューし、実際のcwd・プロセス終了コード・ファイル未生成・package/Docker/CIの責務分離を検証して`SUBAGENT_STATUS: COMPLETE`と`VERDICT: PASS`を報告する。書込先は持たない
- [X] T075 [P] [US5] [RED] 町字グループが表示用町字文字列の`localeCompare`昇順で並び、同一町字内の場所順を入力順で維持する公開ページ契約を`src/app/locations/[category-id]/__tests__/page.town-order-contract.test.tsx`へ追加する
- [X] T076 [US5] [correction-review] T075の変更後テストだけをread-onlyでレビューし、入力順依存の実装を検出する代表fixtureと、距離帯順を壊さない境界を確認して`SUBAGENT_STATUS: COMPLETE`と`VERDICT: PASS`を報告する。書込先は持たない

### Production implementation after review gates

- [X] T083 [US3] [RED-CORRECTION] T072の指摘を受け、無効な`origin`を実際のブラウザURLへ設定したうえで、エラー表示後もURLと`origin`を保持することを`src/components/features/__tests__/LocationSortControls.test.tsx`だけで追加検証する。productionファイルは変更しない
- [X] T084 [US3] [correction-review] T083の最終テストバイトだけをfresh read-onlyでレビューし、実URL保持・町字fallback・alert意味論・非fetchを公開境界で検出することを確認して`SUBAGENT_STATUS: COMPLETE`と`VERDICT: BLOCK`を報告したため、T087/T088で再補正・再レビューを行った。書込先は持たない
- [X] T085 [P] [US3] [RED-CORRECTION] FR-044の場所データ／invalid originのページレベルalertについて、実際のカテゴリ公開ページ境界で`role="alert"`、`alert alert-error alert-soft text-base-content!`、視認可能な「エラー」タイトル、具体的な説明を検証するテストを`src/app/locations/[category-id]/__tests__/page.error-contract.test.tsx`へ新規追加する。productionファイルは変更しない
- [X] T086 [US3] [correction-review] T085のテストだけをfresh read-onlyでレビューし、カテゴリ公開ページのdata errorとinvalid origin errorを実装詳細に依存せず検出することを確認して`SUBAGENT_STATUS: COMPLETE`と`VERDICT: PASS`を報告する。書込先は持たない
- [X] T087 [US3] [RED-CORRECTION] T084の指摘を受け、実際のブラウザURLに無効originを保持した状態で`mockRouterReplace`が呼ばれないことを`src/components/features/__tests__/LocationSortControls.test.tsx`へ追加assertionする。productionファイルは変更しない
- [X] T088 [US3] [correction-review] T087の最終テストバイトだけをfresh read-onlyでレビューし、無効originのURL保持・町字fallback・router非呼出し・非fetch・alert意味論を確認して`SUBAGENT_STATUS: COMPLETE`と`VERDICT: PASS`を報告する。書込先は持たない
- [X] T089 [P] [US5] [RED] 「近い順に並べる」操作が既存のプライマリーカラーButtonスタイル（`btn btn-primary`、44px操作領域、可視フォーカス）を公開DOMで持つことを`src/components/features/__tests__/LocationSortControls.visual-contract.test.tsx`へ追加する。productionファイルは変更しない
- [X] T090 [US5] [correction-review] T089の最終テストだけをfresh read-onlyでレビューし、プライマリーカラー、操作領域、focus-visible、既存操作名と機能契約を過不足なく検出して`SUBAGENT_STATUS: COMPLETE`と`VERDICT: PASS`を報告する。書込先は持たない

- [X] T077 [US5] T070、T086、T088、T090の`VERDICT: PASS`後、カテゴリナビゲーションをルートの`CategoryTabs`視覚クラスへ合わせ、並べ替えCardタイトルを「並べ替え」に変更する。通常リンク、`aria-current`、flex-wrap、44px操作領域、focus-visible、GPS/URL契約は維持し、`src/components/features/LocationCategoryNavigation.tsx`と`src/app/locations/[category-id]/page.tsx`を更新する
- [X] T091 [US5] T090の`VERDICT: PASS`後、既存の共通`Button`を使って「近い順に並べる」操作をプライマリーカラーButtonへ統一し、GPS成功/失敗・既存origin維持・町字fallbackを変更しない`src/components/features/LocationSortControls.tsx`を更新する
- [X] T078 [US3] T086、T088、T091の`VERDICT: PASS`後、GPS・invalid origin・必要な場所データエラーを`alert alert-error alert-soft text-base-content!`と視認可能な「エラー」タイトルを持つ意味論的なalertへ統一し、GPS成功/失敗・既存origin維持・町字fallbackを変更せず`src/components/features/LocationSortControls.tsx`、`src/app/locations/[category-id]/page.tsx`、`src/app/locations/page.tsx`、`src/app/locations/location-detail/[id]/page.tsx`を更新する
- [X] T079 [US3] T074の`VERDICT: PASS`後、`app-config.json`の存在確認を欠落時非ゼロ終了へ変更し、npm lifecycleとDockerfileがexampleをコピーしないようにし、CI workflowが必要時だけ明示コピーする責務へ移す。`AGENTS.md`、`scripts/ensure-app-config.mjs`、`package.json`、`Dockerfile.dev`、`Dockerfile.prod`、`.github/workflows/quality-gate.yml`、`README.md`、`docs/manual/analytics.md`、`.env.local.example`を更新する
- [X] T080 [US5] T076、T077、T078の`VERDICT: PASS`後、表示用町字名の比較結果で地域グループを安定ソートし、距離表示の昇順・同距離順・町字内の入力順を維持する`src/app/locations/[category-id]/page.tsx`を更新する
- [X] T092 [US5] [RED-CORRECTION] T080後に旧挿入順を期待して失敗する既存の町字順assertionを新仕様の表示用町字`localeCompare`順へ更新し、同一町字内の入力順・距離帯順の検証を弱めない`src/app/locations/[category-id]/__tests__/page.test.tsx`だけを修整する
- [X] T093 [US5] [correction-review] T092のテスト変更だけをfresh read-onlyでレビューし、旧期待値の単純な置換に留まらず町字順の公開契約と同一町字内・距離帯の負の境界を維持していることを確認し、`SUBAGENT_STATUS: COMPLETE`と`VERDICT: PASS`を報告する。書込先は持たない
- [X] T081 Run focused GREEN suites for T069/T071/T073/T075/T083/T085/T087/T089/T092, then strict TypeScript, scoped lint, `git diff --check`, and the relevant browser DOM/error/config/町字順 checks; parent verifies no unrelated route-form behavior changed
- [X] T082 Parent-owned final correction verification: reconcile T069–T093 against `spec.md`、`plan.md`、`research.md`、`contracts/location-pages.md`、`quickstart.md`、`tasks.md`、production-only negative searches, run the full required test/type/lint/build checks, and record exact results before marking the correction tasks `[X]`

**Checkpoint**: カテゴリナビゲーションと並べ替えCardがルートの視覚語彙に揃い、各エラーがタイトル付き`alert-soft`で伝わり、設定欠落が自動生成なしでビルド失敗し、町字グループが文字列順に表示される。既存のURL/GPS、距離帯、詳細、route-form契約は維持される。

---

## Requirement Traceability

The mappings below are explicit planning traceability. The task descriptions remain independently executable; the IDs make coverage review deterministic. `[correction-review]` tasks are cross-cutting evidence gates for their immediately preceding RED correction and inherit that correction's requirement/story coverage.

| Requirement range | Covering tasks |
|---|---|
| FR-001–FR-002 | T006–T009, T028–T032, T044, T057, T060–T068 |
| FR-003–FR-005 | T010–T017, T045–T049 |
| FR-006–FR-008 | T018–T024 |
| FR-009–FR-011 | T018–T027 |
| FR-012 | T028–T032 |
| FR-013–FR-016 | T006–T009, T033–T044, T048, T060–T068 |
| FR-017–FR-019 | T003, T010–T017, T045–T049 |
| FR-020–FR-021 | T003, T033–T039 |
| FR-022–FR-023 | T033–T044, T045–T049 |
| FR-024–FR-026 | T003, T033–T039, T045–T049 |
| FR-027–FR-032 | T045–T049, T052A–T052H, T057 |
| FR-033–FR-039 | T018–T024, T045–T049, T052A–T052H, T057 |
| FR-040 | T060–T068 |
| FR-041 | T006–T009, T060–T068 |
| FR-042–FR-043 | T069–T070, T077, T089–T091, T081–T082 |
| FR-044 | T071–T072, T078, T083–T088, T081–T082 |
| FR-045 | T073–T074, T079, T081–T082 |
| FR-046 | T075–T076, T080, T092–T093, T081–T082 |

| Success criteria range | Covering tasks |
|---|---|
| SC-001–SC-004 | T006–T017, T018–T027, T028–T032, T045–T049, T057, T060–T068 |
| SC-005–SC-006 | T018–T024, T028–T032 |
| SC-007–SC-008 | T033–T052, T057 |
| SC-009–SC-011 | T001–T002, T025–T027, T040–T052, T053–T059 |
| SC-012–SC-013 | T003, T033–T039, T057 |
| SC-014–SC-017 | T052A–T052H, T057 |
| SC-018–SC-020 | T018–T024, T052A–T052H, T057 |
| SC-021 | T060–T068 |
| SC-022 | T069–T093 |

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: no implementation dependency; freezes baseline and creates the deletion ledger
- **Phase 2 Foundational**: depends on Setup and establishes the pre-Q21 URL, server-data, error, and pure-helper contracts. It does not claim that the final generated-artifact boundary is complete.
- **Phase 3 US1**: depends on Foundational; establishes server category route and navigation
- **Phase 4 US2**: depends on Foundational and the pre-Q21 server data boundary; uses US1 route/navigation contracts. Q21 later replaces its runtime source with the generated artifact reader.
- **Phase 5 US3**: depends on Foundational and the pre-Q21 server data boundary; home injection may proceed before Q21, while T065 is the release-blocking artifact-reader replacement.
- **Phase 6 US4**: depends on US1–US3 replacement behavior so obsolete navigation/state deletion is evidence-based
- **Phase 7 US5**: depends on the settled US1–US4 route, navigation, and data contracts; its RED suite must pass review before visual implementation
- **Phase 8 Pre-Q21 polish**: depends on US1–US5 and all deletion gates; its verification is an intermediate checkpoint because Q21 was added afterward.
- **Phase 9 Q21追加対応**: depends on the settled location-page and UI contracts, supersedes pre-Q21 runtime loaders/fallbacks, and blocks final release verification until build generation, build-failure injection, runtime artifact-only reads, and no-network evidence are GREEN
- **Phase 10 レビュー指摘対応**: depends on the Q21 release boundary; each correction RED chapter must pass its immediately following fresh read-only review before its production task, and T082 is the parent-owned final correction gate

### User Story Dependencies

- **US1 (P1)**: foundation only; MVP route/category slice
- **US2 (P1)**: foundation + pre-Q21 server category data; integrates with US1 URLs. The final artifact reader is delivered by Q21 T060–T068.
- **US3 (P1)**: foundation + pre-Q21 category data; integrates with US1 navigation and origin propagation. The final runtime data source is delivered by Q21 T065.
- **US4 (P2)**: follows the settled US1–US3 public UI contracts and owns final navigation/accessibility cleanup
- **US5 (P1)**: follows the settled US1–US4 public DOM contracts and uses `origin/dev` only as the visual reference; it must not reintroduce client tab state, address search, carousel UI, or runtime data fetching

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
- T052A–T052C can be authored in parallel because they cover distinct visual-contract test files; all three must complete before T052D.
- T054/T055 and T053 can run in parallel after all production edits stop.
- T060 and T063 must remain separate RED chapters: T063 starts only after the artifact shape/reader contract is settled, and each chapter requires its own fresh review (T061 and T064).
- T069、T071、T073、T075は書込ファイルが重ならないためRED作成を並列化できる。各章のreview（T070、T072、T074、T076）は対応章の完了後に直列実行し、T077–T080は該当reviewの`VERDICT: PASS`後に実行する。

## Implementation Strategy

### MVP first

1. Foundation: origin parser, build-artifact validation/read status, area/distance helpers.
2. US1: `/locations` first-category resolution, category pages, shared URL navigation, standard 404.
3. Stop and validate the category journey independently.

### Incremental delivery

1. Add US2 nested detail pages and delete the old route.
2. Add US3 server-injected popular data and GPS sort controls; delete address/name search logic. T065 later replaces this pre-Q21 source with the artifact reader.
3. Add US4 accessibility/error contracts and delete obsolete navigation/state paths.
4. Add US5 `origin/dev` visual/responsive contracts, validate all six widths, and stop for a visual regression checkpoint.
5. Complete the pre-Q21 deletion ledger and intermediate browser/test/type/lint/build checkpoint.
6. Apply the later Q21追加対応: generate and validate all location artifacts at build time, replace pre-Q21 runtime loaders, then prove runtime artifact-only reads and build failure on source errors.
7. Repeat the full release verification after Q21; the pre-Q21 checkpoint must not be reported as final completion.

## Notes

- `tasks.md` explicitly includes deletion-ledger, reference-census, replacement-test, negative-search, and verification tasks. There is no generic cleanup-only task.
- US5 explicitly records `origin/dev@7cbf0a5a57c66b0e8e114e28cc3871ab1f46fd15` and the component paths used for visual comparison; `CategoryTabs` is a visual reference only, not a behavior or state dependency.
- No production review task is added because the repository constitution assigns final production review to the parent; test-code review tasks remain blocking and explicit.
- A task that modifies tests or production files invalidates any prior review verdict for those bytes.
- Q21は仕様023へ後から追加された追補である。T003–T059の時点で実装が外部データローダーを使用していても、それ自体を仕様矛盾として扱わない。ただしT060–T068が完了するまでは、生成物だけを読む最終契約を満たしたことにしない。
- T022の`LocationCard`とT009のclient-side area helperは、後続の削除ゲートで不要と判定された中間実装である。視覚参照のために復活させず、最終的なカテゴリページのserver-rendered summaryを正とする。
