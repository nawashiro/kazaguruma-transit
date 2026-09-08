# Quickstart: 場所データページのJavaScript削減

**Feature**: [spec.md](./spec.md)
**Plan**: [plan.md](./plan.md)
**UI contract**: [contracts/location-pages.md](./contracts/location-pages.md)

## Prerequisites

- Node.js 22.x
- `npm install`済みのリポジトリ
- `app-config.json`（`mainFacilitiesUri`、`keyLocationsUri`、`townGeoJsonUri`の完全な取得URIを含む）
- 外部CDNへ到達できる環境（ビルド時データ生成・検証時のみ）
- GPSを使うブラウザ（GPS受入確認時のみ）

## UI基準

UIの基準は`origin/dev`の`7cbf0a5a57c66b0e8e114e28cc3871ab1f46fd15`に固定する。次のファイルを読み取り専用の視覚参照として使う。

- `src/app/locations/page.tsx`
- `src/components/layouts/PageHeader.tsx`
- `src/components/ui/Card.tsx`
- `src/components/ui/CategoryTabs.tsx`
- `src/components/features/LocationCard.tsx`
- `src/components/ui/Button.tsx`
- `src/components/layouts/SidebarLayout.tsx`

`src/components/ui/CarouselCard.tsx`と`dev`の補助案内カルーセルは対象外とする。`CategoryTabs`の見た目は参照するが、場所ページでは通常`Link`、`nav`、`aria-current="page"`を使う。`role="tablist"`、`role="tab"`、横スクロール、最小幅固定は採用しない。

```bash
git show origin/dev:src/app/locations/page.tsx
git show origin/dev:src/components/ui/CategoryTabs.tsx
git show origin/dev:src/components/features/LocationCard.tsx
```

## UI受入確認

代表的なカテゴリページを320px、375px、390px、768px、1024px、1440pxで確認する。ChromiumまたはPuppeteerで、次の条件を確認する。

- `document.documentElement.scrollWidth <= document.documentElement.clientWidth`になる。
- 全カテゴリラベルが省略・改行されず、リンク項目の行だけが領域内で折り返される。
- ページの`h1`が「場所をさがす」だけであり、説明文が表示される。
- 「カテゴリを選択」「近いところから表示」「データ提供元」のカード階層と内容を確認する。
- 町字表示は地域セクション、距離表示は`Nキロ離れています`の距離帯セクションを表示する。
- 場所詳細ページにカテゴリナビゲーションがなく、戻りリンク・目的地設定・外部リンクを確認する。
- `[role="tablist"]`、場所ページの`[role="tab"]`、補助案内カルーセルが存在しない。
- 通常文字が16px以上、操作要素が44px以上、フォーカス表示が視認できる。

## Static checks

```bash
npx tsc --noEmit --incremental false
npm run lint
npm test -- --runInBand

git diff --check
git status --short --untracked-files=all
```

`npm run build`はPrisma schema push、GTFS取得、場所データ・町字GeoJSONのビルド時取得・検証、Next buildを実行するため、作業ツリーへの副作用を確認できる最終段階でのみ実行する。場所データ・GeoJSONの取得または検証に失敗した場合は、公開用ビルドが非ゼロ終了することを確認する。

## Focused test targets

実装後に、実際のtasks.mdで確定したパスを正本とする。計画時点の候補は次のとおり。

```bash
npm test -- --runInBand --runTestsByPath \
  src/app/locations/__tests__/page.test.tsx \
  'src/app/locations/[category-id]/__tests__/page.test.tsx' \
  'src/app/locations/location-detail/[id]/__tests__/page.test.tsx' \
  src/components/features/__tests__/LocationCategoryNavigation.test.tsx \
  src/components/features/__tests__/LocationSortControls.test.tsx \
  src/components/features/__tests__/LocationSuggestions.test.tsx \
  src/lib/location/__tests__/location-origin-query.test.ts \
  src/lib/location/__tests__/location-page-data.test.ts \
  src/utils/__tests__/addressLoader.test.ts \
  --silent
```

## Acceptance walkthrough

1. `/locations`を直接開き、先頭カテゴリの正規URLへ解決し、先頭ナビが選択されることを確認する。
2. カテゴリナビから別カテゴリへ移動し、通常のカテゴリURLと表示内容が一致することを確認する。
3. カテゴリページで「町字で並べる」が選択済みになり、町字グループが表示されることを確認する。
4. 「近い順に並べる」を押し、GPS許可後に現在カテゴリURLへ`origin=<latitude>,<longitude>`が付与され、距離順になることを確認する。
5. `origin`付きカテゴリページから別カテゴリへ移動し、`origin`が維持されることを確認する。
6. `origin`付きカテゴリページから詳細へ移動し、詳細URLに`origin`が含まれないことを確認する。
7. 詳細または他ページから戻ったとき、位置情報が暗黙に引き継がれないことを確認する。
8. 「町字で並べる」を押し、現在カテゴリURLから`origin`が消え、町字表示へ戻ることを確認する。
9. 文字列形式不正・NaNの`origin`を直接開き、日本語エラーと町字一覧が表示されることを確認する。千代田区外の数値座標はエラーにせず距離順表示する。
10. 有効な`origin`でGPS再取得を失敗させ、距離順一覧と`origin`を維持して再取得エラーだけ表示することを確認する。
11. 存在しないカテゴリURL・場所詳細URLを開き、通常の404となることを確認する。ビルド時のデータ取得失敗・重複ID・JSON/GeoJSON不正は公開用ビルド失敗となり、404とは別であることを確認する。
12. 成功したビルドのホームで「よく利用される施設」を表示し、ブラウザおよび実行中サーバーから場所データCDNへリクエストせず、選択した施設が既存の目的地入力へ引き継がれることを確認する。
13. 住所・名前検索、Google Maps API、住所検索用レート制限UIが場所ページに存在しないことを確認する。

## Final checks

```bash
npx tsc --noEmit --incremental false
npm run lint
npm test -- --runInBand
git diff --check
npm run build
```

## Obsolete-logic deletion checks

各削除候補は、tasks.mdの削除台帳と対応するproduction-only検索で確認する。実装後は次を対象ごとに実行し、旧経路の参照が残っていないことを記録する。

- 旧 `/location-detail/[id]` のroute、Link、redirect、専用テスト参照
- `/locations`のclient CDN loader、旧`CategoryTabs`利用、旧active-category state
- 場所ページの住所・名前検索、`geocodeAddress`、住所検索rate-limit branch
- 不要になった`loadLocationCategories`、distance/position state、未使用export/import
- ビルド生成物へ移した後のclient/runtime CDN・GeoJSON fetch、旧データ源フォールバック参照

削除後の検索でテスト・fixture・履歴資料だけが残る場合は、production consumerが0件であることを記録する。旧経路を動かすfallbackやcompatibility redirectを追加して検索を通過させてはならない。

## Evidence to record

- ビルド時の場所データ・`appConfig`指定の各データソース取得、検証、生成物作成と、成功後のブラウザ/実行中サーバーCDNリクエスト0件の確認結果
- `/locations`のリダイレクト先、category navのactive state、origin保持/破棄のURL
- 町字/近い順の表示状態、GPS拒否・再取得失敗、invalid origin、out-of-area coordinates
- 404とdata-load/duplicate/malformed-data errorの分類
- ビルド失敗（HTTP/JSON/GeoJSON/必須フィールド/重複ID）と、ビルド後の生成物欠落・破損時の外部フォールバックなしの確認結果
- focused/full Jest suite/test数、TypeScript、lint、build、diff checkの終了コード

## T052H: US5 visual GREEN・6幅ブラウザ受入記録

### 実施境界

- 実施日時: **2026-09-08 13:28:30 UTC**（受入測定は同日）。
- branch / HEAD: `spec/issue-79-location-data-pages` / `72e1734278b400db2863639a4db89092bcd1761a`。
- 視覚参照: 生のcommit SHA `7cbf0a5a57c66b0e8e114e28cc3871ab1f46fd15`。`origin/dev@<sha>`という文字列はGit refとして解決できなかったため、指定SHAを直接比較した。
- T052Hの書き込み先は本ファイルと`deletion-ledger.md`だけ。production source、test、fixture、spec/tasks/plan/research、commit、pushは変更していない。
- owned dev serverは`npm run dev -- --hostname 127.0.0.1 --port 3331`で起動し、HTTP 200を確認した。ビルドはQ21のT060–T068未完了境界に触れるため、この受入では実行していない。

### 必須コマンドの実測結果

角括弧を含むroute pathを複数指定したため、Jestが`Invalid testPattern` informational warningを各複数path実行で出した。ただし各コマンドの最終summaryは指定したsuite集合だけであり、結果は次のとおりである。

```bash
npm test -- --runInBand --runTestsByPath \
  'src/app/locations/[category-id]/__tests__/page.visual-contract.test.tsx' \
  'src/app/locations/location-detail/[id]/__tests__/page.visual-contract.test.tsx' \
  'src/components/features/__tests__/LocationCategoryNavigation.test.tsx' \
  'src/app/__tests__/location-pages-responsive-contract.test.tsx'
```

- visual-contract 4 suites: **4 passed / 4 total、35 passed / 35 tests、exit 0**。

```bash
LOCATION_PAGES_404_BASE_URL=http://127.0.0.1:3331 \
LOCATION_PAGES_ORIGIN_BASE_URL=http://127.0.0.1:3331 \
npm test -- --runInBand --runTestsByPath \
  'src/app/locations/__tests__/page.test.tsx' \
  'src/app/locations/[category-id]/__tests__/page.test.tsx' \
  'src/app/locations/location-detail/[id]/__tests__/page.test.tsx' \
  'src/components/features/__tests__/LocationCategoryNavigation.test.tsx' \
  'src/components/features/__tests__/LocationSortControls.test.tsx' \
  'src/lib/location/__tests__/location-origin-query.test.ts' \
  'src/app/__tests__/location-pages-404.test.ts' \
  'src/app/__tests__/location-pages-origin-runtime.test.ts'
```

- 関連location/category/detail/navigation/sort/origin/404: **8 passed / 8 total、77 passed / 77 tests、exit 0**。runtime 404の初回compile遅延を混ぜないため、未知category/detailを`curl`で先にwarm-upした。
- `npx tsc --noEmit --incremental false`: **exit 0**。
- `npm run lint`: **exit 0**。`next lint` deprecation、既存の`no-explicit-any`、hook、`no-img-element`等のwarningのみでerror 0。
- `git diff --check`: **exit 0**。

### カテゴリページ6幅（町字表示）

対象URLは`http://127.0.0.1:3331/locations/hospital`。Chromeのvertical scrollbar 15pxを含むため、`clientWidth`はviewportより15px小さい。全行で`overflow=false`、カテゴリリンク16件、`display:flex`、`flex-wrap:wrap`、リンクの横切断なし・nav内bounds内だった。

| viewport | clientWidth | scrollWidth / bodyScrollWidth | nav rect `(x,y,w,h)` | 結果 |
|---:|---:|---:|---|---|
| 320 | 305 | 305 / 305 | `(40,275,225,404)` | PASS |
| 375 | 360 | 360 / 360 | `(40,275,280,316)` | PASS |
| 390 | 375 | 375 / 375 | `(40,275,295,316)` | PASS |
| 768 | 753 | 753 / 753 | `(40,251,673,140)` | PASS |
| 1024 | 1009 | 1009 / 1009 | `(360,251,609,140)` | PASS |
| 1440 | 1425 | 1425 / 1425 | `(464.5,251,816,96)` | PASS |

- `h1`は全幅で1個だけの「場所をさがす」、説明文「位置とカテゴリから千代田区のスポットをさがす」も表示された。
- 必須カードの順序・内容は「カテゴリを選択」→「近いところから表示」→場所一覧→「データ提供元」。1440pxのprovider cardは`x=440.5,y=2810,width=864,height=235,right=1304.5,bottom=3045`。地域表示では富士見、千代田、神田駿河台、外神田等の地域単位を確認した。
- カテゴリラベル16件とsort操作は通常文字16px・`min-height:44px`。320pxでも全ラベルは`whitespace-nowrap`で省略・切断なし、項目行だけが折り返した。
- `[role="tablist"]`、場所ページの`[role="tab"]`、`carousel` classは各0件。

### 有効origin距離表示6幅

対象URLは`/locations/hospital?origin=35.6905%2C139.7578`。全幅で距離modeの`近い順に並べる` buttonは`aria-pressed="true"`、町字reset hrefは`/locations/hospital`（queryなし）、カテゴリ16/16リンクだけがoriginを保持し、詳細18/18リンクはoriginを含まなかった。

| viewport | clientWidth | scrollWidth / bodyScrollWidth | category origin | detail origin | overflow |
|---:|---:|---:|---:|---:|---|
| 320 | 305 | 305 / 305 | 16 / 16 | 0 / 18 | false |
| 375 | 360 | 360 / 360 | 16 / 16 | 0 / 18 | false |
| 390 | 375 | 375 / 375 | 16 / 16 | 0 / 18 | false |
| 768 | 753 | 753 / 753 | 16 / 16 | 0 / 18 | false |
| 1024 | 1009 | 1009 / 1009 | 16 / 16 | 0 / 18 | false |
| 1440 | 1425 | 1425 / 1425 | 16 / 16 | 0 / 18 | false |

- 距離帯は`0キロ離れています`、`1キロ離れています`、`2キロ離れています`の昇順で表示された。指定のout-of-area origin `51.5074,-0.1278`もエラーなしで`9560キロ`、`9561キロ`の距離表示になった。

### 詳細ページ6幅

代表URLは`/locations/location-detail/3e328a42-3ff1-4018-be72-746aa6e14e17`（日本歯科大学附属病院）。全幅でcategory nav、`role="tablist"`、`role="tab"`は0件、全focusableがclientWidth内、back/destination/external linkは同じ機能契約を保持した。

| viewport | clientWidth | scrollWidth / bodyScrollWidth | h1 rect width × height | category nav |
|---:|---:|---:|---:|---:|
| 320 | 305 | 305 / 305 | 273 × 72 | 0 |
| 375 | 360 | 360 / 360 | 328 × 36 | 0 |
| 390 | 375 | 375 / 375 | 343 × 36 | 0 |
| 768 | 753 | 753 / 753 | 721 × 36 | 0 |
| 1024 | 1009 | 1009 / 1009 | 657 × 36 | 0 |
| 1440 | 1425 | 1425 / 1425 | 864 × 36 | 0 |

- 戻りリンクは`/locations/hospital`でoriginなし。`ここへ行く`はdestination JSON（lat/lng/address）のみでoriginなし。外部リンクは`https://www.tky.ndu.ac.jp/hospital/`、`target="_blank"`、`rel="noopener noreferrer"`。

### キーボード、遷移、404

- 390pxで実CDP Tabを実行し、**16/16カテゴリhref**（missing 0）と2 sort操作へ到達した。カテゴリ・sort双方で`:focus-visible`がtrue。active categoryは`/locations/hospital`の`aria-current="page"`で、町字modeのreset linkも`aria-current="page"`、距離mode buttonは`aria-pressed="true"`。
- origin付きの実render href `/locations/natural%20environment%20park?origin=35.6905%2C139.7578`を直接browser navigationして、同じpath/originとactive stateを確認した。詳細のrender hrefを直接navigationするとoriginなし、category navなし、戻り・目的地・外部リンクを確認した。CDP座標clickはviewport emulation下で遷移を発火しなかったため、click成功とは主張せず、DOMに表示された同一hrefのbrowser navigationで検証した。
- `/locations/definitely-not-a-category`と`/locations/location-detail/definitely-not-a-location`はbrowser navigationでHTTP **404**、H1 `404`、標準not-found本文、category nav 0件、390pxで`scrollWidth=clientWidth=375`だった。

### 指定視覚参照との差分（機能契約優先）

- 参照SHAの`src/app/locations/page.tsx`は586行・21116 bytesのmonolithic pageで、`PageHeader`、`Card`、`CategoryTabs`、`LocationCard`およびtab roleを内包していた。現行は`/locations/[category-id]`、`/locations/location-detail/[id]`、`LocationCategoryNavigation`、`LocationSortControls`へ分割し、カテゴリページはsemantic `nav`/通常`Link`/`aria-current`、詳細はcanonical nested routeとcategory nav omissionを採用する。これは参照の視覚語彙を保持しつつ、現行機能契約を優先した差分である。
- `PageHeader.tsx`（26行/632 bytes）、`Card.tsx`（61行/1465 bytes）、`CategoryTabs.tsx`（81行/2409 bytes）、`Button.tsx`（102行/3846 bytes）、`SidebarLayout.tsx`（142行/4916 bytes）は参照と現行で同一。`CategoryTabs`はroute-form側consumerのため保持し、場所ページへtab roleを戻していない。参照の`LocationCard.tsx`は現行では削除され、詳細hrefは`/locations/location-detail/[id]`へ統一されている。
- 実表示の6幅で参照由来のPageHeader/Card/provider/余白・44px操作領域を確認し、horizontal overflow 0件。参照との差分に視覚契約を壊すものはなく、tab state、旧location search、detailへのorigin継承は復活させていない。

### 既知の環境制約

- PATH上のsystem Chromiumは利用できず、Puppeteer cacheのChrome **138.0.7204.168**を`9222`で使用した。404確認中にCDP Chromeが一度終了したため再起動して再確認した。最初の切断時にリポジトリrootへuntracked `core`（389,578,752 bytes）が生成されたが、書込境界外のため削除・変更していない。`git status`にはこの環境artifactを未解決として残している。
- `next start`は起動しておらず、routesManifestエラーは今回観測していない。dev serverの起動/停止は本受入で管理した。

## T067/Q21: null policy correction後の最終再実測

この節はQ21のT067専用記録である。既存のpre-Q21手順とT052H受入記録は変更しない。

実施日時は**2026-09-08 20:11:19 UTC**である。旧初回T067は、live `key_locations.json`の任意`description: null`をrejectして`npm run build`がexit 1になった。null policy correction後の現行bytesで、標準build、failure matrix、artifact-only runtimeを再実測した。

### 標準build

再現コマンド:

```bash
npm run build
```

- exit **0**。
- `prebuild`の`ensure-app-config`は設定を保持して完了した。
- `tsx scripts/generate-location-artifact.ts`は3つの設定URIから取得し、検証済みartifactをatomic publishした。
- `prisma generate`はv6.19.3で完了した。
- `prisma db push --accept-data-loss`は`The database is already in sync with the Prisma schema.`を出した。
- `npm run import-gtfs`はパイプラインを継続した。独立再実行もexit **0**だったが、`transit-config.json`がないため`ENOENT`エラーを記録した。
- `next build`は`Compiled successfully in 42s`、static pages **211/211**で完了した。

成功条件を満たすartifactを次で再読した。

```bash
npx tsx -e 'import { readLocationArtifact } from "./src/lib/location/location-artifact.ts"; const result = readLocationArtifact(); console.log(JSON.stringify({status: result.status, artifactStatus: result.status === "success" ? result.artifact.status : null, error: result.status === "error" ? result.error.message : null}));'
```

- exit **0**。出力は`{"status":"success","artifactStatus":"validated","error":null}`だった。

| 項目 | 実測値 |
|---|---|
| path / bytes | `public/generated/location-data.json` / **230744 bytes** |
| root keys | `derivedRegions`、`sourceUris`、`sources`、`status` |
| `status` | `validated` |
| main施設 | 9カテゴリ / 62場所 |
| key場所 | 16カテゴリ / 169場所 |
| GeoJSON | `FeatureCollection` / 59 feature（`Polygon`58、`MultiPolygon`1） |
| `derivedRegions` | 169 entries / 37 unique region labels |
| artifact reader | `readLocationArtifact()` → `success`、artifact status `validated` |

`sourceUris`の実測値は次のとおりである。

- `mainFacilitiesUri`: `https://cdn.jsdelivr.net/gh/nawashiro/chiyoda_city_main_facilities@v2.1.1/kazaguruma_json_min/main_facilities.json`
- `keyLocationsUri`: `https://cdn.jsdelivr.net/gh/nawashiro/chiyoda_city_main_facilities@v2.1.1/kazaguruma_json_min/key_locations.json`
- `townGeoJsonUri`: `https://cdn.jsdelivr.net/gh/nawashiro/chiyoda_city_town_geojson@latest/chiyoda_city.json`

artifact内の`null`はsources全体で**671件**だった。内訳は`description`126、`descriptionCopyright`125、`imageCopyright`141、`imageUri`141、`nodeSourceId`40、`uri`98である。代表例の`keyLocations[0].locations[1].description = null`を保持し、必須fieldのnullは**0件**だった。

### generator failure matrix

focused generator+readerを次で実行した。

```bash
npm test -- --runInBand --runTestsByPath \
  scripts/__tests__/generate-location-artifact.test.ts \
  src/lib/location/__tests__/location-artifact.test.ts \
  --silent --json --outputFile=/tmp/t067-focused.json
```

- exit **0**、2 suites、**402/402 tests PASS**、failed 0、pending 0。
- direct generatorのexplicit null acceptanceは**3 assertions PASS**だった。
- `Number.NaN`/`Infinity`の非有限値はpublic CLI証跡として数えず、direct generatorの非有限値coverageを**7 assertions PASS**として別記録する（main施設2、key場所3、GeoJSON2）。

public lifecycleを次で再実行した。

```bash
npm test -- --runInBand \
  --runTestsByPath scripts/__tests__/generate-location-artifact.test.ts \
  -t 'public generator build lifecycle' \
  --json --outputFile=/tmp/t067-public-lifecycle.json
```

- exit **0**。機械集計はassertion records **382**、passed **181**、failed **0**、pending **201**だった。
- lifecycleの実行済み181件は、failure matrix **175件**、成功経路4件、writer failure 1件、previous-artifact保持1件である。
- 175件のfailure matrixは次のとおりである。件数合計は機械集計で175件になる。

| 対象 | 件数 | exit/stderr分類 | artifact・temporary file・fallback |
|---|---:|---|---|
| `appConfig` URI（3 field × 9 invalid values） | 27 | 非0、URI・config・absolute・invalid分類 | artifact未更新、temp 0、fallback 0 |
| 各sourceのtransport failure | 3 | 非0、fetch・network・transport・socket分類 | artifact未更新、temp 0、fallback 0 |
| 各sourceのHTTP failure | 3 | 非0、HTTP・503・status分類 | artifact未更新、temp 0、fallback 0 |
| 各sourceのJSON decode failure | 3 | 非0、JSON・parse・decode分類 | artifact未更新、temp 0、fallback 0 |
| main施設の必須field・座標・`licenceUri`形式 | 27 | 非0、main・facility・field・validation分類 | artifact未更新、temp 0、fallback 0 |
| key場所の必須field・ID・座標・`licenceUri`形式 | 33 | 非0、key・location・field・identifier分類 | artifact未更新、temp 0、fallback 0 |
| main/keyカテゴリ必須field | 20 | 非0、category・field・validation分類 | artifact未更新、temp 0、fallback 0 |
| main/key `locations` missing/wrong type/null/empty | 8 | 非0、locations・array・validation分類 | artifact未更新、temp 0、fallback 0 |
| main任意fieldのwrong type/invalid URI | 6 | 非0、optional・field・URI分類 | artifact未更新、temp 0、fallback 0 |
| key任意fieldのwrong type/invalid URI | 9 | 非0、optional・field・URI分類 | artifact未更新、temp 0、fallback 0 |
| GeoJSON feature/property/geometry | 19 | 非0、GeoJSON・feature・geometry・coordinate分類 | artifact未更新、temp 0、fallback 0 |
| GeoJSON root/features shape | 9 | 非0、GeoJSON・shape・features分類 | artifact未更新、temp 0、fallback 0 |
| 空のmain/keyカテゴリ集合・空のGeoJSON feature集合 | 3 | 非0、empty・category/feature分類 | artifact未更新、temp 0、fallback 0 |
| duplicate category ID・duplicate location ID | 4 | 非0、duplicate・identifier分類 | artifact未更新、temp 0、fallback 0 |
| 後続GeoJSON featureの不正座標 | 1 | 非0、GeoJSON・feature・coordinate分類 | artifact未更新、temp 0、fallback 0 |
| **合計** | **175** | **全件非0、stderr分類assertion PASS** | **全件artifact未更新、temporary file 0、fallback 0** |

各failure caseは、テスト内で`exitCode !== 0`、期待stderr分類、設定済みURI以外への要求なし、`artifactKind=missing`、`atomicTempEntries=[]`をassertした。writer failureは意図的なdirectory targetで非0になり、temporary fileを残さなかった。previous-artifact caseはrename前の既存artifactを保持した。CDN URL、GeoJSON provider URL、legacy `locationsDataVersion` URL、fallback URLへの要求は0件だった。

### next-start artifact-only probe

次のコマンドで`next start`を起動した。`/opt/data/t067-next-network-guard.cjs`をpreloadし、loopback以外の`fetch`、`http.request`、`https.request`をfail-fastで拒否してログへ記録した。

```bash
NODE_OPTIONS="--require=/opt/data/t067-next-network-guard.cjs" npx next start -p 3100
```

serverは`Ready in 1735ms`を出した。artifact内の先頭categoryは`city_office_and_branch_offices`、先頭detailは`5e3b1528-8af6-436a-83af-24ca45b58e12`である。HTTP probeは次の4件を実行した。

| request | status | response bytes | HTML marker |
|---|---:|---:|---|
| `GET http://127.0.0.1:3100/` | **200** | 49683 | `<html`、`風ぐるま乗換案内`、`よく利用される施設` |
| `GET http://127.0.0.1:3100/locations/city_office_and_branch_offices` | **200** | 152250 | `<html`、`場所をさがす`、`区役所・出張所` |
| `GET http://127.0.0.1:3100/locations/location-detail/5e3b1528-8af6-436a-83af-24ca45b58e12` | **200** | 32538 | `<html`、`千代田区役所`、`場所詳細`、`ここへ行く` |
| `GET http://127.0.0.1:3100/locations/city_office_and_branch_offices?origin=35.6905%2C139.7578` | **200** | 150647 | `<html`、`場所をさがす`、`近い順に並べる`、`キロ離れています` |

4 GETのforbidden network call countは**0**だった。CDN、GeoJSON provider、legacy source、fallbackへの外部要求も0件だった。probe後にserver processを終了し、port 3100の`connect_ex=111`とremaining `next-server`なしを確認した。

### T067結論

- 標準`npm run build`: **PASS / exit 0**。prebuild、Prisma、GTFS stage、`next build`のchainが完了し、artifactとstatic build evidenceを確認した。
- null policy: **PASS**。live optional null 671件を保持し、required fieldのnullは0件だった。direct explicit-null acceptanceは3件PASSだった。
- T060 generator lifecycle: **PASS / 181 passed、failure matrix 175件すべて非0、stderr分類・artifact未更新・temp 0・fallback 0**。
- focused generator+reader: **PASS / 2 suites、402/402 tests**。direct non-finite coverageは7件PASSだった。
- artifact-only `next start` probe: **PASS / 4/4 HTTP 200、主要marker成立、forbidden network 0件**。

### 未解決事項

- `npm run import-gtfs`はexit **0**だが、`transit-config.json`が存在しないため`ENOENT`を記録して処理を終了した。GTFS更新を必要とする運用では、設定ファイルを用意して再実行する。
