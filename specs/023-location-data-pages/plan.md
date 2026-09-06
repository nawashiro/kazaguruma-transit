# Implementation Plan: 場所データページのJavaScript削減

**Branch**: `023-location-data-pages` | **Date**: 2026-09-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/023-location-data-pages/spec.md`

## Summary

Issue #79の場所データ側を対象に、ブラウザ側の外部CDN取得とカテゴリの一時タブ状態を除去し、場所カテゴリ・場所詳細をURLとサーバー側データ境界で提供する。初期実装はSSR中心とし、SSGは必須にしない。

`/locations`はデータ順の先頭カテゴリへ解決する。カテゴリページは共通カテゴリナビゲーション、町字表示、GPSによる距離順表示を持つ。GPS座標は現在カテゴリの`origin=<latitude>,<longitude>`に置き、カテゴリ間では維持するが、詳細・その他ページでは破棄する。未知・不正なカテゴリ／詳細URLは通常404とし、CDN取得失敗・重複ID・不正データは別の日本語データエラーとして扱う。

ホームの「よく利用される施設」はサーバー側でデータを取得し、既存の経路検索フォームへシリアライズ可能なデータを渡す。経路検索フォーム自体の意味論的再設計は別feature・別PRで扱う。

## Technical Context

**Language/Version**: TypeScript 5 strict、React 19、Next.js 15 App Router、Node.js 22.x

**Primary Dependencies**: Next.js App Router、React Testing Library、Jest、Tailwind CSS 4、DaisyUI 5、Lucide、既存`addressLoader`、既存location resolver、既存のGeoJSON・距離計算ユーティリティ

**Storage**: 新規永続化なし。場所データは既存のversioned CDN、町字GeoJSONは既存CDN、GPS座標は現在カテゴリURLの一時queryだけで扱い、sessionStorage/localStorageへ保存しない。

**Testing**: Jest + React Testing Library、TypeScript noEmit、Next.js lint、`git diff --check`、必要な実ブラウザ確認、最終`npm run build`

**Target Platform**: モダンブラウザ上のNext.js App Router Webアプリ。GPS許可、キーボード操作、支援技術による通常ナビゲーションを対象とする。

**Project Type**: Next.js App Router Web application

**Performance Goals**:

- 場所データをブラウザから直接CDN取得しない。
- 有効な`origin`では、カテゴリ内の距離計算・並べ替えを1回のページ表示境界で完了する。
- カテゴリ間移動は同じ`origin`を保持し、追加の場所データAPIを発生させない。
- `/api/transit`等の既存API応答p95 200ms目標を変更しない。

**Constraints**:

- SSR/SSGの選択、キャッシュ・再検証の細部はplanの実装設計で選ぶが、ブラウザCDN取得は禁止する。
- 新しい場所データAPI、DB、キャッシュ永続化、Google Maps API呼び出しを追加しない。
- 住所・場所名検索と専用のgeocoding/rate-limit導線を場所ページから削除する。
- `origin`はカテゴリ間ナビゲーションだけで保持し、詳細・その他ページへ転送しない。
- 未知・不正URLは通常404、データ取得・検証失敗は404と別のデータエラーにする。
- 共通レイアウトの単一`main`、WCAG 2.2 AA目標、既存の目的地queryと経路検索契約を維持する。
- 既存のホーム経路フォームの責務と意味論的HTML再設計は変更しない。必要なserver/client分割は場所データ注入に限定する。

**Scale/Scope**:

- `/locations`入口、カテゴリ動的ページ、場所詳細動的ページ、共通カテゴリナビゲーション。
- ホームのよく利用される施設データ注入境界。
- GPS専用の並べ替え操作と`origin` URL契約。
- 住所・名前検索、距離検索用geocoding state、場所ページ専用rate-limit入口の削除。
- 新規永続化、経路検索結果、認証、Nostr、GTFSは対象外。

## Constitution Check

*GATE: Phase 0/1設計前に確認済み。設計後にも再確認する。*

| Gate | Result | 根拠 |
|---|---|---|
| Clear Naming | PASS | `LocationSourceResult`、`LocationOriginQuery`、`LocationSortMode`、`LocationCategoryNavigation`など、目的と状態を表す名前を使う。 |
| Simple Logic / KISS | PASS | 住所検索・Google Maps依存を削除し、GPS操作、URL解析、距離計算、表示を小さな境界へ分ける。 |
| Structured Organization | PASS | App Routerページ、server data boundary、client navigation/control、純粋なlocation utilityを分離する。UIはCDN/DBへ直接アクセスしない。 |
| Type Safety | PASS | `success/error`、`absent/valid/invalid`、`town/distance`、404/data-errorを明示した型で扱い、`any`を追加しない。 |
| Test-First Development | PASS | URL、404、データエラー、nav、GPS、origin伝播、sort controlsをRED→review→実装の順に固定する。 |
| Accessibility & UX | PASS | 通常の`nav`/`Link`、`aria-current`、2つの並べ替え操作、loading/error/status、日本語404、単一`main`を契約化する。 |
| Existing contracts | PASS | 既存`category:en`、`KeyLocation`、`calculateDistance`、`destination` query、`/routes` query順序を再利用する。 |
| Privacy boundary | PASS | GPSは明示操作のみ、座標は現在カテゴリURLに限定し、永続化・詳細/その他ページへの自動転送を行わない。 |
| Standard error boundary | PASS | URL不在は通常404、データ破損・transport failureはデータエラーとして分離する。 |

## Project Structure

### Documentation (this feature)

```text
specs/023-location-data-pages/
├── spec.md
├── checklists/requirements.md
├── plan.md
├── research.md
├── data-model.md
├── contracts/location-pages.md
├── quickstart.md
├── deletion-ledger.md             # T001/T002で作成・更新
└── tasks.md                    # /speckit-tasksで生成。planでは作成しない
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── page.tsx                              # server wrapper: popular data injection
│   ├── locations/
│   │   ├── layout.tsx                         # shared category navigation boundary
│   │   ├── page.tsx                           # first-category redirect/error boundary
│   │   ├── loading.tsx                        # locations loading boundary
│   │   ├── [category-id]/
│   │   │   ├── page.tsx                       # server category page + origin sorting
│   │   │   ├── loading.tsx
│   │   │   └── __tests__/page.test.tsx
│   │   ├── location-detail/[id]/
│   │   │   ├── page.tsx                       # server detail page
│   │   │   ├── loading.tsx
│   │   │   └── __tests__/page.test.tsx
│   │   └── __tests__/page.test.tsx            # entry redirect/data error contract
│   └── location-detail/[id]/                  # removed old canonical route; no compatibility alias
├── components/features/
│   ├── HomeRouteForm.tsx                      # extracted client interaction only
│   ├── LocationSuggestions.tsx                # client selection, receives server data
│   ├── LocationCard.tsx                       # server-safe summary link
│   ├── LocationCategoryNavigation.tsx         # minimal URL-aware nav client island
│   ├── LocationSortControls.tsx               # GPS action + two sort controls
│   └── __tests__/
│       ├── LocationCategoryNavigation.test.tsx
│       ├── LocationSortControls.test.tsx
│       └── LocationSuggestions.test.tsx
├── lib/location/
│   ├── location-page-data.ts                  # server data aggregation/status boundary
│   ├── location-origin-query.ts               # pure origin parsing/serialization
│   ├── location-list-state.ts                 # retained pure distance helpers; geocode removed
│   └── __tests__/
│       ├── location-page-data.test.ts
│       └── location-origin-query.test.ts
├── utils/
│   ├── addressLoader.ts                       # status-preserving popular/key loader
│   ├── clientGeoUtils.ts                      # pure area helpers; server fetch boundary moved
│   └── __tests__/addressLoader.test.ts
└── app/__tests__/
    └── location-pages-404.test.ts             # standard 404 vs data error boundary
```

**Structure Decision**: Keep one Next.js App Router project. Server pages own data loading, route validation, 404/data-error classification, and sorted output. Small client islands own only URL-aware category-link construction and explicit browser GPS interaction. Existing home route logic is moved behind a server data-injection wrapper without redesigning its form behavior.

## Phase 0 Research Summary

Phase 0の成果は[research.md](./research.md)に記録した。

- SSR中心: `origin` queryでカテゴリ表示が変わるため、server pageで検証・距離計算・HTML生成を行う。
- `/locations`: 空でないデータの先頭カテゴリへ解決。unknown routeは通常404。
- `origin`: category-to-categoryでは保持、detail/other/default resetでは破棄。invalidはerror + town list。
- GPS: explicit click only、Google Maps/geocodingなし、再取得失敗時は既存distance viewを維持。
- Data boundary: CDN/GeoJSON failureを空成功にしない。duplicate/malformed dataは404と分離。
- Navigation: `DiscussionManagementTabLayout`を参照しつつ、通常`nav`/`Link`/`aria-current`で最小client boundaryにする。

## Phase 1 Design

### 1. Server location data boundary

1. `loadKeyLocationsDataResult()`のstatus-preserving契約をカテゴリ・詳細の共通入口として使う。
2. `main_facilities.json`用に同じ原則の`loadAddressDataResult()`を追加し、ホームのclient componentへシリアライズ可能なcategoriesを渡す。
3. GeoJSONのfetchをサーバー側境界へ移し、既存の純粋なpolygon/area grouping関数を再利用する。Next fetch cache以外の永続化は追加しない。
4. データ検証、カテゴリID解決、場所ID重複検出、origin parseをページから独立したpure/server helperへ置く。

### 2. Route topology and errors

1. `/locations`は共通loaderでカテゴリを取得し、先頭カテゴリへ解決する。0件・transport/data failureはデータエラーとして表示する。
2. `/locations/[category-id]`は`category:en`をURL decodeして解決し、unknown/empty/malformed IDはNextの標準404境界へ送る。
3. `/locations/location-detail/[id]`は既存resolverを再利用し、unknown/invalid request IDは標準404、duplicate/invalid data/data-load-errorは日本語データエラーにする。
4. 旧`/location-detail/[id]`は削除し、compatibility redirectは追加しない。
5. 詳細のcategory back linkは`origin`を含めず、表示元カテゴリの正規pathへ戻す。

### 3. Category navigation and origin

1. `LocationCategoryNavigation`はカテゴリ名、encoded href、current stateを受け取り、`nav`と通常`Link`を描画する。
2. `usePathname`/`useSearchParams`を使うclient境界はnavリンクのactive/origin処理だけに限定する。場所データfetch・sortは行わない。必要な境界は`Suspense`で包む。
3. current URLのoriginがvalidならカテゴリ間リンクへ保持する。invalidなら保持せず、現在ページだけがエラー＋town listとなる。
4. `/locations`入口、detail/other links、町字リセットはqueryなしhrefを生成する。
5. visual tabs stylingを使っても、普通のsite navigationとして`aria-current="page"`を主契約にし、role tablistの独自roving focusを場所ページへ新規導入しない。`/discussions`はactive state/keyboard確認の参照とする。

### 4. Sort controls and GPS

1. `LocationSortControls`はカテゴリnav直下に「町字で並べる」「近い順に並べる」を表示し、current modeをstatus/ARIAで伝える。
2. 「町字で並べる」はcurrent category pathへのqueryなし通常リンクとする。
3. 「近い順に並べる」は明示クリックで`navigator.geolocation`を呼び、成功した座標をlat,lng順でcurrent pathの`origin`へ直列化し、replace相当のGET遷移を行う。
4. GPS失敗時、originなしならtown listを維持し、originありなら既存distance listとoriginを維持し、エラーだけ表示する。
5. server pageはoriginを有限数値として検証する。行政区域外の数値は受け入れ、解釈不能値はerror + town listにする。
6. 住所・名前入力、Google Maps/geocode、専用rate-limit stateは削除する。

### 5. Home popular data injection

1. `src/app/page.tsx`をserver wrapperにし、`main_facilities.json`をサーバー側で取得する。
2. 現在のinteractive formを`HomeRouteForm`などのclient childへ移し、popular categories/location dataをserializable propsとして渡す。
3. `DestinationSelector`/`LocationSuggestions`はデータ取得を行わず、既存callbackで選択場所を親へ返す。
4. destination JSON query、route form state、`/routes` query serializationは変更しない。

### 6. Standard 404 and data-error tests

1. unknown/empty/malformed category path and detail ID must assert standard not-found response, not a feature-specific error panel.
2. loader HTTP/JSON failure, duplicate ID, required-field failure must assert data-error state distinct from 404.
3. direct, reload, category navigation, detail navigation, and `origin` propagation/deletion are contract tests.
4. no client CDN fetch is asserted with browser/network or loader-boundary tests.

## Implementation Sequence (for tasks phase)

1. RED tests for origin parsing, category ID resolution, standard 404 vs data error, and first-category redirect; fresh test-code review.
2. RED tests for server data boundary, area grouping, distance sort, `origin` propagation/deletion; fresh test-code review.
3. Implement server data boundary and pure query/sort helpers; run focused GREEN and parent-owned production verification.
4. RED tests and implementation for shared category navigation, standard 404, category page, and sort controls; each test chapter gets its review gate.
5. RED tests and implementation for old route removal/detail path, detail data/error states, and detail links; fresh review gates.
6. RED tests and implementation for home popular-data server injection while preserving existing route form behavior; fresh review gate.
7. Execute the obsolete-logic removal gate below. Each deletion candidate is an explicit bounded task with a production-consumer census, replacement test evidence, deletion, negative search, and focused verification. Do not hide multiple deletions in one generic cleanup task.
8. Run full Jest, TypeScript, lint, browser acceptance, `git diff --check`, and build. Generate `tasks.md` only after this plan is accepted.

## Obsolete Logic Removal Gate

Removing old behavior is part of this feature, not optional polish. The constitution's KISS and no-backward-compatibility principles require the implementation to delete superseded paths instead of adding a second implementation beside them.

### Plan-owned inventory

During task generation, create a deletion ledger with one row per candidate:

| Candidate | Replacement | Keep/delete decision | Required evidence |
|---|---|---|---|
| Old `/location-detail/[id]` route and compatibility-shaped tests | `/locations/location-detail/[id]` + standard 404 | Delete | Runtime consumer search, route tests, negative route search |
| `/locations` client CDN fetch and local category-tab state | Server category pages + shared URL navigation | Delete/replace | Browser network evidence, nav tests, no client loader import |
| Location-page name/address search, `geocodeAddress`, related state, rate-limit branch | GPS-only sort controls | Delete | Production consumer census, GPS tests, no location-page geocode references |
| Old distance/location-list orchestration that is not used by the new server boundary | Server page data + pure distance helpers | Delete selectively | Import graph, focused tests, no runtime consumers |
| Client-only area lookup fallback in location cards | Server-provided area grouping | Delete or retain only for a verified consumer | Consumer census and typecheck |
| `CategoryTabs` location-page usage | `LocationCategoryNavigation` | Remove usage; delete component only if no other production consumer remains | Production-only reference search |

The ledger must distinguish **delete**, **move/reuse**, **retain**, and **out of scope**. It must not classify a path as obsolete merely because a similarly named replacement exists.

### Per-candidate deletion protocol

Each cleanup slice in `tasks.md` must follow this order:

1. **Reference census**: search production code (excluding tests, fixtures, comments, and historical docs) for imports, route registrations, callbacks, styles, and runtime consumers of the candidate. Record every consumer and the replacement owner.
2. **Replacement contract**: add or settle the public-boundary regression test for the replacement behavior. Run it RED before deleting the old path when the behavior is new or changed.
3. **Fresh test review**: obtain the required read-only test-code review before production deletion. A later test edit invalidates that review.
4. **Delete, do not alias**: remove the obsolete file, import, state branch, route, modal/API branch, or compatibility fallback. Do not add redirects, duplicate routes, hidden flags, or dead fallback code merely to preserve the old path.
5. **Negative search**: rerun a production-only search for the old symbol, route, API branch, state name, and import path. Test-only references must be intentionally updated or explicitly documented.
6. **Verification**: run the focused RED→GREEN suite, strict TypeScript, scoped lint, `git diff --check`, and the relevant browser/network probe. Record deleted paths and proof that no route-form consumer was removed accidentally.

### Task/review requirement

`tasks.md` must contain explicit cleanup tasks for every deletion-ledger row that resolves to delete or remove-usage. It must not contain only a final "clean up unused code" task. Each RED test chapter is immediately followed by its fresh test-code review task. After each production deletion group, the parent owns fresh production verification of the negative search and focused GREEN result; this is not a separate production-review task in `tasks.md`.

## Constitution Re-check after Phase 1 design

| Gate | Result | Evidence |
|---|---|---|
| Clear naming | PASS | `LocationSourceResult`, `LocationOriginQuery`, `LocationSortMode`, and `LocationCategoryNavigation` express intent. |
| Simple logic / KISS | PASS | Address search and API dependency are removed; server data, URL parsing, GPS control, and presentation have small boundaries. |
| Structured organization | PASS | App Router pages, server data boundary, client navigation/control, and pure location helpers are separated. |
| Type safety | PASS | Status unions, finite coordinate validation, route identifiers, and sort modes are explicit. |
| Test-first | PASS | Every route/query/error/navigation chapter precedes implementation and has a fresh test review gate. |
| Accessibility & UX | PASS | Standard 404, native navigation, `aria-current`, two sort controls, Japanese status/errors, and single main are planned. |
| Privacy boundary | PASS | Coordinates are explicit URL state only for current/category navigation, never persisted or sent to detail/other pages. |
| Existing contract preservation | PASS | Route search, destination query, data version, detail content meaning, and existing distance/area calculation are reused. |
| Complexity tracking | PASS | No constitution violations. The only client code is the minimal URL-aware nav/GPS boundary required by the clarified URL contract. |

## Complexity Tracking

No constitution violation requiring justification. The SSR page boundary and two small client islands are the minimum complexity required to preserve URL-based distance sorting while keeping browser-side data fetching and address search removed.
