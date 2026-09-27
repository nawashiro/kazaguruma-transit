# Implementation Plan: 場所データページのJavaScript削減

**Branch**: `023-location-data-pages` | **Date**: 2026-09-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/023-location-data-pages/spec.md`

## Summary

Issue #79の場所データ側を対象に、ブラウザ側および実行時サーバーの外部データ取得とカテゴリの一時タブ状態を除去し、ビルド時に取得・検証した場所データ生成物を正本として、場所カテゴリ・場所詳細をURLから提供する。ページは`origin`に応じて実行時に表示を変えてよいが、入力データは生成物に限定する。

`/locations`はデータ順の先頭カテゴリへ解決する。カテゴリページは共通カテゴリナビゲーション、町字表示、GPSによる距離順表示を持つ。GPS座標は現在カテゴリの`origin=<latitude>,<longitude>`に置き、カテゴリ間では維持するが、詳細・その他ページでは破棄する。未知・不正なカテゴリ／詳細URLは通常404とし、ビルド時のCDN取得・重複ID・不正データは公開用ビルドを失敗させ、ビルド後の生成物欠落・破損だけを日本語データエラーとして扱う。

ホームの「よく利用される施設」はビルド生成物から読み、既存の経路検索フォームへシリアライズ可能なデータを渡す。経路検索フォーム自体の意味論的再設計は別feature・別PRで扱う。

**Q21追加対応の位置づけ**: Q21は初期の場所ページ作業後に追加された追補である。T003–T059は既存のserver-side data boundaryを前提にURL・ページ・UI・削除契約を整える前段、T060–T068はそのruntime loader／fallbackをビルド生成物readerへ置き換える後段とする。したがって、T003–T059の実装が最終Q21境界にまだ到達していないことは、現時点の実装差異として扱い、計画上の仕様矛盾とは扱わない。公開完了の判定だけはT068後に行う。

## Technical Context

**Language/Version**: TypeScript 5 strict、React 19、Next.js 15 App Router、Node.js 22.x

**Primary Dependencies**: Next.js App Router、React Testing Library、Jest、Tailwind CSS 4、DaisyUI 5、Lucide、既存`app-config`/`addressLoader`、既存location resolver、既存のGeoJSON・距離計算ユーティリティ

**Storage**: 新規永続化なし。場所データと町字GeoJSONはビルド生成物へ固定し、GPS座標は現在カテゴリURLの一時queryだけで扱い、sessionStorage/localStorageへ保存しない。実行時のCDN・データ提供元取得は行わない。

**Testing**: Jest + React Testing Library、TypeScript noEmit、Next.js lint、`git diff --check`、必要な実ブラウザ確認、最終`npm run build`

**Target Platform**: モダンブラウザ上のNext.js App Router Webアプリ。GPS許可、キーボード操作、支援技術による通常ナビゲーションを対象とする。

**Project Type**: Next.js App Router Web application

**Performance Goals**:

- 場所データをブラウザから直接CDN取得しない。
- ビルド時に場所データ・町字GeoJSONを取得・検証し、失敗時は公開用ビルドを非ゼロ終了させる。成功後の実行時外部取得は0件にする。
- 有効な`origin`では、カテゴリ内の距離計算・並べ替えを1回のページ表示境界で完了する。
- カテゴリ間移動は同じ`origin`を保持し、追加の場所データAPIを発生させない。
- `/api/transit`等の既存API応答p95 200ms目標を変更しない。

**Constraints**:

- 場所データの取得・検証はビルド工程に固定し、ビルド成功後はカテゴリ・詳細・ホームがビルド生成物だけを参照する。ページの静的・動的描画方式の選択はこのデータ境界を変更してはならず、`origin`による実行時計算だけを許可する。
- 新しい場所データAPI、DB、キャッシュ永続化、Google Maps API呼び出しを追加しない。
- 住所・場所名検索と専用のgeocoding/rate-limit導線を場所ページから削除する。
- `origin`はカテゴリ間ナビゲーションだけで保持し、詳細・その他ページへ転送しない。
- 未知・不正URLは通常404、ビルド時のデータ取得・検証失敗は公開用ビルド失敗、ビルド後の生成物欠落・破損は404と別のデータエラーにする。
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
| Structured Organization | PASS | ビルド時データ生成、生成物読み取り、App Routerページ、client navigation/control、純粋なlocation utilityを分離する。UIとランタイムページはCDN/DBへアクセスしない。 |
| Type Safety | PASS | `success/error`、`absent/valid/invalid`、`town/distance`、404/data-errorを明示した型で扱い、`any`を追加しない。 |
| Test-First Development | CONDITIONAL | URL、404、データエラー、nav、GPS、origin伝播、sort controls、Q21生成物境界をRED→fresh review→実装の順に固定する。補正RED後のT004B、T007B、T013B、T020C、T029B、T034B、T047Bは未完了であり、次の実装受入れ前に証跡を取得する。 |
| Accessibility & UX | PASS | 通常の`nav`/`Link`、`aria-current`、2つの並べ替え操作、loading/error/status、日本語404、単一`main`を契約化する。 |
| Existing contracts | PASS | 既存`category:en`、`KeyLocation`、`calculateDistance`、`destination` query、`/routes` query順序を再利用する。 |
| Privacy boundary | PASS | GPSは明示操作のみ、座標は現在カテゴリURLに限定し、永続化・詳細/その他ページへの自動転送を行わない。 |
| Standard error boundary | PASS | URL不在は通常404、ビルド時のデータ取得・検証失敗はビルド失敗、ビルド後の生成物破損はデータエラーとして分離する。 |

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
│   │   ├── layout.tsx                         # common locations shell/error boundary; no category nav
│   │   ├── page.tsx                           # first-category redirect/error boundary
│   │   ├── loading.tsx                        # locations loading boundary
│   │   ├── [category-id]/
│   │   │   ├── layout.tsx                     # category-only navigation boundary
│   │   │   ├── page.tsx                       # server category page + origin sorting
│   │   │   ├── loading.tsx
│   │   │   └── __tests__/page.test.tsx
│   │   ├── location-detail/[id]/
│   │   │   ├── page.tsx                       # server detail page
│   │   │   ├── loading.tsx
│   │   │   └── __tests__/page.test.tsx
│   │   └── __tests__/page.test.tsx            # entry redirect/data error contract
│   ├── __tests__/
│   │   ├── location-pages-404.test.ts         # standard 404 vs data error boundary
│   │   └── location-runtime-no-network.test.tsx # final artifact-only runtime contract
│   └── location-detail/[id]/                  # removed old canonical route; no compatibility alias
├── components/features/
│   ├── HomeRouteForm.tsx                      # extracted client interaction only
│   ├── LocationSuggestions.tsx                # client selection, receives server data
│   ├── LocationCategoryNavigation.tsx         # minimal URL-aware nav client island
│   ├── LocationSortControls.tsx               # GPS action + two sort controls
│   └── __tests__/
│       ├── LocationCategoryNavigation.test.tsx
│       ├── LocationSortControls.test.tsx
│       └── LocationSuggestions.test.tsx
├── lib/location/
│   ├── location-page-data.ts                  # generated-artifact aggregation/status boundary
│   ├── location-artifact.ts                   # generated artifact reader and runtime data contract
│   ├── location-origin-query.ts               # pure origin parsing/serialization
│   ├── location-list-state.ts                 # retained pure distance helpers only; list state/geocode removed
│   └── __tests__/
│       ├── location-page-data.test.ts
│       ├── location-artifact.test.ts
│       └── location-origin-query.test.ts
├── utils/
│   ├── addressLoader.ts                       # source validation helpers; not a runtime page data entry
│   ├── geoUtils.ts                            # pure geometry/area helpers over generated data
│   └── __tests__/addressLoader.test.ts
```

The build-artifact boundary uses these repository paths:

```text
scripts/
├── generate-location-artifact.ts               # build-time acquisition, validation, and artifact writer
└── __tests__/generate-location-artifact.test.ts
public/generated/
└── location-data.json                          # build output; not a tracked source file
```

**Structure Decision**: Keep one Next.js App Router project. The final Q21 build-time data-generation boundary owns external acquisition, validation, GeoJSON region derivation, and artifact creation; after T060–T068, pages read only that artifact. T003–T059 may use the existing server-side loader as a pre-Q21 migration boundary, but that intermediate state is not the release contract. App Router pages own route validation, 404/data-error classification, and runtime sorted output over the artifact. Small client islands own only URL-aware category-link construction and explicit browser GPS interaction. Existing home route logic is moved behind a generated-data injection wrapper without redesigning its form behavior.

## Phase 0 Research Summary

Phase 0の成果は[research.md](./research.md)に記録した。

- Build artifact中心: 外部データの取得・検証・GeoJSON地域導出をビルド工程で行い、ページは生成物だけを読む。`origin`の距離計算は生成物を入力として実行時に行う。
- `/locations`: 空でないデータの先頭カテゴリへ解決。unknown routeは通常404。
- `origin`: category-to-categoryでは保持、detail/other/default resetでは破棄。invalidはerror + town list。
- GPS: explicit click only、Google Maps/geocodingなし、再取得失敗時は既存distance viewを維持。
- Data boundary: CDN/GeoJSON failure、duplicate/malformed dataはビルド失敗とし、ビルド成功後の生成物欠落・破損はCDNへフォールバックせずデータエラーにする。404とは分離する。
- Navigation: `DiscussionManagementTabLayout`を参照しつつ、通常`nav`/`Link`/`aria-current`で最小client boundaryにする。

## Phase 1 Design

### 1. Build-time location data generation boundary

1. ビルド工程に、`appConfig`（設定ファイルは`app-config.json`）の`mainFacilitiesUri`、`keyLocationsUri`、`townGeoJsonUri`から各データソースを取得する専用入口を置き、HTTP、JSON/GeoJSON形状、必須フィールド、空カテゴリ、重複IDを検証する。取得URIをコードへハードコードしない。T003–T059の既存loaderはこの入口へ移行する前段であり、最終runtime入口ではない。
2. いずれかの取得・検証が失敗した場合は例外をビルドへ伝播させ、空・不完全・古い生成物を公開成功として残さない。
3. 座標からGeoJSON地域を導出し、表示用地域名の接頭辞除去を適用した場所ページ用生成物を作成する。`key_locations.json`へ`area`は追加しない。
4. カテゴリ・詳細・ホームのランタイム入口は生成物を読み、CDN、GeoJSON CDN、旧データ源へフォールバックしない。`origin`のparse・距離計算だけは生成物を入力として実行時に行う。
5. データ検証、カテゴリID解決、場所ID重複検出、origin parseをページから独立したpure/build/runtime helperへ置く。

ソース別のビルド時検証契約は次のとおりとする。

| ソース | 必須条件 | 任意項目の扱い |
|---|---|---|
| `main_facilities.json` | カテゴリの`category`、`category:en`、空でない`locations`。各施設の`name`、有限な`lat`/`lng`、`copyright`、`licence`、`licenceUri`。 | 説明、画像、外部URIなどは任意。wire schema上の欠落または明示的な`null`は欠落相当として許容し、明示的な`null`はsanitize・除去せずartifactへ保持する。`null`以外のwrong type・invalid URI・非有限数値はbuild/read failure。 |
| `key_locations.json` | カテゴリの`category`、`category:en`、空でない`locations`。各場所の`id`、`name`、有限な`lat`/`lng`、`nodeCopyright`、`licence`、`licenceUri`。 | 説明、画像、外部URIなどは任意。wire schema上の欠落または明示的な`null`は欠落相当として許容し、明示的な`null`はsanitize・除去せずartifactへ保持する。`null`以外のwrong type・invalid URI・非有限数値はbuild/read failure。場所IDと`category:en`の重複はビルド失敗。 |
| 町字GeoJSON | 空でない`FeatureCollection`。各Featureの`type`、空でない`properties.name`、`Polygon`または`MultiPolygon` geometry、有限な座標。 | `properties.uri`などの任意プロパティは、wire schema上の欠落または明示的な`null`を欠落相当として許容し、明示的な`null`はsanitize・除去せずartifactへ保持する。`null`以外のwrong type・invalid URI・非有限数値はbuild/read failure。 |

共通方針として、required fieldの欠落または明示的な`null`、および非nullのwrong type・invalid URI・非有限数値は、build failureとし、ビルド後のartifact readでもread failureとする。

いずれかの取得、JSON/GeoJSON decode、形状、必須項目の欠落・明示的な`null`、任意項目の`null`以外の型・形式、空カテゴリ、重複識別子の検証に失敗した場合は、生成物を更新せず非ゼロでビルドを終了する。

### 2. Route topology and errors

1. `/locations`は生成物のカテゴリを読み、先頭カテゴリへ解決する。0件・transport/data failureはビルドを失敗させ、生成物欠落・破損だけをデータエラーとして表示する。
2. `/locations/layout.tsx`は共通shellとデータエラー境界だけを担当し、カテゴリナビゲーションや並べ替え操作を描画しない。これにより、同じ配下にある詳細ページへカテゴリ専用UIを漏らさない。
3. `/locations/[category-id]/layout.tsx`だけがカテゴリデータを受けた`LocationCategoryNavigation`を配置する。`/locations/[category-id]/page.tsx`はカテゴリ内容と並べ替え操作を担当し、`/locations/location-detail/[id]`はこのsegmentの外側に置く。
4. `/locations/[category-id]`は`category:en`をURL decodeして解決し、unknown/empty/malformed IDはNextの標準404境界へ送る。
5. `/locations/location-detail/[id]`は既存resolverを再利用し、unknown/invalid request IDは標準404、ビルド時のduplicate/invalid source dataはビルド失敗、ビルド後のartifact欠落・破損は日本語データエラーにする。詳細ページにはカテゴリナビゲーションと並べ替え操作を表示しない。
6. 旧`/location-detail/[id]`は削除し、compatibility redirectは追加しない。
7. 詳細のcategory back linkは`origin`を含めず、表示元カテゴリの正規pathへ戻す。

### 3. Category navigation and origin

1. `LocationCategoryNavigation`は`/locations/[category-id]/layout.tsx`からカテゴリ名、encoded href、current stateを受け取り、`nav[role="tablist"]`とURLを持つ`Link[role="tab"]`を描画する。各tabは`aria-selected`、`aria-current`、`aria-controls`、active時の`tabIndex=0`を持ち、非active時は`tabIndex=-1`とする。`/locations/layout.tsx`や詳細ページからは描画しない。
2. `usePathname`/`useSearchParams`を使うclient境界はtabのactive/origin処理とArrowRight/Left/Home/Endのroving focusだけに限定する。場所データfetch・sortは行わない。必要な境界は`Suspense`で包む。
3. 矢印キーは現在URLを変更せずタブ間のfocusだけを移動し、Enter/クリックはLinkの通常遷移でURLと選択状態を確定する。current URLのoriginがvalidならカテゴリ間リンクへ保持する。invalidなら保持せず、現在ページだけがエラー＋town listとなる。
4. `/locations`入口、detail/other links、町字リセットはqueryなしhrefを生成する。
5. visual tabs stylingと`/discussions`のURL-backed tablistを基準に、`nav[role="tablist"]`、URLを持つ`Link[role="tab"]`、`aria-selected`、`aria-current`、`aria-controls`、Arrow/Home/Endのroving focusを導入する。選択状態は現在URLを正本とし、DaisyUIの直接子セレクターに依存しないactive背景を明示する。

### 4. Sort controls and GPS

1. `LocationSortControls`はカテゴリnav直下に「町字で並べる」「近い順に並べる」を表示し、current modeをstatus/ARIAで伝える。
2. 「町字で並べる」はcurrent category pathへのqueryなし通常リンクとする。
3. 「近い順に並べる」は明示クリックで`navigator.geolocation`を呼び、成功した座標をlat,lng順でcurrent pathの`origin`へ直列化し、replace相当のGET遷移を行う。
4. GPS失敗時、originなしならtown listを維持し、originありなら既存distance listとoriginを維持し、エラーだけ表示する。
5. pageは生成物を読み、originを有限数値として検証する。行政区域外の数値は受け入れ、解釈不能値はerror + town listにする。origin処理のために外部データを取得しない。
6. 住所・名前入力、Google Maps/geocode、専用rate-limit stateは削除する。

### 5. Home popular data injection

1. `src/app/page.tsx`をserver wrapperにし、ビルド生成物から`main_facilities.json`由来のデータを読む。
2. 現在のinteractive formを`HomeRouteForm`などのclient childへ移し、popular categories/location dataをserializable propsとして渡す。
3. `DestinationSelector`/`LocationSuggestions`はデータ取得を行わず、既存callbackで選択場所を親へ返す。
4. destination JSON query、route form state、`/routes` query serializationは変更しない。

### 6. Standard 404 and data-error tests

1. unknown/empty/malformed category path and detail ID must assert standard not-found response, not a feature-specific error panel.
2. ビルド時のloader HTTP/JSON/GeoJSON failure、duplicate ID、required-field failureはビルド失敗をassertし、生成物欠落・破損だけをruntime data-errorとして404と分離する。
3. direct, reload, category navigation, detail navigation, and `origin` propagation/deletion are contract tests.
4. build成功後の代表ページで、ブラウザおよび実行中サーバーのCDN/データ提供元fetchが0件であることをassertする。build failure時は非ゼロ終了をassertする。

### 7. UIコンポーネント設計: `origin/dev`参照

UIの視覚基準は、実装開始時点の`origin/dev`を参照する。今回の確認基準は、`origin/dev`の`7cbf0a5a57c66b0e8e114e28cc3871ab1f46fd15`（2026-09-08T04:51:52+09:00、Issue #118修正のマージコミット）である。実装時は作業branchの変更後ファイルを基準にせず、次の参照先を`git show origin/dev:<path>`で確認する。

| `origin/dev`の参照先 | 維持する表示・責務 | 023で変更する境界 |
|---|---|---|
| `src/app/locations/page.tsx` | `PageHeader`、説明文、`Card`による操作領域、場所一覧の地域・距離セクション、データ提供元カードの内容・リンク | クライアント取得、住所検索、カルーセル、ローカルカテゴリ状態を持ち込まない。カテゴリナビゲーションとGPS操作は仕様の順序・通常リンク契約へ置き換える。 |
| `src/components/layouts/PageHeader.tsx` | `ruby-text`、左揃え、唯一の`h1`、`text-3xl`のページ見出し、`text-lg`の説明文 | カテゴリ名を追加の`h1`へしない。カテゴリページのH1は「場所をさがす」、説明は「位置とカテゴリから千代田区のスポットをさがす」とする。 |
| `src/components/ui/Card.tsx` | `section.card`、`card-body`、`card-title`、`bg-base-100`、`shadow-sm`の階層 | 「カテゴリを選択」「並べ替え」「データ提供元」のカードに再利用する。カード内部へデータ取得責務を置かない。 |
| `src/components/ui/CategoryTabs.tsx` | `tabs tabs-box`、`tab`、`text-base`、`px-4`、`ruby-text`、現在項目の視覚表現 | 視覚クラスとtab意味論の参照にする。`button`とローカルactive stateは再利用せず、`/discussions`に合わせて`nav[role="tablist"]`内のURLを持つ`Link[role="tab"]`、`aria-selected`、`aria-controls`、roving focusへ置き換える。 |
| `src/components/features/LocationCard.tsx` | `origin/dev`におけるカード、画像の`object-cover`、カード本文、場所名・地域・説明の余白、ホバー時の影 | 視覚参照だけに使い、023では削除済みの未使用コンポーネントを復活させない。カテゴリページのserver-rendered summary markupが正規詳細URLとserver側の地域表示値を持つ。クライアントGeoJSON取得、`findLocationArea`、旧詳細URLは使用しない。 |
| `src/components/ui/Button.tsx` | DaisyUIの`btn`、`text-base`、44px以上の操作領域、フォーカス表示 | GPS操作に再利用する。距離モードは明示クリックだけで開始し、状態を`aria-pressed`、処理中を`aria-busy`またはstatusで通知する。 |
| `src/components/ui/CarouselCard.tsx` | 参照対象外 | `dev`の補助案内カルーセルとスライドリンクは本featureへ追加しない。 |
| `src/components/layouts/SidebarLayout.tsx` | `main`、`max-w-4xl`、`px-4`、ページ全体の縦方向レイアウト | 既存の単一`main`と共存させる。場所ページ固有の横スクロールをページ全体へ波及させない。 |

カテゴリナビゲーションは、`CategoryTabs`の視覚的な雰囲気だけを借りる。親要素は`overflow-x-auto`や`min-w-max`で横幅を固定せず、リンク項目の行だけを`flex-wrap`で折り返す。各ラベルは`whitespace-nowrap`で改行・省略せず、320px、375px、390px、768px、1024px、1440pxで全項目を確認できるようにする。

場所一覧は、`dev`の`grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`を基準にする。町字表示は地域ごとの`section`、距離表示は四捨五入した整数キロメートルごとの`section`とし、各セクションで同じカードグリッドを使う。詳細ページには共通カテゴリナビゲーションを出さず、`PageHeader`、詳細情報、カテゴリ戻りリンク、目的地設定、外部リンクだけを配置する。

視覚確認では、`dev`の配色・余白・カード構成を優先する。ただし、憲章のWCAG 2.2 AA、通常文字16px以上、44px以上の操作領域、可視フォーカス、通常リンク、`aria-current`を`dev`の既存表現より優先する。`dev`の視覚表現と本仕様のURL・GPS・データ境界が衝突する場合は、本仕様の機能契約を優先し、視覚的な構成だけを維持する。

## Implementation Sequence (for tasks phase)

1. RED tests and implementation for the initial server-side URL, data/error, route, detail, home, GPS, and navigation contracts. This is the pre-Q21 working boundary represented by T003–T052; it is not the final artifact-only release boundary.
2. RED tests for the `origin/dev` visual contract: unique H1 and description, `Card` order and content, category labels without clipping, responsive card grids, distance-band sections, data-provider card, detail-page navigation omission, and no unintended horizontal overflow at the six required widths; obtain a fresh test-code review before UI implementation.
3. Implement the visual/responsive composition and run the corresponding GREEN suite at all required widths.
4. Execute the obsolete-logic removal gate below. Each deletion candidate is an explicit bounded task with a production-consumer census, replacement test evidence, deletion, negative search, and focused verification. Do not hide multiple deletions in one generic cleanup task.
5. Run the pre-Q21 focused/full verification recorded by T053–T059. These tasks close the route/UI cleanup checkpoint but do not claim that runtime external data loading has already been replaced.
6. Execute the Q21追加対応 in T060–T068: add RED tests and fresh reviews, implement build-time acquisition/validation and the artifact reader, replace runtime external loading, inject build failures, and prove runtime no-network behavior.
7. Only after Q21 is GREEN, run the final Jest, TypeScript, lint, browser acceptance at 320px/375px/390px/768px/1024px/1440px, `git diff --check`, successful build, build-failure injection, and runtime network-block verification.

## Obsolete Logic Removal Gate

Removing old behavior is part of this feature, not optional polish. The constitution's KISS and no-backward-compatibility principles require the implementation to delete superseded paths instead of adding a second implementation beside them.

### Plan-owned inventory

During task generation, create a deletion ledger with one row per candidate:

| Candidate | Replacement | Keep/delete decision | Required evidence |
|---|---|---|---|
| Old `/location-detail/[id]` route and compatibility-shaped tests | `/locations/location-detail/[id]` + standard 404 | Delete | Runtime consumer search, route tests, negative route search |
| `/locations` client/runtime CDN fetch and local category-tab state | Build artifact reader + shared URL navigation | Delete/replace | Build artifact evidence, browser/runtime network evidence, nav tests, no runtime loader fetch |
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
| Simple logic / KISS | PASS | Address search and API dependency are removed; build data generation, artifact reading, URL parsing, GPS control, and presentation have small boundaries. |
| Structured organization | PASS | Build-time generator, artifact reader, App Router pages, client navigation/control, and pure location helpers are separated. |
| Type safety | PASS | Status unions, finite coordinate validation, route identifiers, and sort modes are explicit. |
| Test-first | PASS | Every route/query/error/navigation chapter precedes implementation and has a fresh test review gate. |
| Accessibility & UX | PASS | Standard 404, native navigation, `aria-current`, two sort controls, Japanese status/errors, and single main are planned. |
| Privacy boundary | PASS | Coordinates are explicit URL state only for current/category navigation, never persisted or sent to detail/other pages. |
| Existing contract preservation | PASS | Route search, destination query, data version, detail content meaning, and existing distance/area calculation are reused. |
| Complexity tracking | PASS | No constitution violations. The only client code is the minimal URL-aware nav/GPS boundary required by the clarified URL contract. |

## Complexity Tracking

No constitution violation requiring justification. The build-time data-generation boundary, artifact reader, runtime URL/distance boundary, and two small client islands are the minimum complexity required to preserve URL-based distance sorting while removing browser-side and runtime external data fetching and address search.

## Review Correction Plan (2026-09-10)

今回のレビュー指摘は、既存の023実装を置き換える新機能ではなく、公開UI・エラー・設定境界・表示順の契約補正として扱う。先に公開境界のREDテストを追加し、各テスト変更直後に独立したread-only reviewで`VERDICT: PASS`を得てから本番コードを変更する。

| 指摘 | 実装方針 | 主な境界 |
|---|---|---|
| カテゴリナビゲーションの視覚差分 | ルートの`LocationSuggestions`→`CategoryTabs`と同じ`tabs tabs-box` / `tab text-base px-4 text-base-content ruby-text gap-0`を使う。場所ページ固有の`nav`・通常リンク・`aria-current`、flex-wrap、44px操作領域、focus-visibleは維持する。 | `LocationCategoryNavigation.tsx`、そのvisual contract |
| 並べ替えCardのタイトル | Card titleだけを「並べ替え」に変更し、操作ラベルとURL/GPS挙動は変更しない。 | `[category-id]/page.tsx`、visual contract |
| GPS・origin・データエラー | `alert alert-error alert-soft text-base-content!`と`role="alert"`を共通の見た目として使い、装飾アイコン、視認可能な「エラー」タイトル、具体的な説明を表示する。 | `LocationSortControls.tsx`、カテゴリ/入口/詳細のdata-error state |
| app-configの自動生成 | `ensure-app-config.mjs`は存在確認だけに変更し、欠落時は非ゼロ終了する。package lifecycleとDockerはこれを検証境界として呼び、exampleコピーはCI workflowの明示的な準備へ移す。 | `scripts/ensure-app-config.mjs`、`package.json`、Dockerfile、CI、docs |
| 町字順 | `groupLocationsByProvidedArea`が表示用町字名をキーに作ったグループを`localeCompare`昇順で返す。Mapの入力順には依存しない。グループ内の場所順は入力順で安定させる。 | `[category-id]/page.tsx`、page visual contract |

### Correction gates

1. T069/T071/T073/T075のREDテストを、互いに重複しないファイル境界で作成する。
2. 各RED直後のT070/T072/T074/T076で、仕様・受入条件・負の契約・fixtureの妥当性をfresh read-only reviewする。
3. `VERDICT: PASS`を得たテスト章だけをT077–T080の本番実装へ解放する。テストバイトが変わった場合は該当reviewを無効化し、同じ順序で再実施する。
4. 実装後は親が差分・本番参照の負の検索・型/lint・focused/full test・build・ブラウザ表示を再確認する。CIがexampleを準備することと、アプリ自身が運用時に生成しないことを別々に検証する。

### Constitution re-check for corrections

| Gate | Result | 根拠 |
|---|---|---|
| Clear naming | PASS | `LocationSortControls`、`groupLocationsByProvidedArea`、`app-config`検証境界は既存の意図を保つ。 |
| Simple Logic / KISS | PASS | 既存の共通Button・CategoryTabs視覚語彙と一つの設定検証境界を再利用し、新しい状態管理を追加しない。 |
| Type Safety | PASS | UI変更は既存propsを利用し、設定検証は既存のcwd基準と明示的な終了コードを維持する。 |
| Test-First Development | PASS (conditional gates) | 各指摘を公開RED→fresh review→実装の独立した作業単位にする。 |
| Accessibility & UX | PASS | `alert-soft`、視認可能な「エラー」タイトル、通常リンク、44px操作領域、可視フォーカスを検証する。 |
| Documentation & Comments | PASS | spec/plan/tasks/contracts/quickstartと運用ドキュメントの自動生成説明を同じ方針へ更新する。 |

## Screenshot re-validation (2026-09-10)

実ブラウザのスクリーンショットを`origin/dev@7cbf0a5`と現行023へ同じ表示幅で取得し、DOM計測と目視を併用した。現行023では次の差分を確認した。

- `LocationCategoryNavigation`は`nav.tabs-box > ul > a.tab`の構造により、DaisyUIの直接子向け`tab-active`背景が現在リンクへ適用されず、選択状態が背景で認識できない。
- 「町字で並べる」は素の`btn`リンク、「近い順に並べる」は共通`Button`の`btn-primary`で、`ruby-text`、角丸、フォーカス、内部配置の公開クラスが揃っていない。
- GPS拒否時のalertは操作ボタンと同じ`sm:flex-row`へ入り、1440pxで各操作が約69pxまで縮み、ルビ文字が縦に崩れる。alertは操作行の外へ出し、全幅で表示する。
- 無効な`origin`ではカテゴリページのサーバーalertと`LocationSortControls`のクライアントalertが重複する。無効`origin`の表示責務をページ側に限定し、GPS取得失敗だけをclient islandが表示する。

### Screenshot-driven correction design

- 現在カテゴリのLinkへ`bg-base-100`を明示し、`tab-active`・`aria-current="page"`・通常Link・flex-wrapを維持する。
- 2つの並べ替え操作へ共通のDaisyUI Button視覚語彙（`btn btn-primary`、`ruby-text`、44px以上、角丸、可視フォーカス）を適用する。URL、GPS、`aria-current`、`aria-pressed`の契約は変更しない。
- 操作行と状態表示を分離し、GPS拒否・タイムアウト・未対応のalertを操作行の下に`w-full`で配置する。invalid `origin`のclient側alertは削除し、ページ側のalertを一つだけ残す。
- REDテスト、fresh read-only reviewの`VERDICT: PASS`、本番修正、focused GREEN、同じ表示幅の修正後スクリーンショット確認の順で実施する。
