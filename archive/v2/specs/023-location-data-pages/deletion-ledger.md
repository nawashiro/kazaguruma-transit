# 場所データページ削除台帳

## T001: 基準状態とドキュメント境界

- 確認日: 2026-09-06 (UTC)
- 基準ブランチ: `spec/issue-79-location-data-pages`
- HEAD: `b2d6eeb060507f4640a19f517500917b3fa47178`
- T001開始時点の作業ツリー: clean。`git status --short --branch` はブランチ情報のみで、変更・未追跡パスなし。
- `git diff --check`: 成功（exit 0）。

### 許可されたドキュメントパス

- 本タスクで書き込み可能なパス: `specs/023-location-data-pages/deletion-ledger.md` のみ。
- feature文書の参照対象: `spec.md`、`plan.md`、`research.md`、`data-model.md`、`quickstart.md`、`contracts/location-pages.md`、`checklists/requirements.md`、`tasks.md`。
- `src/**`、テスト、上記の参照対象文書、Git履歴は変更しない。commit、push、その他の外部操作も行わない。

## T002: 初期obsolete-logic台帳

### 調査境界

- 調査対象は、現行`src/**`のproduction codeと、consumerを確認するための既存テストである。
- production consumerの判定から、テスト、fixture、コメント、仕様・計画などの履歴資料を除外した。
- テスト参照は、削除後に更新または削除する対象として別記した。テスト参照だけではproduction consumerと判定しない。
- `geocode`は場所ページと経路検索フォームを分離した。経路検索フォームのconsumerは削除候補に含めない。
- 旧`/location-detail/[id]`から新URLへの互換redirect、alias、fallbackは追加しない。

### 判定語

| 判定 | 意味 |
|---|---|
| **delete** | 新契約で不要になるproduction code、route、state、UI、importを削除する。 |
| **move/reuse** | server data boundary、nested route、純粋helperなどへ責務または実装を移し、意味を再利用する。 |
| **retain** | 現行production consumerまたは既存契約があり、今回の場所ページ変更では残す。 |
| **out-of-scope** | 経路検索フォームなど別featureの責務であり、本featureでは変更しない。必要に応じてretainと併記する。 |

### 初期分類

| Candidate | 現行production consumerと証拠 | 初期分類 | Replacementまたは次の判定 |
|---|---|---|---|
| 旧detail route `src/app/location-detail/[id]/page.tsx`、`loading.tsx` | route自身が旧`/location-detail/[id]`を提供する。`LocationCard.tsx:45`が旧URLを生成する。source検索で旧routeへのproduction redirect、aliasは見つからない。 | **delete** | `/locations/location-detail/[id]`のserver routeへ置換する。旧URLのredirectは作らない。T025〜T027でroute、import、redirect、旧route専用テストを再検索する。 |
| 旧detail route内の詳細resolver、結果型 | `src/app/location-detail/[id]/page.tsx:10,35`が`resolveLocationDetail`を使う。`src/lib/location/location-detail-resolver.ts:123`はID検証、重複ID、data-load-errorを保持する純粋resolverである。`src/types/access-route-pages.ts:29-45`はstatus型を共有する。 | **move/reuse** | nested detail routeとserver data boundaryでresolver、status型を再利用する。旧route専用のpage markupと戻り先だけをdeleteする。 |
| `LocationCard`の旧detail href | `src/app/locations/page.tsx:423,444`が`LocationCard`をproductionで使用し、`src/components/features/LocationCard.tsx:45-50`が旧URLを生成する。 | **move/reuse**（旧hrefは**delete**） | card自体は保持し、`/locations/location-detail/[id]`への通常リンクとserver提供のarea情報へ移す。旧href、旧route前提だけを削除する。 |
| `loadKeyLocationsData()`と`loadLocationCategories()` | `src/app/locations/page.tsx:20,64`から`loadLocationCategories()`を呼ぶ。wrapperは`src/lib/location/location-list-state.ts:153-154`だけにあり、`loadKeyLocationsData()`はそのwrapperからだけ呼ばれる。 | **delete** | server側の`loadKeyLocationsDataResult()`または`location-page-data`をカテゴリ入口に使う。HTTP、JSON、必須項目失敗を空配列へ変換するclient loaderは残さない。 |
| `loadKeyLocationsDataResult()`、`KeyLocation`、`KeyLocationCategory` | 現行では旧detail pageの`src/app/location-detail/[id]/page.tsx:6,27`がstatus-preserving loaderを使う。resolverとnested detailでも同じ検証済み型が必要になる。 | **move/reuse** | nested detail、カテゴリ、共通server data boundaryへ移す。loaderのCDN取得自体はserver境界へ限定し、現行のclient wrapperとは分離する。 |
| `loadAddressData()`のclient CDN取得 | `src/components/features/LocationSuggestions.tsx:9,35`が`main_facilities.json`をclientで取得する。`DestinationSelector.tsx:5,34`から経路検索フォーム内でproduction使用される。 | **move/reuse**（client fetchは**delete**） | ホームのpopular facilitiesはserver wrapperからserializable propsで渡す。`AddressCategory`、`AddressLocation`、`convertToLocation`、選択callbackは必要な範囲で再利用する。これは場所データfeature内だが、経路検索フォームの選択操作は削除しない。 |
| `clientGeoUtils.loadGeoJSON()`とclient CDN fetch | `src/lib/location/location-list-state.ts:8-12,160,169`からのみ到達し、`src/app/locations/page.tsx`と`LocationCard.tsx`、旧detail pageのarea処理へつながる。`clientGeoUtils.ts:23-33`はCDNのGeoJSONをbrowserから取得する。 | **delete**（fetch境界）/**move/reuse**（純粋処理） | browser fetchとmodule-level client cacheは削除する。`isPointInPolygon`、`isPointInMultiPolygon`、`getAreaNameFromCoordinates`、`formatAreaName`、`groupLocationsByArea`はserver-safe loaderとともに再利用または抽出する。 |
| `src/utils/geoUtils.ts`のserver-safe GeoJSON実装 | production import検索ではconsumer 0件である。ファイルは`public/geojson/chiyoda_city.geojson`を読むserver-safe実装を持つが、現在の場所ページへ接続していない。 | **move/reuse候補** | T009のserver area boundaryが採用する場合だけ再利用する。採用後にclient実装との重複を整理する。T002では未使用だからという理由だけで削除しない。 |
| 場所ページの住所・場所名検索UI | `src/app/locations/page.tsx:46-49,200-259,337-366`に`address`、`searchLoading`、`searchError`、form、検索ボタンがある。`geocodeAddress`を呼び、`source=locations`へ遷移する。 | **delete** | GPS明示操作と`origin=<latitude>,<longitude>`へ置換する。住所入力、場所名検索、場所ページ専用error/rate-limit branchは残さない。 |
| `geocodeAddress()`、`GeocodingResult`、場所page専用geocoding state | `src/app/locations/page.tsx:20,214`だけが`geocodeAddress()`をproductionで呼ぶ。実装は`src/lib/location/location-list-state.ts:24-34,119-150`にあり、`/api/geocode`と`rate-limited`状態を扱う。 | **delete** | T033〜T044のGPS/origin契約がGREENになった後に削除する。純粋な距離計算、server area grouping、route-form geocodingはこの削除に含めない。 |
| `source=locations`のrate-limit branch | `src/app/locations/page.tsx:216-218`が`/rate-limit?source=locations`へ遷移する。`RateLimitSource`と`getRateLimitReturnPath`にも`locations`専用armがある。 | **delete** | 場所pageのgeocodeを削除した後、`locations`専用の遷移・allowlist・戻り先分岐を削除候補とする。`home`、`routes`のrate-limit契約はretainする。 |
| 経路検索フォームのgeocoding | `DestinationSelector.tsx:9,21,23-25`と`OriginSelector.tsx:10,25,27-30`が`useGeocodingSearch`を使用する。`OriginSelector.tsx:52-66`はGPS後のreverse geocodeも使用する。実装は`useGeocodingSearch.ts`、`geocoding-search.ts`、`/api/geocode`である。 | **retain / out-of-scope** | Issue #79の別feature・別PRとして残す。場所pageの`geocodeAddress`削除や`/api/geocode`のnegative searchで誤って削除しない。経路検索の`home`、`routes` rate-limit branchも変更しない。 |
| `LocationListState` reducerとclient orchestration | `LocationListState`、`LocationListAction`、`createInitialLocationListState()`、`reduceLocationListState()`は`src/lib/location/location-list-state.ts:14-92`にある。production importは0件で、既存テストだけが参照する。`/locations/page.tsx`には別個の`useState`群がある。 | **delete**（reducer）/**delete**（旧orchestration） | server pageのdata/error/sort state、URL `origin`、小さなGPS client controlへ責務を分割する。request ID reducer、`activeCategory`、`currentPosition`、`sortedByDistance`、`locationsByArea`、`geoJsonLoading`などの場所page専用一時状態は新契約へ置換後に削除する。 |
| 距離計算、距離順helper | `calculateDistance()`、`sortLocationsByDistance()`は現行`src/app/locations/page.tsx:19-24,125-176,235-249`が使用する。テストにも純粋関数の検証がある。 | **move/reuse** | server category pageまたは`location-page-data`で再利用する。`origin`の検証後に距離順を確定し、同距離の入力順を保つ。 |
| 町字分類helper | `groupCategoryLocationsByArea()`は`src/app/locations/page.tsx:21,93`だけがproductionで使用する。`groupLocationsByArea()`などの純粋処理は`clientGeoUtils.ts:74-139`にある。 | **move/reuse** | server data boundaryへ移す。GeoJSON取得だけをserver-safe実装へ変更し、町字分類の意味と「その他」分類を維持する。 |
| `CategoryTabs`の場所page利用とactive-category state | `src/app/locations/page.tsx:16,35,112-141,383-390`がbutton、local `activeCategory`、`toggleCategory`を使用する。これはURLを正本にしない場所page専用consumerである。 | **delete**（利用）/**move/reuse**（URL nav） | `LocationCategoryNavigation`の`nav`、通常`Link`、`aria-current="page"`へ置換する。カテゴリ間では有効な`origin`だけを保持し、場所pageのlocal tab stateは削除する。 |
| `CategoryTabs`コンポーネント本体 | production consumerは場所pageだけではない。`LocationSuggestions.tsx:15,25,53-59,95-102`が経路検索フォームのpopular facility選択で使用し、`DestinationSelector.tsx:5,34`から到達する。 | **retain / out-of-scope** | 場所page利用を削除しても、route-form consumerが残る間はcomponent本体を削除しない。T051でproduction consumerを再確認し、0件になった場合だけ削除を再判定する。 |
| `LocationSuggestions`のactive-category state | `LocationSuggestions.tsx:25,53-59,95-136`がpopular facility選択に必要な一時表示状態を持つ。場所カテゴリpageのstateとは別component、別責務である。 | **retain / move/reuse** | server提供のcategoriesを受け取る形へ移すが、経路検索フォームのカテゴリ展開・施設選択・callbackはretainする。場所pageのactive-category削除に巻き込まない。 |
| `LocationCard`と旧detail pageのclient area fallback | `LocationCard.tsx:15-42`が`areaName`または`location.area`がない場合に`findLocationAreaName()`をclientで呼び、`"不明"`へfallbackする。旧detail pageも`getAreaName():53-63`で同じfallbackを呼ぶ。 | **delete**（client fallback）/**move/reuse**（表示値） | server pageが計算したarea名を`LocationCard`とdetail markupへ渡す。`areaName`表示、利用可能な`location.area`、GeoJSONによる「その他」分類は新server boundaryで再利用する。 |
| `findLocationAreaName()` | production consumerは`LocationCard.tsx:6,27`と旧detail page`page.tsx:11,59`である。`location-list-state.ts:166-172`からclient GeoJSON fetchへ到達する。 | **delete** | serverでareaを解決する共通data resultへ移した後、card/detailからimportを削除する。`getAreaNameFromCoordinates`など純粋helperの再利用と混同しない。 |

### 経路検索フォームを保護する明示的境界

次のproduction consumerは、場所pageのgeocode削除対象ではない。

- `src/components/features/DestinationSelector.tsx:9,21-25`: `useGeocodingSearch`で目的地を検索する。
- `src/components/features/OriginSelector.tsx:10,25-30`: `useGeocodingSearch`で出発地を検索する。
- `src/components/features/OriginSelector.tsx:52-66`: GPS座標のreverse geocodeを任意で実行する。
- `src/components/features/useGeocodingSearch.ts:6,16-20`、`src/lib/location/geocoding-search.ts:24-38`、`src/app/api/geocode/route.ts`: 経路検索フォームの共有geocode境界である。
- `src/components/features/LocationSuggestions.tsx:35`、`src/utils/addressLoader.ts:40-57`: ホームpopular facilitiesのclient CDN取得である。取得境界はserverへ移すが、経路検索フォームの施設選択操作は残す。

### T002後の削除順序

1. nested detail route、server data boundary、URL category navigation、GPS/origin、server area resultの契約を確定する。
2. 置換側テストをGREENにする。削除前にtest-code reviewを完了する。
3. 旧detail route、場所pageのclient CDN loader、住所検索UI、`geocodeAddress`、場所page専用rate-limit branch、旧location state、client area fallbackを対象ごとに削除する。
4. `CategoryTabs`、`LocationSuggestions`、`useGeocodingSearch`、`/api/geocode`などのroute-form consumerを負の検索で誤削除していないことを確認する。
5. production-only negative search、focused GREEN、TypeScript、lint、`git diff --check`を実行し、結果を後続taskで追記する。

### T002の未実施事項

- 本タスクではproduction code、tests、fixtures、spec/tasks文書を変更しない。
- 本タスクでは旧routeの削除、redirect追加、server boundary実装、テスト更新を行わない。
- T002の分類は現行consumerの初期台帳であり、実装後の最終zero-consumer判定はT023、T025〜T027、T040、T050〜T053で更新する。

## T009: 純粋な町字分類・距離順helperの再利用境界

### 実施内容

- `src/lib/location/location-list-state.ts`の`calculateDistance()`と`sortLocationsByDistance()`は、既存の公開consumerを維持したまま純粋helperとして残した。
- `sortLocationsByDistance()`は、元の入力indexをdecorateして距離を比較し、同距離（`distance`未指定を含む）は入力順で明示的に解決する。入力配列は変更しない。
- `src/utils/clientGeoUtils.ts`の`isPointInPolygon()`、`isPointInMultiPolygon()`、`getAreaNameFromCoordinates()`、`formatAreaName()`、`groupLocationsByArea()`は、GeoJSONを引数に取る純粋な町字分類処理として維持した。`AddressLocation`はこれらの型シグネチャにのみ使われ、純粋処理へ実行時のデータ取得責務を追加していない。
- server-safe GeoJSON loaderとの重複をこの基盤taskで増やさず、`loadGeoJSON()`を含むclient境界および既存のproduction consumerは削除していない。

### consumer確認と後続削除候補

- `src/app/locations/page.tsx`は`calculateDistance()`、`sortLocationsByDistance()`、`groupCategoryLocationsByArea()`、`loadLocationCategories()`を使用している。`src/components/features/LocationCard.tsx`と`src/app/location-detail/[id]/page.tsx`は`findLocationAreaName()`へ到達するため、T009ではimport・wrapper・client GeoJSON fetchを削除しない。
- `geocodeAddress()`、`GeocodingResult`、場所ページ専用の住所・場所名検索state/UI、`source=locations` rate-limit branchはT040〜T044のGPS置換後削除候補として維持する。経路検索フォームのgeocoding consumerはretain/out-of-scopeのままとする。
- `LocationListState` reducer、`loadLocationCategories()`、`groupCategoryLocationsByArea()`、`findLocationAreaName()`、`clientGeoUtils.loadGeoJSON()`、場所pageのclient orchestrationは、置換ページ・GPS/origin・server area boundaryがGREENになるT050〜T052の削除ゲートまで維持する。
- `src/utils/geoUtils.ts`のserver-safe実装は変更せず、client実装との重複整理や純粋helperの最終移設は後続のconsumer censusで判定する。T009では旧consumerを壊すimport削除、client CDN fetch削除、tests/spec/plan変更を行っていない。

### T009実装前後の基準

- 実装前の基盤focused Jest: 4 suites / 45 tests GREEN。
- T009の最終検証結果は次項に記録した。

### T009検証結果

- `npm test -- --runInBand src/lib/location/__tests__/location-list-state.test.ts src/lib/location/__tests__/location-origin-query.test.ts src/lib/location/__tests__/location-page-data.test.ts src/utils/__tests__/addressLoader.test.ts`: GREEN、4 suites / 45 tests。
- `npx eslint src/lib/location/location-list-state.ts src/utils/clientGeoUtils.ts`: GREEN、exit 0。
- `npx tsx`の純粋helper probe: GREEN。距離同順位の入力順（`同距離A`→`同距離B`）、未計算距離の末尾維持、町字グループ内の入力順、「その他」fallbackを確認した。
- `npx tsc --noEmit --incremental false`: exit 2。既存の未完了route実装に対応する`src/app/locations/[category-id]/page.tsx`と`src/app/locations/location-detail/[id]/page.tsx`が存在しないため、生成済み`.next/types/validator.ts`の2 importで失敗した。T009変更ファイルを指す診断はない。
- `git diff --check`: GREEN、exit 0。
- consumer censusで、`src/app/locations/page.tsx`、旧detail page、`LocationCard.tsx`、既存location-list-state testからの公開consumerが残っていることを再確認した。commit、push、凍結テスト変更は行っていない。

## T023: 詳細ページ置換の確定契約と現行cleanup evidence

### 記録境界

- 確認日: 2026-09-06 (UTC)
- 対象ブランチ: `spec/issue-79-location-data-pages`
- 対象HEAD: `b2d6eeb060507f4640a19f517500917b3fa47178`
- T023は本台帳だけを追記した。production source、test、`tasks.md`、`spec.md`、`plan.md`、commit、pushは変更していない。
- 以下を分けて記録した。
  - T021、T022、T015Aの子報告。
  - 現行source、test、consumerの再確認。
  - 親側で共有されたGREEN結果と、T023時点のread-only再検証。
- 子報告のGREENだけで、旧routeの削除済みとは判定しない。

### 詳細ページ置換契約

| 契約 | 確定内容 | 現行source/testの証拠 |
|---|---|---|
| 正規URL | 旧`/location-detail/[id]`を新`/locations/location-detail/[id]`へ置換する。場所IDは`encodeURIComponent`で1つのpath segmentにする。 | `src/components/features/LocationCard.tsx:10-18`、`src/app/locations/[category-id]/page.tsx:193-210`、`src/app/locations/location-detail/[id]/page.tsx:316-359`。新route testは`src/app/locations/location-detail/[id]/__tests__/page.test.tsx:397`から開始する。 |
| 旧URLの扱い | 旧routeは正規ページとして残さない。新URLへの互換redirect、alias、fallbackを追加しない。 | production-onlyの旧route literal、import、redirect、alias検索は0件。ただし旧route directoryとroute fileはまだ存在するため、削除完了とは扱わない。 |
| unknown ID | データに存在しないIDはNext標準`notFound()`へ送る。ページ固有の404本文、一覧案内、redirectを表示しない。 | `src/app/locations/location-detail/[id]/page.tsx:323-328`、nested detail testのunknown ID。 |
| invalid ID | 空、slash、encoded slash、制御文字、malformed percent-encodingなどの不正IDは標準`notFound()`へ送る。 | `src/lib/location/location-detail-resolver.ts:39-45,122-133`、`src/app/locations/location-detail/[id]/__tests__/page.test.tsx:581-647`。 |
| duplicate ID | カテゴリ間の重複IDは任意の場所を選ばない。日本語data-errorを表示する。 | `src/lib/location/location-detail-resolver.ts:64-72,106-119,158-173`、`src/app/locations/location-detail/[id]/page.tsx:339-345`、nested detail test `duplicate-id` case。 |
| malformed data | 必須項目不備、カテゴリ・場所データの形式不正は標準404と混同しない。日本語data-errorを表示する。 | `src/lib/location/location-detail-resolver.ts:84-103,135-149`、`src/app/locations/location-detail/[id]/page.tsx:339-345`、nested detail test `invalid-data` case。 |
| load failure | HTTP、JSON、fetch rejectionは`data-load-error`へ分類する。日本語の取得失敗を表示する。 | `src/lib/location/location-page-data.ts:48-77`、`src/app/locations/location-detail/[id]/page.tsx:45-60,330-337`、nested detail testのHTTP/JSON/transport cases。 |
| back link | カテゴリを特定できる場合は`/locations/[category:en]`へ戻る。直接アクセスなどで特定できない場合は`/locations`へ戻る。どちらも`origin`を付けない。 | `src/app/locations/location-detail/[id]/page.tsx:105-126,348-358`、nested detail test `category back`とsafe `/locations` fallback。 |
| destination link | 既存の目的地JSON queryだけを`/`へ渡す。`origin`を渡さない。 | `src/app/locations/location-detail/[id]/page.tsx:128-143`、nested detail test `destination` assertion。 |
| optional display | 任意項目がない場合も、場所名、提供情報、ライセンス、目的地、戻り先を維持する。空ラベル、壊れた外部リンクは表示しない。 | `src/app/locations/location-detail/[id]/page.tsx:145-274`、nested detail testのoptional fixture。 |

### T021、T022、T015Aの実変更パス

| Task | 子報告のproduction変更 | 子報告のtest変更・証拠 | 責務の記録 |
|---|---|---|---|
| T021 | `src/app/locations/location-detail/[id]/page.tsx`、`src/app/locations/location-detail/[id]/loading.tsx` | 実装中のtest変更はなし。凍結testは`src/app/locations/location-detail/[id]/__tests__/page.test.tsx`。 | Next 15の`params` Promise、server loader 1回、resolver 1回、metadata、loading、標準404、data-error、back、destinationをnested routeへ実装した。 |
| T022A | production変更なし。 | `src/components/features/__tests__/LocationCard.test.tsx`だけを変更した。nested canonical href、server `areaName`、client area lookup不実行を4 testsで固定した。 | T022のproduction変更前にREDを作った。 |
| T022B | production、test、docs変更なし。 | 上記T022A testをread-only reviewし、`SUBAGENT_STATUS: COMPLETE`、`VERDICT: PASS`を返した。 | 公開DOMと公開function mockを確認した。 |
| T022 | `src/components/features/LocationCard.tsx`だけを変更した。 | T022Aで変更した`src/components/features/__tests__/LocationCard.test.tsx`を凍結してGREENにした。 | 旧href、`use client`、`useEffect`、`useState`、`findLocationAreaName`を除去した。`areaName`または`location.area`を表示し、nested native linkを生成する。 |
| T015A | `src/app/locations/[category-id]/page.tsx`だけを変更した。 | test変更なし。証拠testは`src/app/locations/[category-id]/__tests__/page.test.tsx`、`src/app/__tests__/page-layout-contract.test.ts`、`src/components/layouts/__tests__/semantic-layout-contract.test.ts`。 | カテゴリpageのh1を`PageHeader`へ集約し、非discussionの`article`を`div`へ置換した。カテゴリ内容、area、距離順、invalid-origin、native detail linkを維持した。 |

### server data、resolver、area、linkの責務

- **server data**: `src/lib/location/location-page-data.ts:41-77`が`loadKeyLocationsDataResult()`を呼ぶ。transport、JSON、必須項目、空カテゴリ、重複IDを成功状態へ隠さない。
- **wire validation**: `src/utils/addressLoader.ts:113-153,226-245`が`KeyLocation`、カテゴリ、version付きCDNの結果を検証する。結果は`success`または`error`で保持する。
- **detail resolver**: `src/lib/location/location-detail-resolver.ts:122-175`がrequest ID、loaded data、invalid-data、duplicate-id、not-found、data-load-errorを分類する。pageはこの分類を表示状態へ投影する。
- **server area**: `src/utils/geoUtils.ts:24-39,79-145`がserver-safeなGeoJSON読込と純粋な町字判定を持つ。`key_locations.json`の正規スキーマに`area`はないため、カテゴリpageの`allHaveArea`/`groupLocationsByProvidedArea`分岐とdetail pageの`location.area`優先分岐は、現在コードに残る非正規キー依存として削除対象にする。正規経路は座標からserver GeoJSONで町字を導出することとする。
- **card area**: 現行productionには`LocationCard.tsx`は存在せず、カテゴリpageの`LocationSummary`がtown modeでグループから渡された地域名を表示する。表示する地域名はserver GeoJSON由来の表示用地域名に統一し、client GeoJSON lookupや`location.area`の直接表示を復活させない。
- **detail link**: `LocationCard`とカテゴリpageは`/locations/location-detail/${encodeURIComponent(id)}`へ通常linkを作る。
- **back/destination**: detail pageのback linkはカテゴリpathまたは`/locations`だけを使う。destination linkは既存の座標・名称queryだけを使う。どちらも`origin`を追加しない。
- **category navigation**: `src/components/features/LocationCategoryNavigation.tsx:48-69,105-126`は有効な`origin`だけをカテゴリ間linkへ保持する。detail、entry、other linkへは転送しない。この責務はT023の旧detail削除完了判定に含めない。

### optional-field fixture matrix

| 項目 | ありfixture | なしfixture | 実証した維持・省略 |
|---|---|---|---|
| `image` | `completeLocation.imageUri`（`src/app/locations/location-detail/[id]/__tests__/page.test.tsx:68-82`） | `locationWithoutOptionalFields`に未指定（`:84-94`） | ありは画像を`alt=""`で表示する。なしは画像0件。 |
| `website` | `completeLocation.uri` | `locationWithoutOptionalFields`に未指定 | ありは外部linkを`target="_blank"`、`rel="noopener noreferrer"`で表示する。なしはlinkを表示しない。 |
| `imageCopyright` | `completeLocation.imageCopyright` | 未指定 | ありは`画像提供`の`dt`/`dd`を表示する。なしは空ラベルを表示しない。 |
| `descriptionCopyright` | `completeLocation.descriptionCopyright`と説明文 | 未指定。説明文も未指定 | ありは`説明文提供`を表示する。なしは空ラベルを表示しない。 |
| `region` | `key_locations.json`に地域名フィールドはなく、座標からserver GeoJSONで導出 | GeoJSONで座標を包含するfeatureがない場合 | 導出成功時は表示用地域名を`地域`として表示する。導出不能時は既存の`null`/`その他`扱いを維持する。 |
| 主要情報 | 両fixtureに`id`、`name`、`lat`、`lng`、`nodeCopyright`、`licence`、`licenceUri`を保持 | 同左 | optional欠落fixtureでもh1、提供情報、ライセンスを維持する。 |
| 目的地 | 両fixtureで`ここへ行く`を表示 | 同左 | 座標・名称から生成したdestination hrefを維持し、`origin`を含めない。 |
| back | 両fixtureでカテゴリdataから戻り先を解決 | 同左 | `/locations/public%20facilities`を維持し、`origin`を含めない。直接アクセス時は`/locations`へfallbackする。 |

- optional欠落の主要検証は`src/app/locations/location-detail/[id]/__tests__/page.test.tsx:490-549`にある。
- 地域名は`key_locations.json`の`area`ではなく、座標に対応するserver GeoJSONから導出する。現在の`location.area`優先分岐と、それを前提にしたfixtureは、表示用地域名の仕様に合わせて見直す対象である。

### 旧route cleanup evidence

- 現在も次の旧route production pathが存在する。
  - `src/app/location-detail/[id]/page.tsx`
  - `src/app/location-detail/[id]/loading.tsx`
- 旧route専用testも存在する。
  - `src/app/location-detail/[id]/__tests__/page.test.tsx`
- production-onlyのread-only negative searchは、`src/**/*.ts(x)`からtest、`__tests__`、spec資料を除外して実施した。旧`/location-detail/[id]` literal、旧route import、旧route redirect、旧route aliasの一致は0件だった。
- production側で確認できたdetail hrefは新pathだけである。
  - `src/app/locations/[category-id]/page.tsx:195`
  - `src/components/features/LocationCard.tsx:13`
- test側には、移行前の旧route consumerが残る。
  - `src/app/__tests__/accessibility-source-contract.test.ts:18,112`
  - `src/app/__tests__/accessible-route-pages.test.tsx:9-10,118`
  - `src/app/location-detail/[id]/__tests__/page.test.tsx:422`
  - `src/components/layouts/__tests__/SidebarLayout.test.tsx:39`
- この状態は「production consumerの旧href/importは0件」だが、「旧routeのroute登録と旧route専用testは残る」という状態である。完全削除済みとは記録しない。
- T023ではhard write boundaryに従い、旧route、旧test、旧importを削除しない。T024のfocused GREEN後に、T025がproduction consumerとtestを再censusする。T026が旧routeとsuperseded testを削除する。T027が旧route、旧import、旧redirectのproduction-only negative searchとfocused test、TypeScript、lint、diff checkを再実行する。
- 後続taskへ残す理由は、T023が置換契約の記録taskであり、旧route削除には置換GREEN、test移行、削除後のzero-consumer証明が必要だからである。

### 検証結果の出所を分けた記録

#### 子報告

- **T021子報告**: nested detail RED 15件を確認し、GREENは1 suite / 15 tests。resolver、page-data、addressLoaderの関連3 suites / 33 testsもGREEN。strict TypeScriptはexit 0。対象ESLintはexit 0で`<img>` warning 1件。`git diff --check`はexit 0。変更pathはnested detail pageとloadingだけだった。
- **T022A子報告**: `LocationCard.test.tsx`の4 tests中2件がRED。旧hrefとclient area lookupを検出した。T022Bのfresh reviewは`SUBAGENT_STATUS: COMPLETE`、`VERDICT: PASS`だった。
- **T022子報告**: LocationCardの4 testsがGREEN。関連7 suites / 58 testsがGREEN。strict TypeScriptはexit 0。対象ESLintはexit 0で`<img>` warning 1件。`git diff --check`はexit 0。T022時点のfull Jestは148 suites pass、T015A未反映のカテゴリh1/article契約で2 suites / 3 testsが失敗した。この当時の結果を現行full結果と混同しない。
- **T015A子報告**: REDは2 suites / 3 tests failed、17 tests passed。修正後はカテゴリpage、page-layout、semantic-layoutの3 suites / 20 testsがGREEN。strict TypeScriptはexit 0。対象ESLintはexit 0で既存`<img>` warning 1件。`git diff --check`はexit 0。

#### T023時点の親側・現行read-only再検証

- focused aggregate: 8 suites / 72 tests passed。対象はnested detail、LocationCard、category page、page-layout、semantic-layout、resolver、page-data、addressLoaderである。
- full Jest: `npm test -- --runInBand`はexit 0。150 suites passed、2 suites skipped。983 tests passed、13 tests skipped。旧route専用testもこのfull runに含まれたため、full GREENは旧route削除の証明ではない。
- strict TypeScript: `node node_modules/typescript/bin/tsc --noEmit --incremental false`はexit 0。
- scoped ESLint: T021、T022、T015Aのsource/test pathsはexit 0、error 0、`<img>` warning 3件。warningは`src/app/locations/[category-id]/page.tsx:199`、`src/app/locations/location-detail/[id]/page.tsx:241`、`src/components/features/LocationCard.tsx:22`である。
- full lint: `npm run lint`はexit 0。`next lint` deprecated noticeと既存warningを含むが、errorは0件だった。
- diff: `git diff --check`はexit 0。
- T023のsource searchは、production-only旧route negative searchが0件であることと、旧route directory・旧route専用testが残ることを同時に確認した。したがって、旧route完全削除の判定はT025〜T027へ残す。

## T025: 旧detail route削除前 consumer census

### 記録境界と前提

- 確認日: 2026-09-06 (UTC)
- 対象ブランチ: `spec/issue-79-location-data-pages`
- 対象HEAD: `b2d6eeb060507f4640a19f517500917b3fa47178`
- T025で書き込んだパスは本台帳だけである。production source、route、test、fixture、`tasks.md`、`spec.md`、`plan.md`、その他の履歴資料、commit、pushは変更していない。作業ツリーにある親タスク由来の既存変更は保持した。
- T024の前提は、親側共有のfocused GREEN（8 suites / 85 tests）である。T025では実装・テスト変更を行わず、削除前のread-only censusと台帳記録だけを行った。
- T021/T022で確定した`/locations/location-detail/[id]`のnested canonical route、カテゴリへのback link、目的地linkがGREENであることを前提にした。旧`/location-detail/[id]`の互換redirect、alias、fallbackは追加しない。
- production判定は`src/**`の実行時コードから`__tests__`、`*.test.*`、fixture、コメント、spec/plan/research等の履歴資料を除外した。test/docsは別の台帳へ分けた。route directory自身の存在はconsumer 0件とは数えず、削除前のproduction pathとして明記した。

### 一括検索条件と結果

- production側では、旧route path `src/app/location-detail/[id]/`、旧URL literal `/location-detail/[id]`、旧route import（`@/app/location-detail/[id]`、`src/app/location-detail/[id]`）、旧href、`redirect`/`permanentRedirect`/`rewrite`と旧URLの組み合わせ、compatibility alias/fallbackを検索した。
- test/docs側では、上記の旧path/literal/importに加え、旧route専用fixture/test、`LocationCard`の旧href/旧`findLocationAreaName` import、既存accessibility contractのroute pathを一括検索した。
- production content上、旧routeの外部import、旧URL literal、旧href、旧routeへのredirect/alias/fallbackは0件だった。ただし旧route登録そのものと、そのpage内部の`findLocationAreaName()` client area fallbackは残っているため、「production consumerが完全に0件」とは記録しない。
- 現行productionの詳細hrefは次の新pathだけである。`src/components/features/LocationCard.tsx:13-18`、`src/app/locations/[category-id]/page.tsx:194-196`。`LocationCard`のimportも`next/link`と`KeyLocation`だけで、旧detail importは残っていない。
- 旧route path/importのtest側一致は、旧route専用test、accessibility source contract、accessible-route contract、SidebarLayout contractの4ファイルであった。別途、`LocationCard.test.tsx`には旧client area lookupをmockするtest-only importが残っていた。
- `/api/geocode`、`DestinationSelector`、`OriginSelector`、`useGeocodingSearch`、`geocoding-search`、経路検索のrate-limit branchは旧detail routeのconsumerではない。経路検索フォームの責務としてretain / out-of-scopeにし、T025/T026の削除対象へ含めない。

### production census

| 現時点の参照パス | 現行の事実 | 判定 | T026以降の扱い |
|---|---|---|---|
| `src/app/location-detail/[id]/page.tsx` | 旧`/location-detail/[id]`を登録するroute本体。`loadKeyLocationsDataResult()`、`resolveLocationDetail()`、`findLocationAreaName()`を内部で使い、旧page markup、旧error shell、`"不明"`へのclient area fallbackを持つ。 | **delete** | T026でroute本体を削除する。resolver、loader、結果型はnested route側で再利用するが、旧page markupと旧fallbackは移植しない。 |
| `src/app/location-detail/[id]/loading.tsx` | 旧routeのloading boundary。 | **delete** | T026で旧routeと同時に削除する。新`src/app/locations/location-detail/[id]/loading.tsx`はretainする。 |
| `src/lib/location/location-list-state.ts:178-184`の`findLocationAreaName()` | production import/callは現時点では旧route pageだけである。`LocationCard`本体とnested detail pageはimportしていない。 | **delete候補**（旧route側のimport/callはdelete、helper本体は後続） | 旧route削除後はproduction consumer 0件になるが、helper本体の削除はT050/T051のobsolete location-list state censusへ残す。T026ではshared moduleを変更しない。 |
| `src/components/features/LocationCard.tsx:1-18` | 現行は`next/link`で`/locations/location-detail/${encodeURIComponent(id)}`を生成し、server-provided `areaName`または埋込`location.area`を表示する。旧href、旧`findLocationAreaName` import、client lookupはない。 | **retain**（旧href/importは既にdelete済み） | T026ではproduction変更しない。現行nested hrefを維持する。 |
| `src/app/locations/[category-id]/page.tsx:194-196` | カテゴリ一覧のnative anchorは新nested canonical hrefだけを生成する。 | **retain** | T026では変更しない。 |
| `src/app/locations/location-detail/[id]/page.tsx:7-13,45-60,76-88,348-359` | 新nested routeはshared resolver、server data boundary、server-safe GeoJSON area fallback、カテゴリback link、既存destination queryを所有する。 | **retain / move-reuse** | T026の削除対象に含めない。新routeのback/destinationは互換redirectではない。 |
| `src/lib/location/location-detail-resolver.ts`、`src/lib/location/location-page-data.ts`、`src/utils/addressLoader.ts`、`src/utils/geoUtils.ts`、`src/types/access-route-pages.ts` | nested detail/categoryのshared resolver、data/status、型、server area境界である。旧routeだけの実装ではない。 | **retain / move-reuse** | 旧route削除で巻き込まない。 |
| `src/app/locations/page.tsx:50` | `redirect`で`/locations/${...}`へ遷移する処理は`/locations`入口を先頭カテゴリへ解決する新contractであり、旧detail route redirectではない。 | **retain** | 削除しない。 |
| `src/components/features/DestinationSelector.tsx`、`OriginSelector.tsx`、`useGeocodingSearch.ts`、`src/lib/location/geocoding-search.ts`、`src/app/api/geocode/route.ts` | 経路検索フォームの住所/geocode consumer。旧detail routeとは別featureである。 | **retain / out-of-scope** | T025/T026の旧detail削除で変更しない。`/api/geocode`を旧route negative searchの削除対象にしない。 |

#### production判定の要約

- 削除前に残る旧route production registration: 2 files（`page.tsx`、`loading.tsx`）。
- 旧routeを参照する外部production import/redirect/alias/old href: 0件。
- 旧route内部のproduction fallback consumer: `findLocationAreaName()` 1件（旧pageの内部参照）。これはroute削除とともに消えるが、helper本体の後続削除とは分離する。
- 新canonical hrefのproduction生成箇所: `LocationCard`とカテゴリpageの2箇所。これらはretainする。

### test census

| 現時点の参照パス | 現行の事実 | 判定 | T026の更新方針 |
|---|---|---|---|
| `src/app/location-detail/[id]/__tests__/page.test.tsx:19-762`（旧route専用fixtureを含む） | `primaryLocation`、`minimalLocation`、metadata用fixture、state matrix、旧page/loadingの公開契約を持ち、`describe("/location-detail/[id] public route")`で旧routeを直接検証する。 | **delete** | T026で旧routeとともにtest全体を削除する。nested route testがvalid/metadata/404/data-error/loading/back/destination/optional-field契約を担うため、旧fixture群を移植しない。 |
| `src/app/__tests__/accessibility-source-contract.test.ts:15-19,86-126` | `dedicatedPageFiles`とmarker mapに旧`src/app/location-detail/[id]/page.tsx`を登録している。 | **update** | 旧pathを`src/app/locations/location-detail/[id]/page.tsx`へ置換し、共通main/header/native-link contractを新canonical pageへ向ける。 |
| `src/app/__tests__/accessible-route-pages.test.tsx:7-10,112-119` | 旧page/loadingをimportし、失敗時の説明文字列にも`/location-detail/[id]`を使う。 | **update** | page/loading importとエラー説明をnested canonical pathへ更新する。testのsemantic/a11y責務はretainする。 |
| `src/components/layouts/__tests__/SidebarLayout.test.tsx:8-22,36-49,152-208` | `locationDetailFixture`を使い、`require("@/app/location-detail/[id]/page")`で旧pageをshared main/Ko-fi hostに通している。 | **update** | require先だけをnested canonical pageへ更新し、fixtureとSidebarLayoutのhost契約はretainする。 |
| `src/components/features/__tests__/LocationCard.test.tsx:1-37,76-84` | productionでは消えた`@/lib/location/location-list-state`の`findLocationAreaName`をmockし、spyと`waitFor`でclient lookup不実行を検証している。canonical href/server area testsは新contractである。 | **update** | 旧client lookup mock/type/spy/setupと、旧importに依存するassertionを削除または新server-provided-area契約へ整理する。canonical hrefとarea表示テストは残す。 |
| `src/app/locations/location-detail/[id]/__tests__/page.test.tsx`、`src/app/locations/[category-id]/__tests__/page.test.tsx`、`src/components/features/__tests__/LocationCategoryNavigation.test.tsx`、`src/lib/location/__tests__/location-origin-query.test.ts` | new `/locations/location-detail/[id]` href、detail/otherのorigin破棄、nested pageのerror/back/destinationを検証する置換側testである。 | **retain** | T026で削除・旧pathへの巻き戻しをしない。 |
| `src/lib/location/__tests__/location-detail-resolver.test.ts`、`src/lib/location/__tests__/location-page-data.test.ts` | resolver/data boundaryの共有契約testであり、旧route固有のpage consumerではない。 | **retain** | T026で変更しない。 |

### test/docs検索の扱い

- exact old path/literalを含むdocsは、current Spec023の`spec.md`、`plan.md`、`research.md`、`contracts/location-pages.md`、`quickstart.md`、`checklists/requirements.md`、`tasks.md`、本台帳、および旧仕様の`specs/018-accessible-route-pages/**`、`specs/019-location-detail-accessibility/**`、`issues/106-span-element-cleanup/tasks.md`に限られた。
- これらは旧URLの設計履歴、アクセシビリティ契約、削除条件、negative-search条件を記録する履歴資料であり、runtime consumerではない。T026ではdocsを更新・削除せず、T001/T002/T009/T023の既存記録も保持する。
- current Spec023 docsが`/location-detail/[id]`を記載する場合も、旧URLを残す指示ではなく「廃止・redirectなし」の契約または削除前後の検索条件である。旧URLを動かすcompatibility redirect、alias、fallbackを追加する根拠にはしない。

### T026削除マニフェスト

T026で許可する変更を次に固定する。ここにないproduction source、route、shared helper、docs、testは変更しない。

**Delete**

1. `src/app/location-detail/[id]/page.tsx`
2. `src/app/location-detail/[id]/loading.tsx`
3. `src/app/location-detail/[id]/__tests__/page.test.tsx`（旧route専用fixtureとsuperseded testを含む）

**Update only**

1. `src/app/__tests__/accessibility-source-contract.test.ts`: dedicated page path/markerをnested canonical pageへ変更する。
2. `src/app/__tests__/accessible-route-pages.test.tsx`: page/loading importと旧route説明文字列をnested canonical pathへ変更する。
3. `src/components/layouts/__tests__/SidebarLayout.test.tsx`:旧pageのrequire先をnested canonical pageへ変更する。
4. `src/components/features/__tests__/LocationCard.test.tsx`:削除済みclient area lookupのmock/type/spy/setupを整理し、canonical href/server area契約は保持する。

**Retain / do not touch in T026**

- `src/app/locations/location-detail/[id]/page.tsx`、`loading.tsx`、nested detail test。
- `src/components/features/LocationCard.tsx`、カテゴリpageの新canonical href、resolver/data/GeoJSON/typeのshared boundary。
- `src/lib/location/location-list-state.ts`本体。`findLocationAreaName()`の未使用化後の最終削除はT050/T051で判定する。
- 経路検索フォームと`/api/geocode`。旧detail routeの削除に便乗したgeocode/state/API削除はしない。
- spec/tasks/plan/research/contractなどの履歴資料。T001/T002/T009/T023の既存記録を改変しない。

T026は、削除の代わりに旧URLから新URLへ遷移するcompatibility redirect、alias、hidden fallback、duplicate routeを追加しない。

### T027 negative search条件

T026後、T027は次の条件でproduction-only negative searchを実行し、結果を本台帳へ追記する。

1. 対象は`src/**/*.ts(x)`の実行時production codeだけとし、`__tests__`、`*.test.*`、fixture、コメント、`specs/**`、`issues/**`、Git履歴を除外する。
2. 旧route file/path `src/app/location-detail/[id]/`、旧URL literal `/location-detail/[id]`、旧import `@/app/location-detail/[id]` / `src/app/location-detail/[id]` / relative old-route import、旧href、旧route登録を検索する。
3. `redirect`、`permanentRedirect`、`rewrite`、`NextResponse.redirect`等を旧URLと組み合わせて検索し、compatibility redirect、alias、fallback、legacy routeが0件であることを確認する。
4. `LocationCard`とカテゴリpageのhrefが`/locations/location-detail/${encodeURIComponent(id)}`のままであること、nested detail pageのback/destinationが旧URLを生成しないことを確認する。
5. `/api/geocode`、`DestinationSelector`、`OriginSelector`、`useGeocodingSearch`、route-formのrate-limit branchは検索結果から誤削除しない保護対象として明記する。
6. nested detail focused suite、strict TypeScript、scoped lint、`git diff --check`をT027で実行し、旧route削除後のproduction consumer 0件を「route path/fileも存在しない」状態で初めて記録する。T025時点ではroute本体と旧route testが残るため、zero consumerとは記録しない。

### T025検証結果

- source census: 旧route production path 2件、旧route外部production import/redirect/alias/old href 0件、旧route内部`findLocationAreaName()` fallback 1件、影響test 5ファイル（delete 1、update 4）を確認した。
- canonical replacement確認: `LocationCard`、カテゴリpage、nested detail pageとreplacement testsは新`/locations/location-detail/[id]`を参照している。旧URLへの互換redirect/alias/fallbackは追加していない。
- route-form保護確認: `/api/geocode`および経路検索フォームのgeocoding consumerは旧detail route censusの削除候補に含めなかった。
- `git diff --check`: T025台帳追記後の実行結果はexit 0だった。
- 改行・末尾空白: byte checkの結果は`lines=325`、`crlf=0`、`lone_cr=0`、`trailing_whitespace_lines=[]`、`ends_with_lf=True`だった。
- T025ではfocused Jest、TypeScript、lint、build、commit、pushを実行していない。T024の8 suites / 85 tests GREENは前提結果として扱い、T027で削除後の検証を行う。

## T027: 旧detail route削除後のproduction-only negative searchと検証

### 実施境界

- 確認日時: 2026-09-06 20:20 UTC
- 対象ブランチ: `spec/issue-79-location-data-pages`
- T027で書き込んだパスは本台帳だけである。T023、T025、T026の既存記録と、親タスク由来のproduction/test/spec/tasks/plan変更は保持した。T027ではproduction source、test、fixture、`spec.md`、`plan.md`、`tasks.md`、その他履歴資料、commit、pushを変更していない。
- production-only検索は`src/**/*.ts(x)`の実行時コード178ファイルを対象にした。`__tests__`、`__mocks__`、fixture、`*.test.*`、`*.spec.*`を除外し、JavaScript/TypeScriptのline/block commentを検索本文から除外した。`specs/**`、`issues/**`、Git履歴、test/docsはproduction consumer判定に含めていない。

### production-only negative search

| 検索対象 | 結果 |
|---|---|
| 旧route file `src/app/location-detail/[id]/page.tsx` | 0件。実体ファイルは存在しない。 |
| 旧route loading `src/app/location-detail/[id]/loading.tsx` | 0件。実体ファイルは存在しない。 |
| 旧route専用test `src/app/location-detail/[id]/__tests__/page.test.tsx` | 0件。実体ファイルは存在しない。 |
| 旧route path/route registration `src/app/location-detail/[id]/` | 0件。再帰的なファイル実体は0件で、Next routeを登録する`page.tsx`/`loading.tsx`もない。なお削除後の作業ツリーには空のdirectory entry（`[id]/`と`__tests__/`）だけが残っており、追跡対象のfile/route registrationではない。ledger-onlyのwrite boundaryに従い、directory自体の削除は行っていない。 |
| 旧URL literal `/location-detail/[id]` | 0件。 |
| 旧href/旧route prefix `/location-detail/`（canonical `/locations/location-detail/`を除外） | 0件。 |
| 旧route import（`@/app/location-detail/[id]`、`src/app/location-detail/[id]`、relative old-route import） | 0件。 |
| `redirect`/`permanentRedirect`/`rewrite`/`NextResponse.redirect` と旧URLの組合せ | 0ファイル。 |
| compatibility alias、legacy/hidden fallback と旧routeの組合せ | 0ファイル。 |

- production-only判定は、旧route file、旧URL、旧import、旧href、旧route registration、旧redirect、compatibility alias、hidden fallbackの全項目で0 consumerとなった。空directory entryはroute fileではなく、T027の許可書込パス外なので変更していない。
- 非productionの残存は意図的なtest/docs/historyである。旧URL literalのtest残存は次の4ファイル（合計10箇所）で、旧routeを実行時にimportまたは登録するものではなく、旧URLを生成しないnegative/accessibility契約または移行履歴の確認である。
  - `src/app/__tests__/accessibility-source-contract.test.ts`
  - `src/app/__tests__/accessible-route-pages.test.tsx`
  - `src/app/locations/location-detail/[id]/__tests__/page.test.tsx`
  - `src/components/layouts/__tests__/SidebarLayout.test.tsx`
- `specs/018-accessible-route-pages/**`、`specs/019-location-detail-accessibility/**`、`specs/023-location-data-pages/**`、`issues/106-span-element-cleanup/**`には旧URL・旧pathの設計履歴、削除条件、negative-search条件が残る。これはproduction consumerではない。本台帳自身も判定語と証跡のため旧文字列を保持する。
- strict TypeScript後に生成・更新された無視対象の`tsconfig.tsbuildinfo`にも旧文字列が入るが、`src/**/*.ts(x)`のproduction-only検索対象外である。

### canonical hrefとback/destinationの保護確認

- `src/components/features/LocationCard.tsx:13`は`/locations/location-detail/${encodeURIComponent(location.id)}`を1箇所生成し、旧URL literal/prefixは0件だった。
- `src/app/locations/[category-id]/page.tsx:195`は`/locations/location-detail/${encodeURIComponent(location.id)}`を1箇所生成し、旧URL literal/prefixは0件だった。
- `src/app/locations/location-detail/[id]/page.tsx`のbackは`/locations`（直接アクセス時）または`/locations/${encodeURIComponent(category["category:en"])}`（`:112,120`）、destinationは`/?destination=${encodeURIComponent(JSON.stringify(destination))}`（`:137`）だけである。旧URL prefixは0件で、back/destinationへ`origin`を生成していない。

### route-form保護対象

- `/api/geocode` (`src/app/api/geocode/route.ts`)、`DestinationSelector`、`OriginSelector`、`useGeocodingSearch`、`src/lib/location/geocoding-search.ts`は実体を保持した。
- 経路検索フォームのrate-limitも保持した。`OriginSelector`/`useGeocodingSearch`の`/rate-limit?source=home`、`RouteSearchResults`の`/rate-limit?source=routes`、`RateLimitSource`の`home`/`routes` allowlistは残っている。
- `git status --short --untracked-files=all`のT027実施前後確認で、上記route-form保護対象に変更pathはなかった。旧detail削除のnegative searchで`/api/geocode`、selectors、hook、home/routes rate-limitを削除対象に誤分類していない。

### 検証結果

- focused関連Jest（nested detail、LocationCard、category/root、category navigation、resolver、data、loader、移行後のaccessibility/layout契約を含む13 suites）: `npm test -- --runInBand --testPathPattern=...`、13 suites / 104 tests GREEN、exit 0。最初の`--runTestsByPath`は`[id]`を含むcombined patternのwarningを出したため、最終証跡はliteral-safeな`--testPathPattern`で再実行した結果とする。
- full Jest: `npm test -- --runInBand`、149 suites passed、2 suites skipped（151 total）、963 tests passed、13 tests skipped（976 total）、exit 0。
- strict TypeScript: `npx tsc --noEmit --incremental false`、exit 0。
- 対象ESLint: `npx eslint`でT027関連のproduction/test pathsを実行、exit 0、error 0、warning 3。warningは`no-img-element`のみ（`src/app/locations/[category-id]/page.tsx:199`、`src/app/locations/location-detail/[id]/page.tsx:241`、`src/components/features/LocationCard.tsx:22`）。
- full lint: `npm run lint`、exit 0、error 0。`next lint` deprecated noticeと、既存の`no-explicit-any`、hook dependency、unused-disable、`no-img-element`のwarningだけを確認した。warning/deprecated noticeをerrorとは分類していない。
- diff: `git diff --check`、exit 0。
- status: read-onlyの`git status --short --untracked-files=all`はexit 0。T027による追加変更は本台帳だけであり、T026の旧route削除（3 files）、移行test更新、nested route等の既存変更pathを改変していない。

### T027の判定

- 旧detail routeのproduction consumer、旧import、旧href、旧redirect、compatibility alias/fallbackは0件。旧routeの実体fileも0件である。
- route-formの`/api/geocode`、`DestinationSelector`、`OriginSelector`、`useGeocodingSearch`、home/routes rate-limitはretainした。
- T023/T025/T026の既存記録は保持し、T027の検証結果だけを本節へ追記した。

## T040: 場所ページobsolete consumerのproduction census

### 実施境界と開始状態

- 確認日: 2026-09-07 (UTC)
- 開始確認日時: 2026-09-07 04:42 UTC
- 対象ブランチ: `spec/issue-79-location-data-pages`
- 開始時HEAD: `b2d6eeb060507f4640a19f517500917b3fa47178`
- T040は本台帳だけを追記するproduction consumer censusである。production source、test、fixture、spec、plan、research、tasks、commit、pushは変更しない。
- 開始時の`git status --short --untracked-files=all`は40行であった。status出力のSHA-256は`4133753c17aad58524c2c98d330928a4e1d31736f070a4a60cf24c9c9bb1b38a`である。
- 親側のT039までの未コミット変更を既存状態として保持した。開始時の変更pathには`tasks.md`、場所ページ、route-form、既存test、置換route、replacement helperが含まれていた。

### production-only検索境界

- 対象は現行`src/**/*.ts(x)`の実行時production code 178ファイルである。
- `__tests__`、`*.test.*`、`*.spec.*`、fixture、`__mocks__`、コメント、`specs/**`、`issues/**`、Git履歴、`.next`をproduction consumer判定から除外した。
- JavaScript/TypeScriptの行コメント・block commentを検索本文から除外し、文字列内のruntime文字列だけを候補として記録した。
- test/docs/historyの一致はproduction consumerと数えず、route-formの実consumerと分離して記録した。
- 判定語はT002の定義に従う。`delete`はobsolete runtime code、`move/reuse`は新server境界または純粋helperへの移設・再利用、`retain`は現行consumerを持つruntime code、`out-of-scope`はroute-formの別責務を表す。

### obsolete geocode、住所・場所名検索のcensus

| Candidate | 現行production consumerと証拠 | 判定 | replacementと後続境界 |
|---|---|---|---|
| `geocodeAddress`、`GeocodingResult` | `src/lib/location/location-list-state.ts:24-34,131-162`に型と関数の定義が残る。production import/callは0件である。現行`src/app/locations/page.tsx:36-51`はserver dataを読み、先頭カテゴリへredirectするだけで、住所入力・場所名検索・`geocodeAddress()`呼出しを持たない。 | **delete** | `src/app/locations/[category-id]/page.tsx:300-347`の`origin`処理と`src/components/features/LocationSortControls.tsx:59-152`のGPS操作へ置換済みである。T043で関数、結果型、場所page専用stateを削除し、T044でproduction-only negative searchを行う。 |
| 場所ページの住所・場所名検索state/UI | 旧`address`、`searchLoading`、`searchError`、検索form、場所page専用rate-limit遷移のproduction consumerは現行treeに0件である。`src/app/locations/page.tsx:36-51`は新redirectであり、旧controlsをrenderしない。 | **delete** | `origin=<latitude>,<longitude>`とGPS明示操作がreplacementである。T043の削除対象は場所page責務だけとし、下記route-formの同名入力UIへ拡張しない。 |
| route-formの`useGeocodingSearch` | `src/components/features/useGeocodingSearch.ts:6-30`が`searchGeocoding()`、loading/error state、home rate-limit遷移を持つ。`src/components/features/DestinationSelector.tsx:10,24`と`src/components/features/OriginSelector.tsx:10,25`がproduction consumerである。 | **retain / out-of-scope** | 目的地・出発地の検索責務である。T043/T044のlocation-page geocode削除やnegative searchで削除しない。 |
| route-formの`geocoding`、`searchGeocoding` | `src/lib/location/geocoding-search.ts:3-40`がroute-form共有の正規化、`/api/geocode` fetch、429/error/result変換を実行する。consumerは`useGeocodingSearch`だけでなく、そのhookを使うDestination/Origin selectorである。 | **retain / out-of-scope** | `geocodeAddress`とは別実装・別責務である。T043は`location-list-state.ts`のobsolete関数だけを対象にし、route-form共有serviceは保持する。 |
| `/api/geocode` | `src/app/api/geocode/route.ts:6-101`は現行API routeである。間接consumerは`useGeocodingSearch`経由のDestination/Origin selector、直接consumerは`src/components/features/OriginSelector.tsx:52-66`のGPS後reverse geocodeである。 | **retain / out-of-scope** | route-formの名前検索とreverse geocodeに必要である。場所ページがこのAPIを呼ばないことは、API自体のproduction consumer 0を意味しない。T044のnegative searchから保護する。 |
| `DestinationSelector`、`OriginSelector` | `src/components/features/DestinationSelector.tsx:13-71`は目的地の名前検索と`LocationSuggestions`選択を持つ。`src/components/features/OriginSelector.tsx:13-141`は出発地の名前検索、GPS、reverse geocodeを持つ。`src/components/features/HomeRouteForm.tsx:99-112`が両方を実行時に注入する。 | **retain / out-of-scope** | route-formの責務である。場所ページ削除候補へ混ぜない。T043〜T044はこれらのproduction pathを変更しない。 |
| `LocationSuggestions`の注入callback | `src/components/features/LocationSuggestions.tsx:11-28,45-83`は`onLocationSelected`で選択結果を返す。`src/components/features/DestinationSelector.tsx:31-40`がcallbackを注入し、`src/components/features/HomeRouteForm.tsx:99-102`がcategoriesを渡す。 | **retain / out-of-scope** | route-formのpopular facility選択である。callback、category展開、選択結果の`convertToLocation()`を場所pageのobsolete search削除へ巻き込まない。 |

### location-page rate-limit sourceのcensus

| Candidate | 現行production consumerと証拠 | 判定 | replacementと後続境界 |
|---|---|---|---|
| `source=locations` | production-only検索で`source=locations`のruntime literal/callerは0件である。現行callerは`src/components/features/OriginSelector.tsx:60`と`src/components/features/useGeocodingSearch.ts:19`の`source=home`、`src/components/features/RouteSearchResults.tsx:118`の`source=routes`だけである。 | **delete** | 場所pageに住所検索がないため専用source callerを復活させない。T043で専用armを削除し、T044で`source=locations`のproduction-only 0件を再確認する。 |
| `RateLimitSource`の`"locations"` union arm | `src/types/access-route-pages.ts:6-7`の`RateLimitSource`は`"home" \| "locations" \| "routes"`である。型のlocations armを実行時に必要とする外部production consumerは0件である。home/routesはroute-formで保持する。 | **delete**（locations arm）/**retain**（home/routes） | T043でlocations armだけを削除候補にする。`RateLimitSource`全体、home/routes rate-limit契約、route-formの429遷移は削除しない。 |
| `getRateLimitReturnPath()`のlocations-specific arm | `src/lib/navigation/rate-limit-source.ts:5-20`の`RATE_LIMIT_RETURN_PATHS.locations`（9行）と`source === "locations"`条件（15-16行）が専用armである。`src/app/rate-limit/page.tsx:14-38`はgeneric rate-limit pageとして関数を使用する。 | **delete**（locations arm）/**retain**（generic pageとsafe fallback） | T043でmap entry、allowlist条件、型unionのlocations armを削除候補にする。unknown sourceのsafe `/locations` fallbackとgeneric rate-limit pageは、`source=locations` callerとは分離してT044で再判定する。 |
| location-page rate-limit UI/return boundary | 現行場所pageにrate-limit遷移UIは0件である。generic `src/app/rate-limit/page.tsx:17-19,34-38`は、home/routesを含む共有return boundaryとして残る。 | **delete**（location-specific branch）/**retain**（shared page） | T043は共有rate-limit page、home/routes caller、API middlewareを削除しない。T044は専用sourceの0件とroute-form保護を同時に記録する。 |

### `CategoryTabs`、active-category、旧list stateのcensus

| Candidate | 現行production consumerと証拠 | 判定 | replacementと後続境界 |
|---|---|---|---|
| 場所pageのold `CategoryTabs` usage | 現行`src/app/locations/page.tsx:36-51`に`CategoryTabs` import/renderはない。旧場所pageのtabとlocal `activeCategory` consumerはproduction-only 0件である。 | **delete**（旧usage） | `src/components/features/LocationCategoryNavigation.tsx:58-132`のURL `Link`、`aria-current="page"`、origin保持へ置換済みである。T050で削除前censusを確定し、T051/T052でnegative searchを行う。 |
| `CategoryTabs`本体 | `src/components/ui/CategoryTabs.tsx:5-81`の現行production consumerは`src/components/features/LocationSuggestions.tsx:9,45-52`の1件である。場所page以外のroute-form consumerが残るため、component本体のconsumerは0件ではない。 | **retain / out-of-scope** | T051の「consumer 0件なら本体削除」条件を満たさない。LocationSuggestionsのfacility category tabを保持し、T052で誤削除がないことを確認する。 |
| `LocationSuggestions`のactive-category state | `src/components/features/LocationSuggestions.tsx:20-35,54-83`がroute-formのfacility選択に必要なlocal stateを実行時に使う。場所pageのactive-category stateとは別component・別責務である。 | **retain / out-of-scope** | `HomeRouteForm`から渡すpopular categoriesを表示するroute-form責務として保持する。T050/T051はこのstateを場所pageのobsolete stateと同一視しない。 |
| `LocationListState`、`LocationListAction`、`LocationListOperation` | `src/lib/location/location-list-state.ts:14-50`に定義がある。reducer state/actionのproduction import/callは0件である。ただし同一moduleの`calculateDistance()`、`sortLocationsByDistance()`だけを`src/app/locations/[category-id]/page.tsx:4-6,304-316`が使用する。 | **delete**（state/action/reducer部分）/**retain / move-reuse**（pure distance部分） | T051でreducerとold orchestrationを削除候補にする。module全体はpure helperの移設または再利用を確定するまで削除しない。 |
| `createInitialLocationListState()`、`reduceLocationListState()` | `src/lib/location/location-list-state.ts:52-92`に定義がある。production consumerは0件で、現在確認できる参照は除外対象の`src/lib/location/__tests__/location-list-state.test.ts`だけである。 | **delete** | 新カテゴリpageはURL `origin`、server data、local GPS controlへ責務を分割済みである。T050/T051でtest-only参照とproduction削除を分離し、T052で0 consumerを検証する。 |
| 旧position orchestration | `LocationListState.position`、`LocationListOperation: "position"`、`position-ready`、requestIdによる旧非同期制御は`src/lib/location/location-list-state.ts:15,38-49,87-90`に残るが、runtime callerは0件である。 | **delete** | `src/components/features/LocationSortControls.tsx:59-152`のGPS callback、`src/lib/location/location-origin-query.ts:1-75`のURL parse/serialize、category server renderへ置換済みである。T050/T051/T052のold state削除境界に含める。 |
| `loadLocationCategories()`とold key-location loader | `src/lib/location/location-list-state.ts:3-6,165-166`がold `loadKeyLocationsData()`をwrapperする。`loadLocationCategories()`と`loadKeyLocationsData()`のproduction callは0件である。 | **delete**（old wrapper）/**retain / move-reuse**（result loader） | `src/lib/location/location-page-data.ts:1-8,41-78`が`loadKeyLocationsDataResult()`を使い、locations entry/layout/category/detailがserver data boundaryを共有する。T050/T051でold wrapperを削除候補とし、T052でresult loaderを保護する。 |
| `groupCategoryLocationsByArea()` | `src/lib/location/location-list-state.ts:169-176`のclient wrapperにproduction consumerは0件である。現行category pageは`src/app/locations/[category-id]/page.tsx:164-181`からserver `groupLocationsByArea()`を使う。 | **delete**（old wrapper）/**move-reuse**（area grouping） | server `src/utils/geoUtils.ts:121-154,232-261`と`src/lib/location/location-page-data.ts:8`をreplacementとする。T050/T051でclient wrapperを削除し、T052でserver groupingを保持する。 |
| `findLocationAreaName()` | `src/lib/location/location-list-state.ts:178-184`に定義があるが、現行production import/callは0件である。`LocationCard`は`src/components/features/LocationCard.tsx:10-14,31-34`のserver-provided areaを表示する。 | **delete** | detail pageは`src/app/locations/location-detail/[id]/page.tsx:89-100,361-370`でserver-safe `loadGeoJSON()`と`getAreaNameFromCoordinates()`を使う。T050/T051でold client fallbackを削除し、T052でdetail/cardのserver areaを保持する。 |

### client GeoJSON、距離helper、replacement consumerの境界

| Candidate | 現行production consumerと証拠 | 判定 | replacementと後続境界 |
|---|---|---|---|
| client GeoJSON loader/cache/fetch | `src/utils/clientGeoUtils.ts:20-34`がmodule cacheとCDN fetchを実行する。production importは`src/lib/location/location-list-state.ts:7-12`だけで、そこから到達するold wrapper群に外部production callerはない。 | **delete**（client fetch/cache）/**move-reuse**（純粋処理の意味） | client fetchとmodule-level cacheはserver-safe境界へ置換済みである。`src/utils/geoUtils.ts:121-154`のlocal file優先/CDN fallback loaderをretainし、T051/T052でclient importを削除候補にする。 |
| client area polygon/grouping helper | `src/utils/clientGeoUtils.ts:36-140`の純粋polygon、area、grouping処理にproduction external consumerは0件である。 | **delete**（未使用client module）/**move-reuse**（必要な純粋処理） | 現行server `src/utils/geoUtils.ts:157-261`が同等のpure area処理を持ち、category/detailのserver consumerへ接続する。T051はpure処理の意味を失わないことを確認してから削除する。 |
| `calculateDistance()`、`sortLocationsByDistance()` | `src/lib/location/location-list-state.ts:94-128`を`src/app/locations/[category-id]/page.tsx:304-316`が距離表示で実行する。同距離の入力順保持もreplacement contractに含まれる。 | **retain / move-reuse** | 新category pageのdistance modeが現行production consumerである。T050/T051ではold stateとpure helperを分離し、必要ならserver helperへ移す。T052は距離順とold orchestrationのnegative searchを分けて確認する。 |
| 新server location loader | `src/lib/location/location-page-data.ts:41-78`の`loadLocationPageData()`は`loadKeyLocationsDataResult()`、wire validation、duplicate ID errorを実行する。`src/app/locations/page.tsx:36-51`、`src/app/locations/layout.tsx:44-75`、category/detail pageがproduction consumerである。 | **retain / move-reuse** | 旧`loadLocationCategories()`を削除してもresult loaderを削除しない。T043/T044のgeocode削除、T050/T052のold state削除から保護する。 |
| 新server GeoJSON/area boundary | `src/utils/geoUtils.ts:121-154,157-261`を`src/lib/location/location-page-data.ts:8`経由のcategory pageと、detail pageの直接importが使用する。 | **retain / move-reuse** | categoryは埋込`location.area`を優先し不足時だけserver GeoJSONへ進み、detailはserver areaを表示する。client CDN loaderの削除対象へ混ぜない。 |
| 新origin/category/GPS controls | `src/components/features/LocationCategoryNavigation.tsx:44-73,105-126`がvalid originだけをcategory linkへ保持し、`src/components/features/LocationSortControls.tsx:59-152`がGPSとdistance modeを実行する。`src/lib/location/location-origin-query.ts:1-75`がparse/serializeを共有する。 | **retain / move-reuse** | old active-category、position reducer、住所検索UIのreplacementである。T050/T051のdelete候補とT043のgeocode削除から除外する。 |
| 新server home route-form data | `src/utils/addressLoader.ts:202-246`の`loadAddressDataResult()`と`loadKeyLocationsDataResult()`のうち、homeは`src/app/page.tsx:121-135`で`HomeRouteForm`へserializable categoriesを渡す。`src/components/features/HomeRouteForm.tsx:33-112`がroute-formを実行する。 | **retain / move-reuse** | old `loadAddressData()`（`src/utils/addressLoader.ts:47-64`）のproduction consumerは0件だが、`AddressCategory`、`AddressLocation`、`convertToLocation()`（`:6-20,248-254`）とresult loaderはroute-formで再利用する。T050/T051でold wrapperだけを再判定する。 |

### test/docs/historyの分離

- `src/lib/location/__tests__/location-list-state.test.ts`は`createInitialLocationListState()`、`reduceLocationListState()`、`geocodeAddress()`、distance helperを参照するtest-only consumerである。production consumer 0件の判定を変更しない。
- `src/app/locations/__tests__/page.test.tsx`にはold `loadLocationCategories` mockが残る。これはtest-only参照であり、T041のRED、T043後のtest更新、T044のfocused検証へ分離する。
- `src/lib/location/__tests__/geocoding-search.test.ts`、`src/components/features/__tests__/DestinationSelector.test.tsx`、`OriginSelector.test.tsx`、`LocationSuggestions.test.tsx`、route-search rate-limit testsはroute-form契約を検証する。`/api/geocode`、home/routes rate-limit、callback injectionのretain判定を変えない。
- `src/app/rate-limit/__tests__/page.test.tsx`、`src/lib/navigation/__tests__/rate-limit-source.test.ts`の`locations`期待値はtest/docs側のconsumerである。T040ではtestを変更せず、production arm削除後にT043/T044の許可されたtest taskで整合を判定する。
- `specs/023-location-data-pages/tasks.md`のT040〜T052記述と本台帳の過去節は履歴資料である。検索文字列がdocs、comments、testだけにある場合はproduction consumer 0とし、route-formの実consumerを別表で明記した。

### T040の判定と後続task境界

- **T043へ渡すdelete候補**: `geocodeAddress`、`GeocodingResult`、場所page専用の住所・場所名検索state/UI、`RateLimitSource`の`"locations"` arm、`getRateLimitReturnPath()`のlocations-specific map/条件arm。
- **T050/T051へ渡すdelete候補**: `LocationListState` reducer、`LocationListAction`/`LocationListOperation`、`createInitialLocationListState()`、`reduceLocationListState()`、old position orchestration、`loadLocationCategories()`、old `loadKeyLocationsData()` wrapper、`groupCategoryLocationsByArea()`、`findLocationAreaName()`、client GeoJSON fetch/cacheと未使用client module。
- **T050/T051でmove/reuse境界を再確認する項目**: `calculateDistance()`、`sortLocationsByDistance()`、GeoJSON polygon/groupingの純粋処理、`AddressCategory`等の共有型、`convertToLocation()`。現行replacement consumerを確認せずにmodule全体を削除しない。
- **明示的にretain/out-of-scope**: `DestinationSelector`、`OriginSelector`、`useGeocodingSearch`、`src/lib/location/geocoding-search.ts`、`src/app/api/geocode/route.ts`、`LocationSuggestions`の注入callback、`CategoryTabs`のroute-form consumer、home/routes rate-limit、`loadAddressDataResult()`、`loadKeyLocationsDataResult()`、server location loader、server GeoJSON、origin/GPS controls。
- **T044の検証境界**: location-page geocode/search/rate-limit symbolsとold client location-data importsだけをproduction-only negative searchする。route-form geocoding、`/api/geocode`、home/routes rate-limit、new server loader/GeoJSON/origin/GPS pathsを意図せず0件扱いしない。
- **T052の検証境界**: old navigation/state/client importのproduction-only negative searchを実施する。`CategoryTabs`は現行`LocationSuggestions` consumerが1件あるため、本体削除条件を満たさない。
- T040では上記の実装、test変更、spec/tasks/plan/research変更、commit、pushを行わない。親側T039のfull Jest/TypeScript/lint/build/browser GREENは前提evidenceとして扱い、T040自身はcensusと台帳検証だけを実施する。

### T040検証結果と終了状態

- `git diff --check`: 成功（exit 0）。
- 台帳のbyte check: `lines=478`、`CRLF=0`、`lone_cr=0`、`trailing_whitespace_lines=[]`、`ends_with_lf=True`を確認した。
- 終了確認日時: 2026-09-07 04:49 UTC。終了時の`git status --short --untracked-files=all`、branch、HEAD、status行数、status出力SHA-256を再確認した。T040の追記後もbranchは`spec/issue-79-location-data-pages`、HEADは`b2d6eeb060507f4640a19f517500917b3fa47178`である。
- 終了時statusは開始時と同じ40行・同じstatus SHA-256で一致し、ledger以外のstatus pathは変化しなかった。ledgerは開始時からuntrackedであり、T040後も`?? specs/023-location-data-pages/deletion-ledger.md`として表示される。
- commit、push、production source/test/spec/tasks/plan/researchの変更は行っていない。

## T044: production-only negative searchとfocused verification

### 実施境界と開始状態

- 確認日: 2026-09-07 (UTC)
- 開始確認日時: 2026-09-07 05:52 UTC
- 対象ブランチ: `spec/issue-79-location-data-pages`
- 開始時HEAD: `b2d6eeb060507f4640a19f517500917b3fa47178`
- T044で書き込むことを許可したパスは本台帳だけである。production source、test、fixture、`tasks.md`、`spec.md`、`plan.md`、`research.md`、commit、pushは変更しない。
- T044開始時の`git status --short --untracked-files=all`は43行、status出力のSHA-256は`580812b136a527a5142b4b5dfcbd9bebf667bf8f5e702add5c37f08fad720b9e`であった。T040以前からの親タスク変更、未追跡replacement source/test、未追跡本台帳を既存状態として保持した。
- 開始時`git diff --check`: 成功（exit 0）。開始時`git diff --name-only`に出ていたpathは親タスク由来であり、T044の検証中に追加・削除していない。

### production-only negative search境界

- 現行`src/**/*.ts(x)`の実行時production codeを対象にした。`src`配下のproduction sourceは178ファイルである。
- `__tests__`、`*.test.*`、`*.spec.*`、fixture、`__mocks__`、`.next`、comments、`specs/**`、`issues/**`、Git historyをproduction consumer判定から除外した。TypeScript scannerで行/block commentを空白化してからASTのidentifier/string literalを調べ、コメント内の履歴記述をruntime matchに数えていない。
- 独立したread-only inline Node AST probe（`node --input-type=module -e ...`、ファイル出力なし）と、下記T041/state negative Jest collectorを同じ境界で照合した。`/locations`という安全なreturn path文字列は、`locations`というrate-limit source armとは別に扱った。

### 削除済みgeocode/search/rate-limitのnegative結果

| 検索対象 | production-only結果 | 判定 |
|---|---|---|
| `geocodeAddress` | 0件 | **delete済み** |
| `GeocodingResult`、`GeocodingSuccess`、`GeocodingFailure` | 各0件。`GeocodingSearchResult`はroute-form共有型であり、別identifierなので削除判定に混ぜていない。 | **delete済み** |
| 場所page専用の住所・場所名検索identifier（`handleAddressSearch`、`searchLoading`、`searchError`、`setAddress`、`setSearchLoading`、`setSearchError`を含む） | `src/app/locations/**`で0件。T041 page collectorのname/address search-control violationも0件。 | **delete済み** |
| 場所page専用の`/api/geocode`文字列 | `src/app/locations/**`で0件。route-form側の2件は下記retain boundaryとして分離した。 | **delete済み** |
| `source=locations` | production runtime literal 0件。 | **delete済み** |
| `RateLimitSource`の`"locations"` arm | 0件。`src/types/access-route-pages.ts:7`は`"home" \| "routes"`だけである。 | **delete済み** |
| `RATE_LIMIT_RETURN_PATHS.locations`、`source === "locations"`、location-specific rate-limit condition/map | 0件。`src/lib/navigation/rate-limit-source.ts:5,18`の`"/locations"`はunknown source向けの安全なfallback pathであり、source armではない。 | **delete済み / fallback retain** |
| 場所pageの旧住所/name search form、入力、検索ボタン | 現行`src/app/locations/**`に0件。現行entryはserver data取得と先頭category redirect、layout/category側はorigin/GPS controlsだけを持つ。 | **delete済み** |

### T050/T051へ残すstate/wrapper/client boundary

T043で削除したgeocode/result/page search/rate-limit branchと、T050/T051が所有するold state/client boundaryを分離した。以下はproduction-only searchで検出した残存であり、T044では削除していない。

| 残存symbol/boundary | exact path:line | 件数 | 判定 |
|---|---|---:|---|
| `LocationListStatus` | `src/lib/location/location-list-state.ts:14,25` | 2 | **retain temporarily / T050-T051 delete candidate** |
| `LocationListOperation` | `src/lib/location/location-list-state.ts:15,34` | 2 | **retain temporarily / T050-T051 delete candidate** |
| `LocationListState` | `src/lib/location/location-list-state.ts:24,40,52,54` | 4 | **retain temporarily / T050-T051 delete candidate** |
| `LocationListAction` | `src/lib/location/location-list-state.ts:33,53` | 2 | **retain temporarily / T050-T051 delete candidate** |
| `createInitialLocationListState` | `src/lib/location/location-list-state.ts:40` | 1 | **T050-T051 delete candidate** |
| `reduceLocationListState` | `src/lib/location/location-list-state.ts:51` | 1 | **T050-T051 delete candidate** |
| `loadLocationCategories` | `src/lib/location/location-list-state.ts:119` | 1 | **T050-T051 delete candidate** |
| `groupCategoryLocationsByArea` | `src/lib/location/location-list-state.ts:123` | 1 | **T050-T051 delete candidate** |
| `findLocationAreaName` | `src/lib/location/location-list-state.ts:132` | 1 | **T050-T051 delete candidate** |
| old wrapperの`loadKeyLocationsData` import/call | `src/lib/location/location-list-state.ts:3,120` | 2 | **T050-T051 wrapper census** |
| `clientGeoUtils` production import | `src/lib/location/location-list-state.ts:12` | 1 | **T050-T051 delete candidate** |
| `clientGeoUtils` client `fetch` | `src/utils/clientGeoUtils.ts:28` | 1 | **T050-T051 delete candidate** |

- state symbol残存は15件、`clientGeoUtils` import/fetchは各1件で、T041 state negative collectorの残存は合計17 violationsである。`LocationListState`等の15件はすべて`src/lib/location/location-list-state.ts`内にあり、client import/fetchの2件も上表のexact pathに一致する。
- T041 state negative testはこの17件を0件と比較するため意図的にREDである。これはT044の削除漏れではなく、仕様で指定されたT050/T051 removal boundaryである。distance helperを保護するため、同moduleをT044で丸ごと削除していない。

### retain / out-of-scope protections

| 保護対象 | 現行production evidenceと判定 |
|---|---|
| `DestinationSelector`、`OriginSelector` | `src/components/features/DestinationSelector.tsx`、`src/components/features/OriginSelector.tsx`が存在し、`HomeRouteForm`から実行時に注入される。**retain / out-of-scope**。 |
| `useGeocodingSearch`、`src/lib/location/geocoding-search.ts` | 目的地・出発地の共有geocode検索境界を保持する。route-form geocode focused 5 suites / 32 testsがGREEN。**retain / out-of-scope**。 |
| `/api/geocode` | `src/app/api/geocode/route.ts`を保持。runtime `/api/geocode`は`src/components/features/OriginSelector.tsx:53`のGPS後reverse geocodeと`src/lib/location/geocoding-search.ts:28`の共有searchの2件で、場所page consumerではない。**retain**。 |
| `LocationSuggestions` injected callback | `src/components/features/LocationSuggestions.tsx:13,26-28`の`onLocationSelected`と`DestinationSelector.tsx:31-40`の注入、`HomeRouteForm.tsx:99-102`のcategories供給を保持。**retain / out-of-scope**。 |
| `CategoryTabs` route-form consumer | `src/components/features/LocationSuggestions.tsx:9,45-52`から`src/components/ui/CategoryTabs.tsx`を使用するproduction consumerが1件残る。場所pageの旧tab usageとは分離して保持。**retain / out-of-scope**。 |
| home/routes rate-limit | `src/components/features/useGeocodingSearch.ts:19`と`src/components/features/OriginSelector.tsx:60`の`source=home`、`src/components/features/RouteSearchResults.tsx:118`の`source=routes`を保持。`RateLimitSource`のhome/routesとgeneric `/rate-limit` pageも保持。**retain**。 |
| server location loader / GeoJSON | `src/lib/location/location-page-data.ts`の`loadLocationPageData()`、`src/utils/geoUtils.ts`のserver-safe `loadGeoJSON()`/groupingをcategory/detailへ接続したまま保持。client GeoJSON fetch/cacheだけがT050/T051候補である。**retain / move-reuse**。 |
| origin/GPS/distance | `location-origin-query`のparse/serialize、`LocationCategoryNavigation`のvalid origin保持、`LocationSortControls`のexplicit GPS、`calculateDistance`/`sortLocationsByDistance`を保持。category/origin/sort/detail replacement aggregateでGREEN。**retain / move-reuse**。 |

### focused verification結果

#### Negative contractsとrate-limit/route-form保護

- `npm test -- --runInBand --runTestsByPath src/app/locations/__tests__/page.test.tsx`: **1 suite / 4 tests GREEN**。server entry 3 testsとT041 location-page obsolete negative contract 1 test、violations 0件。
- `npm test -- --runInBand --runTestsByPath src/lib/location/__tests__/location-list-state.test.ts`: **1 suite / 2 tests、1 passed / 1 expected RED**。distance/sort helper 1 testはGREEN、state/client negative 1 testは上表17 violationsでRED。T050/T051 residualのみで、T041以外のfailureはない。
- `npm test -- --runInBand --runTestsByPath src/lib/navigation/__tests__/rate-limit-source.test.ts`: **1 suite / 12 tests GREEN**。
- `npm test -- --runInBand --runTestsByPath src/app/rate-limit/__tests__/page.test.tsx`: **1 suite / 6 tests GREEN**。`source=locations` caseはallowlist armではなくsafe `/locations` fallbackを検証する結果である。
- `npm test -- --runInBand --runTestsByPath src/lib/location/__tests__/geocoding-search.test.ts src/components/features/__tests__/DestinationSelector.test.tsx src/components/features/__tests__/OriginSelector.test.tsx src/components/features/__tests__/LocationSuggestions.test.tsx src/components/features/__tests__/RouteSearchResults.rate-limit.test.tsx`: **5 suites / 32 tests GREEN**。route-form geocode、injected callback、home/routes rate-limitを保護した。

#### Home/category/nav/sort/origin/detail/data boundary

- `npm test -- --runInBand --testPathPattern='src/app/__tests__/page\.test\.tsx$|src/app/__tests__/page-navigation-contract\.test\.tsx$|src/app/locations/\[category-id\]/__tests__/page\.test\.tsx$|src/components/features/__tests__/LocationCategoryNavigation\.test\.tsx$|src/components/features/__tests__/LocationSortControls\.test\.tsx$|src/lib/location/__tests__/location-origin-query\.test\.ts$|src/app/locations/location-detail/\[id\]/__tests__/page\.test\.tsx$|src/lib/location/__tests__/location-page-data\.test\.ts$|src/utils/__tests__/addressLoader\.test\.ts$|src/utils/__tests__/geoUtils\.test\.ts$|src/components/features/__tests__/LocationCard\.test\.tsx$'`: **11 suites / 112 tests GREEN**。home, category, navigation, sort, origin, detail, loader, GeoJSON, cardを検証した。
- T039 runtime prerequisiteとして既存`http://127.0.0.1:3100` dev serverをread-onlyに使用した。health checkはknown category `200`、unknown category `404`だった。`LOCATION_PAGES_404_BASE_URL=http://127.0.0.1:3100 LOCATION_PAGES_ORIGIN_BASE_URL=http://127.0.0.1:3100 npm test -- --runInBand --runTestsByPath src/app/__tests__/location-pages-404.test.ts src/app/__tests__/location-pages-origin-runtime.test.ts`: **2 suites / 3 tests GREEN**。実HTTPでunknown category/detailのstandard 404と、out-of-area originのdistance HTMLを確認した。

#### TypeScript、ESLint、full Jest、diff

- `npx tsc --noEmit --incremental false`: **GREEN、exit 0**。
- targeted `npx eslint`（T044関連のlocations、home/route-form、location state/data/geocode、rate-limit/type、GeoJSON paths）: **GREEN、exit 0、2 warnings**。`src/app/locations/[category-id]/page.tsx:215`と`src/app/locations/location-detail/[id]/page.tsx:254`の既存`@next/next/no-img-element` warningのみ。
- `npm run lint`: **GREEN、exit 0、error 0**。`next lint` deprecated notice、既存`no-explicit-any`/hook dependency/unused-disable/`no-img-element` warningを確認した。T044関連では上記category/detail/`LocationCard`の`<img>` warningがあり、warningをerrorとは分類していない。
- `npm test -- --runInBand`: **1 failed / 2 skipped / 152 passed suites（155 total）**、**1 failed / 13 skipped / 982 passed tests（996 total）**、exit 1。唯一のfailureは`src/lib/location/__tests__/location-list-state.test.ts`の17 residualを0件とするT041 state negativeであり、T050/T051境界と一致する。T041 page negative、rate-limit、route-form、T039 runtimeを含む他のlocation focused suitesはGREENで、infrastructure/runtime failureは観測していない。full runのconsole outputには既存testログがあるが、`NoFallbackError`は観測していない。
- runtime server logには既知のWebpack/Turbopack configuration warning、Node `module.register()` deprecation、localStorage experimental warningがあった。これらはT044対象failureではない。
- `git diff --check`: T044開始時・各focused verification後ともexit 0。

### T044終了判定とstatus/hash

- production-only negative searchは、T043削除対象（geocode/result、場所page search UI、`source=locations`、locations rate-limit arm）を0件と確認した。T050/T051所有のold reducer/wrapper/client GeoJSON boundaryだけを17 violationsとして分離し、削除していない。
- route-form geocoding/API、`DestinationSelector`/`OriginSelector`、`LocationSuggestions` callback、`CategoryTabs` route-form consumer、home/routes rate-limit、server loader/GeoJSON/origin/GPS/distanceはretain evidenceとfocused/runtime GREENで保護した。
- T044実施中にcommit、push、外部API更新、production source/test/spec/tasks/plan/research変更は行っていない。本台帳への本節追記だけを行った。
- T044終了確認: `git status --short --untracked-files=all`は43行、status SHA-256は`580812b136a527a5142b4b5dfcbd9bebf667bf8f5e702add5c37f08fad720b9e`で開始時と一致した。branchは`spec/issue-79-location-data-pages`、HEADは`b2d6eeb060507f4640a19f517500917b3fa47178`で不変、`git diff --check`はexit 0、ledger format checkは`lines=575`、`CRLF=0`、`lone_cr=0`、`trailing_whitespace_lines=[]`、`ends_with_lf=True`だった（最終ファイルSHA-256は終了確認時のターミナル出力を参照）。

## T050: obsolete navigation/state/client-boundary consumer census

### 実施境界と開始状態

- 確認日時: 2026-09-07 08:12:52 UTC。
- 対象ブランチ: `spec/issue-79-location-data-pages`。
- 開始時HEAD: `b2d6eeb060507f4640a19f517500917b3fa47178`。
- T050はread-only consumer censusと本台帳末尾への追記だけを行った。本タスクで書き込みを許可したパスは`specs/023-location-data-pages/deletion-ledger.md`だけであり、production source、test、fixture、`spec.md`、`tasks.md`、`plan.md`、`research.md`、commit、push、外部API更新は行わない。
- 開始時の`git status --short --untracked-files=all`は43行、status出力のSHA-256は`ef16bbf8c72d836c691044fb179be22ee7906b09c6094878d44864d85d53eb9a`であった。T044までの親タスク変更と、既にuntrackedだった本台帳を既存状態として保持した。
- 開始時のledger byte checkは`bytes=89297`、`lines=575`、`CRLF=0`、`lone_cr=0`、`trailing_whitespace_lines=[]`、`ends_with_lf=True`、SHA-256=`3260d2cd333afebc662740369f7c69bdea5f937564bb08fef9b5a9acb6a4d551`だった。
- 開始時`git diff --check`: 成功（exit 0）。

### production-only scanner/AST境界

- 対象は現行`src/**/*.ts(x)`の実行時production codeだけであり、TypeScript source fileは178ファイルであった。
- `__tests__`、`__mocks__`、`fixtures`、`*.test.*`、`*.spec.*`、`.next`、`specs/**`、`issues/**`、Git historyをproduction consumer判定から除外した。
- TypeScript scannerで行コメント・block commentを空白化し、行位置を保持した文字列を`ts.createSourceFile`でAST化した。ASTのruntime import、call expression、JSX tagを確認し、コメント・test/docsの一致をruntime consumerへ数えていない。これは文字列grepだけの判定ではない。
- T050中はread-only probeだけを実行した。full implementation、full test、lint、buildは実行していない。`git diff --check`とledger byte hygieneは終了時に再確認する。

### navigationとactive-categoryのcensus

| Candidate / boundary | scanner/ASTで確認した現在の事実 | T050判定 |
|---|---|---|
| 旧`/locations` pageの`CategoryTabs` usage | `src/app/locations/page.tsx:36-51`はserver `loadLocationPageData()`後の先頭カテゴリredirect/errorだけで、`CategoryTabs` JSX/importを持たない。現行`src/app/locations/**`のold tab usageは0件である。 | **delete済みの旧usage / T051は再追加しない**。replacementは`LocationCategoryNavigation`の通常`Link`/`nav`/`aria-current`である。 |
| `CategoryTabs`本体 | production AST identifierは`src/components/features/LocationSuggestions.tsx:9,45`（runtime importとJSX）と`src/components/ui/CategoryTabs.tsx:17`（本体定義）の3件。外部runtime consumerは`LocationSuggestions`の1 module / 1 JSX consumerで、`DestinationSelector.tsx:37-40`、`HomeRouteForm.tsx:99-102`を経由する。 | **retain / out-of-scope**。route-form consumerが残るためT051で本体を削除しない。 |
| 旧場所pageの`activeCategory` state | `src/app/locations/**`のcurrent page/layout/category/detailには`activeCategory`がない。旧reducer moduleには4 AST refs（`src/lib/location/location-list-state.ts:28,45,72`、line 72は2 refs）が残っている。 | **delete candidate**（旧state field）。この4件をroute-form stateの証拠で0件扱いにしない。 |
| route-formの`LocationSuggestions` active-category state | `src/components/features/LocationSuggestions.tsx:20,31,47,47,54,59,66,69`の8 AST refsは、popular facilityのカテゴリ展開、選択、tabpanel表示に必要である。`CategoryTabs`側のprop/logicにも`src/components/ui/CategoryTabs.tsx:7,19,26,27,57`の5 refsがある。 | **retain / out-of-scope**。場所pageのobsolete stateと同一視しない。 |
| replacement navigation/GPS boundary | `src/app/locations/layout.tsx:3-6,38-69`が`LocationCategoryNavigation`と`LocationSortControls`を実行時にrenderする。`LocationCategoryNavigation.tsx:44-73,105-132`はURL category/origin navigation、`LocationSortControls.tsx:59-152`はGPSとdistance modeを担う。 | **retain / move-reuse**。old tab/stateのreplacementであり、T051のdelete対象外。 |

### obsolete location-list stateと旧position orchestration

TypeScript ASTのidentifier occurrence countは、コメントを除去したproduction source全体について次の通りである。これは残存候補を明示する表であり、候補全体を0件と主張するものではない。

| Residual symbol / boundary | exact production path:line | AST件数 | 判定 |
|---|---|---:|---|
| `LocationListStatus` | `src/lib/location/location-list-state.ts:14,25` | 2 | **delete candidate** |
| `LocationListOperation` | `src/lib/location/location-list-state.ts:15,34` | 2 | **delete candidate** |
| `LocationListState` | `src/lib/location/location-list-state.ts:24,40,52,54` | 4 | **delete candidate** |
| `LocationListAction` | `src/lib/location/location-list-state.ts:33,53` | 2 | **delete candidate** |
| `createInitialLocationListState` | `src/lib/location/location-list-state.ts:40` | 1 | **delete candidate** |
| `reduceLocationListState` | `src/lib/location/location-list-state.ts:51` | 1 | **delete candidate** |
| old `activeCategory` field/assignment | `src/lib/location/location-list-state.ts:28,45,72`（line 72は2 refs） | 4 | **delete candidate** |
| `loadLocationCategories` | `src/lib/location/location-list-state.ts:119` | 1 | **delete candidate**（external production call 0） |
| `groupCategoryLocationsByArea` | `src/lib/location/location-list-state.ts:123-130` | 1 | **delete candidate**（external production call 0） |
| `findLocationAreaName` | `src/lib/location/location-list-state.ts:132-138` | 1 | **delete candidate**（external production import/call 0） |
| old `loadKeyLocationsData` wrapper import/call | `src/lib/location/location-list-state.ts:3-6,119-120` | 2 | **delete candidate**。state moduleからのみ到達する stale import/call。 |
| legacy `loadKeyLocationsData()` implementation | `src/utils/addressLoader.ts:67-82` | 1 definition | **delete candidate** after the wrapper import/call is removed |
| client GeoJSON module import | `src/lib/location/location-list-state.ts:7-12` | 1 runtime import | **delete candidate**。残存しており、0件とは記録しない。 |
| client GeoJSON fetch/cache | `src/utils/clientGeoUtils.ts:20-34`（fetch `:28`） | 1 client `fetch()` | **delete candidate**。残存しており、0件とは記録しない。 |

- 上表のT041 negative setに対応するobsolete location-list symbolsは15件（`LocationListStatus` 2、`LocationListOperation` 2、`LocationListState` 4、`LocationListAction` 2、create 1、reduce 1、`loadLocationCategories` 1、`groupCategoryLocationsByArea` 1、`findLocationAreaName` 1）で、すべて`src/lib/location/location-list-state.ts`に残っている。old `activeCategory`の4件と、clientGeoUtils import/fetch各1件も別に残っている。
- `src/app/locations/[category-id]/page.tsx:3-6,304-316`のruntime import/callは、同じ`location-list-state.ts:82-117`に定義された`calculateDistance()`と`sortLocationsByDistance()`だけである。old state/reducer/wrapper/clientGeoUtilsのruntime import/call/JSXはない。
- このため`location-list-state.ts`全体を削除する判定はしない。obsolete state/wrapper部分だけをdelete candidateとし、distance helperはretainまたは同等の場所へmove/reuseする。

### client-only location boundaryとserver replacement evidence

| Candidate | 現行consumer/evidence | T050判定とreplacement |
|---|---|---|
| `src/app/locations/page.tsx`の旧client page wrapper/search state | 現行ファイルは51行のserver pageで、`src/app/locations/page.tsx:3,36-51`のserver loader、先頭category redirect、data-errorだけを持つ。`"use client"`、`useState`、旧検索form、旧`CategoryTabs`はない。 | **old wrapper/search stateはdelete済み**。T051でclient pageを復活させない。 |
| `src/app/locations/[category-id]/page.tsx` | 349行のserver category page。`loadLocationPageData`、`parseLocationOrigin`、server `groupLocationsByArea`/`loadGeoJSON`と、確認済みdistance helperだけを使う。 | **retain / move-reuse**。old client orchestrationではなく、URL originとserver data boundaryが正本。 |
| `src/app/locations/location-detail/[id]/page.tsx` | 374行のserver detail page。`src/app/locations/location-detail/[id]/page.tsx:9-13,90-102,330-374`がserver loader、`loadGeoJSON()`、`getAreaNameFromCoordinates()`、server-provided areaを使用する。 | **retain / move-reuse**。old `findLocationAreaName` client fallbackを戻さない。 |
| `src/utils/clientGeoUtils.ts` | 140行。`src/utils/clientGeoUtils.ts:20-34`にmodule cacheとCDN `fetch`、`:36-140`にclient polygon/area/grouping処理が残る。production importは現時点で`location-list-state.ts:7-12`の1件だけである。 | **delete candidate**（client fetch/cache/module）。pure area meaningはserver moduleへmove/reuseし、T051で`src/utils/geoUtils.ts`を削除・改変しない。 |
| server GeoJSON/area replacement | `src/utils/geoUtils.ts`は261行のserver-safe loader/pure helper。`src/lib/location/location-page-data.ts:8`が`groupLocationsByArea`/`loadGeoJSON`をre-exportし、category pageが`:7-11,176-181`で利用する。detail pageは上表のserver imports/callsを直接利用する。 | **retain**。server `geoUtils`、category grouping、detail area fallbackをclient module削除に巻き込まない。 |
| old `loadLocationCategories()` / `loadKeyLocationsData()` path | `loadLocationCategories`はstate module内定義1件、legacy `loadKeyLocationsData`はstate moduleのimport/callと`addressLoader.ts:67`の定義だけ。現行production pagesは`loadLocationPageData()`→`loadKeyLocationsDataResult()`を使用する。 | **delete candidate**。`loadLocationPageData()`、`loadKeyLocationsDataResult()`、wire validationはretainする。 |
| old `groupCategoryLocationsByArea()` / `findLocationAreaName()` | 前者はclient GeoJSON wrapper定義1件、後者はclient area fallback定義1件。現行category/detail/cardのproduction consumerはない。 | **delete candidate**。server `groupLocationsByArea()`、`getAreaNameFromCoordinates()`、`LocationCard`のserver-provided areaはretainする。 |

### retain / move-reuse / out-of-scope protections

| 保護対象 | runtime consumer evidence | 判定 |
|---|---|---|
| `HomeRouteForm`とserver popular data injection | `src/app/page.tsx:3-6,121-135`が`loadAddressDataResult()`のserializable `AddressCategory[]`を`HomeRouteForm`へ渡す。`src/components/features/HomeRouteForm.tsx:99-102,112`がdestination/origin selectorを実行する。 | **retain / out-of-scope**。場所pageのobsolete state削除に混ぜない。 |
| `DestinationSelector` / `OriginSelector` | `DestinationSelector.tsx:10,24,37-40`と`OriginSelector.tsx:10,25,52-66`がroute-formの名前検索、GPS、reverse geocodeを実行する。 | **retain / out-of-scope**。 |
| `useGeocodingSearch` / `geocoding-search` / `/api/geocode` | `useGeocodingSearch.ts:6,16-20`は`searchGeocoding()`と`source=home`を使い、`geocoding-search.ts:24-38`は`/api/geocode`をfetchする。`OriginSelector.tsx:52-53`はGPS後reverse geocodeを行う。 | **retain / out-of-scope**。`geocodeAddress`とは別責務であり、T050/T051で削除しない。 |
| home/routes rate-limit | comment除去後のAST string literalは`OriginSelector.tsx:60`と`useGeocodingSearch.ts:19`の`source=home`、`RouteSearchResults.tsx:118`の`source=routes`だけである。`RateLimitSource`は`src/types/access-route-pages.ts:7`の`"home" \| "routes"`である。 | **retain / out-of-scope**。 |
| `LocationSuggestions` callbackと`convertToLocation()` | `LocationSuggestions.tsx:6-7,26-27`が`AddressLocation`を`convertToLocation()`へ渡し、`DestinationSelector.tsx:31-40`のcallbackと`HomeRouteForm.tsx:99-102`へ接続する。 | **retain / out-of-scope**。 |
| `AddressCategory` / `AddressLocation` / `convertToLocation` | ASTで`AddressCategory`は`app/page.tsx`、`DestinationSelector.tsx`、`HomeRouteForm.tsx`、`LocationSuggestions.tsx`のproduction type consumerを確認した。`AddressLocation`は`LocationSuggestions.tsx`とserver `geoUtils.ts`の型境界にあり、`convertToLocation()`のruntime consumerは`LocationSuggestions.tsx:27`の1件である。 | **retain / move-reuse**。shared types、route-form facility selection、server groupingを削除しない。 |
| `calculateDistance()` / `sortLocationsByDistance()` | `calculateDistance`はcategory pageの`:308`で、`sortLocationsByDistance`は`:316`で実行される。AST importはcategory pageの`:3-6`に限定され、距離順のreplacement contractを検証するtest-only importも存在する。 | **retain / move-reuse**。`location-list-state.ts`のobsolete stateと分離する。 |
| `CategoryTabs` testとroute-form tests | `src/components/ui/__tests__/CategoryTabs.test.tsx`は本体のkeyboard/selection契約を検証し、`src/components/features/__tests__/LocationSuggestions.test.tsx`は注入categories、tab、facility callbackを検証する。 | **retain**。T051削除で変更しない（legacy mock整理は別記）。 |

`src/utils/addressLoader.ts:47-64`のlegacy `loadAddressData()`はproduction runtime consumer 0件だが、T050のdelete manifestには含めない。`loadAddressDataResult()`、shared `AddressCategory`/`AddressLocation`、route-form注入境界を保護するため、旧address loader単体の整理は別のroute-form censusで扱う。これは`loadKeyLocationsData()`のlocation-list wrapper候補と混同しないためのスコープ固定である。

### T051 deletion manifest（削除前の許可パス）

T051がreplacement tests GREEN後に実施できるproduction変更を次に固定する。T050ではいずれも削除・編集していない。

**Allowed production edits/deletes**

1. `src/lib/location/location-list-state.ts:1-80,119-138` — `loadKeyLocationsData` import、`clientGeoUtils` imports、`LocationListStatus`/`LocationListOperation`/`LocationListState`/`LocationListAction`、`createInitialLocationListState()`、`reduceLocationListState()`、old `activeCategory`/position orchestration、`loadLocationCategories()`、`groupCategoryLocationsByArea()`、`findLocationAreaName()`を削除する。`LocationWithDistance`、`calculateDistance()`、`sortLocationsByDistance()`（`:17-22,82-117`）は同じproduction consumerを保つためretainする。`
2. `src/utils/clientGeoUtils.ts` — 上記state importを削除し、production-only negative searchでruntime import 0件を再確認した後にclient cache/CDN fetch/module全体を削除する。pure area behaviorは既存`src/utils/geoUtils.ts`へmove/reuse済みであり、このserver moduleは変更しない。`
3. `src/utils/addressLoader.ts:67-82` — old `loadKeyLocationsData()` implementationを、T051で「old wrapper」の範囲に含めるbounded deleteとして削除する。`loadKeyLocationsDataResult():227-246`、`loadAddressDataResult():203-224`、`AddressCategory`、`AddressLocation`、`KeyLocation`、`convertToLocation():248-254`はretainする。`

**Explicitly not allowed in T051**

- `src/components/ui/CategoryTabs.tsx`の削除・route-form用active stateの変更。現行production consumerが1件あるため、consumer 0条件を満たさない。
- `src/components/features/LocationSuggestions.tsx`、`HomeRouteForm.tsx`、`DestinationSelector.tsx`、`OriginSelector.tsx`、`useGeocodingSearch.ts`、`src/lib/location/geocoding-search.ts`、`src/app/api/geocode/route.ts`、home/routes rate-limit。
- `src/utils/geoUtils.ts`、`src/lib/location/location-page-data.ts`、`src/app/locations/[category-id]/page.tsx`のserver data/origin/distance path、`src/app/locations/location-detail/[id]/page.tsx`、`LocationCategoryNavigation.tsx`、`LocationSortControls.tsx`。
- `src/app/locations/page.tsx`のserver redirect/error boundaryをclient wrapperへ戻す変更、compatibility alias、redirect、hidden fallback、duplicate route。
- production以外のtest/spec/tasks/plan/research、Git history、commit、push。

**Tests requiring update after the production delete**

- `src/lib/location/__tests__/location-list-state.test.ts`: distance/sort testはretainする。negative collectorのobsolete symbol set/support boundaryを、削除後のold state/client import 0件を検証しつつ、`LocationSuggestions`のretainされた`activeCategory`と`CategoryTabs` route-form consumerを誤検出しない形へ更新する。現在の17-residual REDはT051 delete前のexpected residualであり、T051前に書き換えない。
- `src/app/locations/__tests__/page.test.tsx:35-42`: obsolete `loadLocationCategories` mockと、不要になったlegacy state support fixtureだけを削除・整理する。現行server entry/page-data assertionsはretainする。
- `src/utils/__tests__/addressLoader.test.ts`: `loadKeyLocationsDataResult()`のresult-loader契約だけをretainし、legacy `loadKeyLocationsData()`のtest参照を追加しない。現行検索ではold loaderのtest consumerは確認されていない。

以下はT051削除で変更しないtest境界である: `src/components/ui/__tests__/CategoryTabs.test.tsx`、`src/components/features/__tests__/LocationSuggestions.test.tsx`のfacility callback/tab契約、`src/utils/__tests__/geoUtils.test.ts`のserver GeoJSON契約、category/detail/page-data/origin/navigation/sort runtime suites。`LocationSuggestions.test.tsx`と`src/app/__tests__/page.test.tsx`にある`loadAddressData` mockは、今回のT051 manifest外のlegacy address-loader整理と分離する。

### T050終了確認

- T050で残存候補を削除していない。obsolete state symbols 15件、old state `activeCategory` 4件、stale `clientGeoUtils` import 1件、client `fetch` 1件、old loader/wrapper symbolsをT051へ明示的に引き継いだ。残存候補を0件とは記録していない。
- `CategoryTabs`本体はroute-formの`LocationSuggestions` consumer 1件があるためretain/out-of-scope。`HomeRouteForm`、Destination/Origin selector、`useGeocodingSearch`、geocoding API、home/routes rate-limit、shared address types/converterはretain evidenceで保護した。
- `calculateDistance()`/`sortLocationsByDistance()`はcategory pageの実行時consumerを確認できたため、old reducerと同時削除しない。server `geoUtils`、server page-data、origin/GPS/navigation/sort controlsもretainする。
- 終了時刻: 2026-09-07 08:17:33 UTC。
- T050実施中にcommit、push、production source/test/spec/tasks/plan/research変更、外部API更新は行っていない。

## T052: navigation/state deletion後の最終negative searchとfocused/browser verification

### 実施境界と開始状態

- 確認日時: 2026-09-07 09:05:16 UTC。
- 対象ブランチ: `spec/issue-79-location-data-pages`。
- 開始時HEAD: `b2d6eeb060507f4640a19f517500917b3fa47178`。
- T052はread-only検証と本台帳末尾への追記だけを行った。許可された書き込み先は`specs/023-location-data-pages/deletion-ledger.md`だけであり、production source、test、fixture、`spec.md`、`tasks.md`、`plan.md`、`research.md`、その他のdocs、commit、push、外部API更新は行っていない。
- T052開始時の`git status --short --untracked-files=all`は44行、status出力のSHA-256は`06d9a0389f0b073aa4f1bf9d488c9aaa4aebf485a93c61d44d6e602eabcdf1db`であった。T050/T051と親タスク由来の変更pathを既存状態として保持した。
- 開始時`git diff --check`: exit 0。
- T052追記前のledger byte checkは`bytes=108255`、`lines=690`、`CRLF=0`、`lone_cr=0`、`trailing_whitespace_lines=[]`、`ends_with_lf=True`、SHA-256=`c11d665389c3a89c0691240ce0fe1cb6f2dcb4eea76937de76b75211c6da2195`であった。

### production-only negative searchの境界と方法

- 対象は現行`src/**/*.ts(x)`のproduction runtime source 177ファイルである。`__tests__`、`__mocks__`、`fixtures`、`*.test.*`、`*.spec.*`、`.next`、`specs/**`、`issues/**`、Git履歴を除外した。
- `node --input-type=module -e ...`のread-only TypeScript AST probeで、元sourceを`ts.createSourceFile`として解析した。TypeScript ASTにはコメントtriviaがruntime identifier/string literalとして現れないため、コメントをconsumer判定から除外するcomment-stripped相当の証明である。177ファイルのparse diagnosticは0件で、raw grepだけの判定は行っていない。
- 検索対象は、旧location-page `CategoryTabs` import/JSX/active state、`LocationListState`/`LocationListAction`/`LocationListOperation`/`LocationListStatus`、create/reduce、old position orchestration、`loadLocationCategories`、`loadKeyLocationsData`、`groupCategoryLocationsByArea`、`findLocationAreaName`、`GeocodingSuccess`/`GeocodingFailure`/`GeocodingResult`、`clientGeoUtils`のproduction import/fetch/module、旧detail routeのruntime path/literalである。

### 最終negative search結果

| 検索対象 | AST / file boundaryの結果 | 判定 |
|---|---|---|
| `src/app/locations/**`の旧`CategoryTabs` import/JSX | 0件 | **delete済み** |
| `src/app/locations/**`の旧`activeCategory` state | 0件 | **delete済み** |
| `LocationListState`、`LocationListAction`、`LocationListOperation`、`LocationListStatus` | 各0件、combined 0件 | **delete済み** |
| `createInitialLocationListState`、`reduceLocationListState` | 各0件、combined 0件 | **delete済み** |
| old position orchestration（`currentPosition`、`locationsByArea`、`geoJsonLoading`、`sortedByDistance`、`positionReady`、`positionState`、`requestId`、`position-ready`等）の`location-list-state.ts`内残存 | 0件 | **delete済み** |
| `loadLocationCategories`、exact `loadKeyLocationsData` | 各0件、combined 0件。`loadKeyLocationsDataResult`はresult loaderとしてretain | **old wrapper delete済み** |
| `groupCategoryLocationsByArea`、`findLocationAreaName` | 各0件、combined 0件 | **delete済み** |
| `GeocodingSuccess`、`GeocodingFailure`、`GeocodingResult` | 各0件、combined 0件 | **旧location state側はdelete済み** |
| `clientGeoUtils` production import | 0件 | **delete済み** |
| `clientGeoUtils` module file `src/utils/clientGeoUtils.ts` | 0 production file | **delete済み** |
| `clientGeoUtils` client `fetch()` | 0件（module file自体が0件） | **delete済み** |
| 旧detail route `src/app/location-detail/[id]`のproduction `.ts(x)` file/route registration | 0件 | **旧route absent** |
| 旧runtime URL literal `/location-detail/`（canonical `/locations/location-detail/`は除外） | 0件 | **旧href/redirect/aliasなし** |

- `src/lib/location/location-list-state.ts`のproduction exportは`LocationWithDistance`、`calculateDistance()`、`sortLocationsByDistance()`だけである。old reducer/state/wrapperを削除しつつ、距離helperを含むmodule全体は削除していない。
- old detail routeのdirectory entryがfilesystem上に残っていたとしても、production `page.tsx`/`loading.tsx`のfileは0件であり、Next route registrationはない。ledger-only boundaryに従いdirectory cleanupは行っていない。

### retain / move-reuse / out-of-scopeの最終境界

- `CategoryTabs`本体は削除していない。定義は`src/components/ui/CategoryTabs.tsx:17`、production runtime importは`src/components/features/LocationSuggestions.tsx:9`、JSX consumerは`:45`の1件である。`LocationSuggestions`の`activeCategory`はroute-formのpopular facility選択に必要な別責務としてretainした。`CategoryTabs` testとfacility callback契約も保持した。
- 距離helperは`src/app/locations/[category-id]/page.tsx:4-5`からimportされ、`:308`で`calculateDistance()`、`:316`で`sortLocationsByDistance()`を実行する。距離順のproduction consumerを保護した。
- server page-dataは`src/app/locations/page.tsx`、`src/app/locations/layout.tsx`、category page、nested detail pageから`loadLocationPageData()`をimportし、production callは6件（category generateStaticParams/page、layout、detail generateStaticParams/load、entry）である。`loadKeyLocationsDataResult()`、wire validation、duplicate-ID/data-error boundaryはretainした。
- server GeoJSON boundaryはcategory pageの`loadGeoJSON()`/`groupLocationsByArea()`とnested detailの`loadGeoJSON()`/`getAreaNameFromCoordinates()`で使用され、server `src/utils/geoUtils.ts`と`location-page-data.ts`のre-exportを保持した。client CDN fetch/cache/moduleだけをdeleteした。
- route-form geocodingは`DestinationSelector.tsx:24`、`OriginSelector.tsx:25`の`useGeocodingSearch()`と`useGeocodingSearch.ts:16`の`searchGeocoding()`がretainされている。`/api/geocode` runtime literalはOriginSelectorと共有geocoding serviceの2件（`:53`、`:28`）である。
- home/routes rate-limitは`source=home` 2件（OriginSelector、useGeocodingSearch）、`source=routes` 1件（RouteSearchResults）を保持し、`RateLimitSource`は`"home" | "routes"`のままである。`DestinationSelector`、`OriginSelector`、`LocationSuggestions`の`onLocationSelected` callback（production refs 4件）、`HomeRouteForm`、shared address types/converterもretainした。
- `/locations` entry、category navigation、GPS/origin query、sort controls、detail/cardのserver-provided areaとcanonical nested detail hrefは、old tab/state/client area pathと分離してretainした。`CategoryTabs`を削除したとは記録しない。

### focused verification

実行したfocused command（HTTP runtime testはowned serverへ向けた）。

```bash
LOCATION_PAGES_404_BASE_URL=http://127.0.0.1:3310 LOCATION_PAGES_ORIGIN_BASE_URL=http://127.0.0.1:3310 npm test -- --runInBand --runTestsByPath \
  src/app/__tests__/accessibility-source-contract.test.ts \
  src/app/__tests__/accessible-route-pages.test.tsx \
  src/app/__tests__/layout-boundary-contract.test.ts \
  src/app/__tests__/page-layout-contract.test.ts \
  src/app/__tests__/page-navigation-contract.test.tsx \
  src/app/__tests__/location-pages-404.test.ts \
  src/app/__tests__/location-pages-origin-runtime.test.ts \
  src/app/__tests__/page.test.tsx \
  src/app/locations/__tests__/page.test.tsx \
  'src/app/locations/[category-id]/__tests__/page.test.tsx' \
  'src/app/locations/location-detail/[id]/__tests__/page.test.tsx' \
  src/components/features/__tests__/LocationCard.test.tsx \
  src/components/features/__tests__/LocationCategoryNavigation.test.tsx \
  src/components/features/__tests__/LocationSortControls.test.tsx \
  src/components/features/__tests__/LocationSuggestions.test.tsx \
  src/components/features/__tests__/DestinationSelector.test.tsx \
  src/components/features/__tests__/OriginSelector.test.tsx \
  src/components/features/__tests__/RouteSearchResults.rate-limit.test.tsx \
  src/components/layouts/__tests__/SidebarLayout.test.tsx \
  src/components/layouts/__tests__/semantic-layout-contract.test.ts \
  src/components/ui/__tests__/CategoryTabs.test.tsx \
  src/lib/location/__tests__/location-list-state.test.ts \
  src/lib/location/__tests__/location-origin-query.test.ts \
  src/lib/location/__tests__/location-page-data.test.ts \
  src/lib/location/__tests__/geocoding-search.test.ts \
  src/lib/navigation/__tests__/rate-limit-source.test.ts \
  src/app/rate-limit/__tests__/page.test.tsx \
  src/utils/__tests__/addressLoader.test.ts \
  src/utils/__tests__/geoUtils.test.ts
```

- focused Jest: **29 suites / 206 tests GREEN、exit 0**。T041 page/state negative、category/category-nav/sort/origin/detail/home、LocationCard、LocationSuggestions、page-data、addressLoader、geoUtils、accessibility/layout contract、rate-limit、route-form testsを含む。Jestは`runTestsByPath`処理中に`Invalid testPattern ...` informational warningを表示したが、最終結果は指定path内の29 suiteのみを実行し、failureは0件だった。
- `npx tsc --noEmit --incremental false`: **exit 0**。
- targeted `npx eslint`（locations page/layout/category/detail、navigation/sort/card/suggestions/home/route-form、location state/data/origin/geocoding、rate-limit/type、関連test manifest）: **exit 0、error 0、warning 3**。warningは既存の`@next/next/no-img-element`（category page、nested detail、LocationCard）だけである。
- `npm run lint`: **exit 0、error 0**。Next `next lint` deprecation noticeと既存の`no-explicit-any`、hook dependency、unused-disable、`no-img-element` warningのみで、新規errorはない。
- `git diff --check`: **exit 0**。

### full Jestとruntime/browser verification

- T052のfull Jestは、owned server稼働中に次で実行した。

```bash
LOCATION_PAGES_404_BASE_URL=http://127.0.0.1:3310 LOCATION_PAGES_ORIGIN_BASE_URL=http://127.0.0.1:3310 npm test -- --runInBand
```

- full Jest: **153 suites passed、2 suites skipped（155 total）**、**984 tests passed、13 tests skipped（997 total）**、exit 0。runtime HTTP testsも3310 serverを明示して実行したため、server prerequisiteを未起動のままfull GREENとはしていない。
- fresh buildはT052のwrite boundaryとせず、`npm run dev -- --hostname 127.0.0.1 --port 3310`でowned dev serverを起動して検証した。`curl http://127.0.0.1:3310/locations/hospital`のhealth checkはHTTP 200だった。
- system Chromiumは`/usr/bin/chromium`を、`--headless=new --no-sandbox --disable-gpu --remote-debugging-address=127.0.0.1 --remote-debugging-port=9222 --user-data-dir=/tmp/hermes-t052-chromium`でisolated起動した。browser harnessの初回CDP未起動と初回`wait_for_load` timeoutは、owned Chromium起動後に`ensure_real_tab()`で回復し、以下の実ブラウザ確認を完了した。
- category page initial state: `/locations/hospital`でnav 16 links、病院linkの`aria-current="page"`、町字リンク→距離button→h1の順序、detail canonical hrefを確認した。category mainには場所pageのsearch form/inputはなく、見えたinputはglobal menu/dark-mode controlsだけだった。
- real keyboard: Tabでskip link→menu button→global control→最初のcategory linkへ到達し、ArrowRightで2番目category linkへ移動、Enterで`/locations/disability_welfare_center`へ遷移した。
- real GPS/reset/detail: geolocation override `35.6905,139.7578`後に距離buttonを実クリックし、`origin=35.6905%2C139.7578`、距離mode、`aria-pressed=true`、距離順（先頭: 宮内庁病院、九段坂病院、日本大学病院）を確認した。町字リンクを実クリックしてoriginを除去し、town mode/`aria-current="page"`へ戻した。detail linkをviewportへscroll後に実クリックし、`/locations/location-detail/3e328a42-3ff1-4018-be72-746aa6e14e17`へ遷移、originなし、h1・back link・`ここへ行く` destination linkを確認した。
- unmatched route browser check: `/locations/does-not-exist`と`/locations/location-detail/does-not-exist`は、normalized visible textでheading `404`と`This page could not be found.`を各々確認した。HTTP status 404は同じowned serverに対する`location-pages-404.test.ts`で確認済みである。data-errorと404の分離はfocused page/detail/page-data testsで確認した。
- home browser check: server-supplied `よく利用される施設から選択`とCategoryTabsを確認し、browser performance resource entriesに`main_facilities`、`key_locations`、`chiyoda_city.json`、`geojson`の直接fetchは0件だった。route-form callback/geocoding/rate-limit retentionはfocused testsとAST retain boundaryでも確認した。
- browser cleanup: owned dev server（port 3310）とisolated Chromium（port 9222）を停止した。終了時のport checkは`port_3310_open=false`、`port_9222_open=false`であり、外部serverは停止していない。

### T052終了確認

- T052追記中にcommit、push、production source/test/spec/tasks/plan/research変更、外部API更新は行っていない。変更対象は本台帳の追記だけである。
- 終了時branch/HEADは`spec/issue-79-location-data-pages` / `b2d6eeb060507f4640a19f517500917b3fa47178`のままである。
- 終了時statusは44行、status出力のSHA-256は`06d9a0389f0b073aa4f1bf9d488c9aaa4aebf485a93c61d44d6e602eabcdf1db`で、開始時と一致した。ledger追記以外のparent dirty pathに増減はない。
- 終了時ledger byte checkは`bytes=122379`、`lines=808`、`CRLF=0`、`lone_cr=0`、`trailing_whitespace_lines=[]`、`ends_with_lf=True`であった。SHA-256は自己参照になるため本節では記載しない。
- 終了確認日時: 2026-09-07 09:08:22 UTC。`git diff --check`: exit 0。

## T053: 最終production-only reference census

### 実施境界と開始状態

- 確認日時: 2026-09-07 09:26:18 UTC。
- 対象ブランチ: `spec/issue-79-location-data-pages`。
- 開始時HEAD: `b2d6eeb060507f4640a19f517500917b3fa47178`。
- T053はread-only censusと本台帳末尾への追記だけを行った。書き込み可能なパスは`specs/023-location-data-pages/deletion-ledger.md`だけであり、production source、test、fixture、`spec.md`、`tasks.md`、`plan.md`、`research.md`、その他docs、commit、push、外部API更新は行っていない。
- 開始時の`git status --short --untracked-files=all`は44行、status出力のSHA-256は`06d9a0389f0b073aa4f1bf9d488c9aaa4aebf485a93c61d44d6e602eabcdf1db`であった。T052までの親タスク変更と、既にuntrackedだった本台帳を既存状態として保持した。
- 開始時`git diff --check`: exit 0。

### production-only AST境界と方法

- 対象は現行`src/**/*.ts(x)`の実行時production sourceである。`__tests__`、`__mocks__`、`fixtures`、`*.test.*`、`*.spec.*`、`.next`、`specs/**`、`issues/**`、Git history、commentsを除外した。
- 対象ファイルは177件。各ファイルをTypeScript 5の`ts.createSourceFile`で`.ts`/`.tsx`として解析し、parse diagnosticsは0件だった。identifier、import declaration、call expression、string/template literalをASTから収集し、raw grepだけでは判定していない。
- 行コメント・block commentはASTのruntime identifier/string literalにならないためconsumer判定に含めていない。test/docs/historyの一致はproduction consumerから分離した。
- 追加のread-only import-use probeでは、location/data/navigation/route-formのproduction path（`src/app/locations/**`、`src/lib/location/**`、`src/utils/addressLoader.ts`、`src/utils/geoUtils.ts`、`src/lib/navigation/rate-limit-source.ts`、関連feature/UI/type paths）のimport bindingをASTで確認した。未使用production import候補は0件だった。

### 最終census結果

| 対象 | exact production path:line / AST・file count | 判定 | 証拠・境界 |
|---|---|---|---|
| 旧detail route page/loading、旧route登録 | `src/app/location-detail/[id]/page.tsx`、`loading.tsx`: 各file 0件（filesystem上も不存在） | **delete済み** | 旧route実体、Next route registrationはない。 |
| 旧`/location-detail/[id]` URL、旧href、旧route import | production AST string/template literal 0件、old-route module specifier 0件、old prefix（canonical `/locations/location-detail/`を除外）0件 | **delete済み** | 旧route path/literal/importの残存はない。 |
| compatibility redirect / alias / hidden fallback | 旧URLと`redirect`/`permanentRedirect`/`rewrite`/`NextResponse.redirect`の組合せ 0件。runtime `redirect`は`src/app/locations/page.tsx:50`の`/locations/${encodeURIComponent(categoryId)}` 1件のみ | **delete済み / retain** | entryから先頭categoryへ進むredirectはcompatibility redirectではない。 |
| canonical detail href（現行category page） | `src/app/locations/[category-id]/page.tsx:211`: template 1件 | **retain** | `encodeURIComponent(location.id)`を使うnested canonical link。 |
| `LocationCard`内のcanonical href | `src/components/features/LocationCard.tsx:13`: template 1件。ただしproduction import/call 0件 | **unresolved delete candidate** | canonical形式は正しいが、現行production graphではtest/accessibility contractだけから参照される。 |
| client `clientGeoUtils` module/import/fetch | `src/utils/clientGeoUtils.ts`: file 0件、production import 0件、client fetch 0件 | **delete済み** | server `src/utils/geoUtils.ts`へ置換済み。 |
| obsolete `LocationListState` / `LocationListAction` / `LocationListOperation` / `LocationListStatus` | 各AST 0件（combined 0件） | **delete済み** | 旧reducer/stateの定義・参照は残っていない。 |
| old position orchestration（`currentPosition`、`locationsByArea`、`geoJsonLoading`、`sortedByDistance`、`positionReady`、`positionState`、`position-ready`） | `src/lib/location/location-list-state.ts`および`src/app/locations/**`: 各0件 | **delete済み** | `requestId`は対象moduleに0件。別featureの`src/lib/transit/route-search-state.ts:15,21-61`の22件はroute-search stateとして保護した。 |
| old state/wrapper exports `createInitialLocationListState` / `reduceLocationListState` / `loadLocationCategories` / `groupCategoryLocationsByArea` / `findLocationAreaName` | 各AST 0件、combined 0件 | **delete済み** | 新server data/origin/GPS/area boundary以外の旧wrapperは残っていない。 |
| old `loadKeyLocationsData` wrapper | exact identifier AST 0件 | **delete済み** | `loadKeyLocationsDataResult`とは別identifierであり、下記server result loaderはretainした。 |
| old location-page geocode/search | `geocodeAddress`、`GeocodingResult`、`GeocodingSuccess`、`GeocodingFailure`: 各AST 0件。`src/app/locations/**`の住所/name search controlも0件 | **delete済み** | location pageはserver data、origin query、GPS操作だけを使用する。 |
| location-page rate-limit branch | `source=locations` runtime literal 0件、`RateLimitSource`のlocations arm 0件、locations-specific map/condition 0件 | **delete済み** | `src/lib/navigation/rate-limit-source.ts:14-18`のunknown source向けsafe `/locations` fallbackはsource armではなくretainした。 |
| legacy `loadAddressData()` CDN loader/export | `src/utils/addressLoader.ts:47`: definition 1件、内部`fetch` `:50` 1件、production external import/call 0件。test-only mock refsは`src/app/__tests__/page.test.tsx:57`、`src/components/features/__tests__/LocationSuggestions.test.tsx:21` | **unresolved delete candidate** | T050でT051 manifest外にした実体が残るため、unresolvedを0件とは記録しない。`loadAddressDataResult()`（home server loader）は削除しない。 |
| `AddressDataResult` export visibility | `src/utils/addressLoader.ts:45,185`: AST 2件、production external import 0件 | **retain / move-reuse（要follow-up判定）** | `loadAddressDataResult():185`の内部戻り値型として使用中。legacy functionと同時に機械的削除せず、follow-upでexportを非公開化できるか確認する。 |
| `LocationCard` / `LocationCardProps` production module | `src/components/features/LocationCard.tsx:4,10`: export declaration、production external import/call 0件。test-only consumerは`src/components/features/__tests__/LocationCard.test.tsx:3,25,38,50` | **unresolved delete candidate** | 現行category pageは共有cardではなく`LocationSummary`を使用する。test-only contractを根拠にproduction consumer 1件とは数えない。 |
| `LocationDetailLoading` production module | `src/components/features/LocationDetailLoading.tsx:4`: export declaration 1件、production external import/call 0件。test-only consumerは`src/app/__tests__/accessible-route-pages.test.tsx:10,225` | **unresolved delete candidate** | 現行nested routeに`loading.tsx`のruntime importはなく、通常componentのtest-only使用だけである。実loading boundaryを戻すかcomponent/testを整理する別follow-upが必要。 |
| `buildLocationHref` / `LocationLinkKind` | `src/lib/location/location-origin-query.ts:65`のexport definition 1件、`:11,68`のtype refs 2件、production external import/call 0件。test-only consumerは`src/lib/location/__tests__/location-origin-query.test.ts:13,74,76-77` | **unresolved delete candidate** | productionは`parseLocationOrigin`/`serializeLocationOrigin`とcomponent内href builderを使用する。helperをwireするかtest-only helperを削除する別follow-upが必要。 |
| unused production imports after deletion | 対象production pathのAST import binding use count: 0件 | **retain / no action** | old route/state/client/geocode symbolのdangling importはない。 |

### replacement contractとroute-form保護の確認

| 保護対象 | exact production path:line / count | 判定 |
|---|---|---|
| route-form `CategoryTabs` consumer | `src/components/features/LocationSuggestions.tsx:9` import、`:45` JSX: 2 AST refs（runtime JSX consumer 1件）。`LocationSuggestions`は`DestinationSelector.tsx:6,37`から、`HomeRouteForm.tsx:99-102`経由で実行時に到達する | **retain / out-of-scope** |
| route-form `activeCategory` state | `src/components/features/LocationSuggestions.tsx:20,31,47,54,59,66,69`: 8 AST refs。`src/components/ui/CategoryTabs.tsx:7,19,26,27,57`: 5 refs | **retain / out-of-scope**。場所pageのold stateではない |
| route-form geocoding | `useGeocodingSearch`: definition `src/components/features/useGeocodingSearch.ts:8`、Destination consumer `:10,24`、Origin consumer `src/components/features/OriginSelector.tsx:10,25`。`searchGeocoding`: definition `src/lib/location/geocoding-search.ts:24`、hook `:6,16` | **retain / out-of-scope** |
| geocoding API | runtime `/api/geocode` template 2件: `src/components/features/OriginSelector.tsx:53`（GPS reverse geocode）、`src/lib/location/geocoding-search.ts:28`（route-form search） | **retain / out-of-scope** |
| home/routes rate-limit | `source=home`: `src/components/features/OriginSelector.tsx:60`、`useGeocodingSearch.ts:19`の2件。`source=routes`: `src/components/features/RouteSearchResults.tsx:118`の1件 | **retain / out-of-scope** |
| shared address types/converter | `AddressCategory`: production AST 16件、外部consumerは`src/app/page.tsx:5,53,92`、`DestinationSelector.tsx:5,15`、`HomeRouteForm.tsx:15,20,26`、`LocationSuggestions.tsx:6,12`。`AddressLocation`: AST 11件、`LocationSuggestions.tsx:6,26`と`geoUtils.ts:3,234,236,237`が外部/境界consumer。`convertToLocation`: `src/utils/addressLoader.ts:230` definition、`LocationSuggestions.tsx:7,27` import/call | **retain / move-reuse** |
| retained distance helpers | `calculateDistance`: definition `src/lib/location/location-list-state.ts:8`、category import/call `src/app/locations/[category-id]/page.tsx:4,308`。`sortLocationsByDistance`: definition `:25`、category import/call `src/app/locations/[category-id]/page.tsx:5,316` | **retain / move-reuse**。distance consumerを削除していない |
| retained server location loader | `loadLocationPageData`: definition `src/lib/location/location-page-data.ts:48`、production runtime calls 6件（category `:50,284`、layout `:45`、detail `:34,63`、entry `src/app/locations/page.tsx:40`）。`loadKeyLocationsDataResult`: `src/utils/addressLoader.ts:209` definition、`location-page-data.ts:3,50` import/call。`loadAddressDataResult`: `src/utils/addressLoader.ts:185` definition、`src/app/page.tsx:4,125` import/call | **retain / move-reuse** |
| retained server GeoJSON/area | `loadGeoJSON`: `src/utils/geoUtils.ts:133` definition、CDN fallback fetch `:122` 1件、category `src/app/locations/[category-id]/page.tsx:9,176`、detail `src/app/locations/location-detail/[id]/page.tsx:12,97`、page-data re-export `:8`。`groupLocationsByArea`: `geoUtils.ts:233,240`、page-data re-export `:8`、category `:8,177`。`getAreaNameFromCoordinates`: `geoUtils.ts:196,240`、detail `:11,98` | **retain / move-reuse**。server loaderのCDN fallbackはclient fetchではない |
| retained server `LocationList` replacement | `src/app/locations/[category-id]/page.tsx:231,324,346`: AST 3件 | **retain / move-reuse**。これは旧`LocationListState`ではなくserver-rendered list componentである |
| retained origin/GPS/category/detail/home boundaries | category navigation `src/components/features/LocationCategoryNavigation.tsx:58,116`、GPS `src/components/features/LocationSortControls.tsx:59,91,109`、origin parse/serialize `src/lib/location/location-origin-query.ts:20,56`とproduction consumers、detail back/destination `src/app/locations/location-detail/[id]/page.tsx:126,134,151`、home server injection `src/app/page.tsx:125,135` | **retain / move-reuse** |

### unresolved candidatesと狭いfollow-up recommendation

- T053のproduction-only削除候補は0件ではない。正確には、次の4つのruntime source candidateがproduction external consumer 0件で残っている。
  1. `src/utils/addressLoader.ts:47-64` — legacy `loadAddressData()` exportとclient-style `main_facilities.json` fetch。
  2. `src/components/features/LocationCard.tsx:4-42` — current production graphから未到達のcard/props export。
  3. `src/components/features/LocationDetailLoading.tsx:4-18` — test-only loading component。
  4. `src/lib/location/location-origin-query.ts:11,65-78` — test-only `buildLocationHref` / `LocationLinkKind` helper。
- 推奨する狭いfollow-upは、上記4 candidateだけを対象に、(a)実runtime consumerを追加するのか、(b)対応test contractと同時に削除するのかを決定し、`loadAddressDataResult`、route-form geocoding、server GeoJSON、origin/GPS、distance、`CategoryTabs`を変更しないことである。今回のT053 write boundaryではsource/testを変更できないため、台帳上で保留とした。
- `AddressDataResult`（`:45,185`）と`LocationWithDistance`（`src/lib/location/location-list-state.ts:1,25`）はproduction external import 0件だが、各々active loader/distance helperの内部型として使用中であり、上記4つのdead implementationには合算していない。export visibilityだけを後続整理する場合も、active function contractを先に確認する。
- test-only残存（legacy `loadAddressData` mock、`LocationCard`/`LocationDetailLoading`/`buildLocationHref` tests）はproduction consumerではないため、今回のread-only判定を変えない。testsは変更していない。

### T053終了確認

- T053追記中にcommit、push、production source/test/spec/tasks/plan/research変更、外部API更新は行っていない。変更対象は本台帳の追記だけである。
- 終了時のbranch/HEAD、status path、ledger hygiene、`git diff --check`は追記後に再確認する。

## T053C: 未使用production candidateとsuperseded test参照の削除

### 実施境界

- T053Aの編集前REDは1 suite / 4 tests failed（4候補を各1件で検出）。置換・経路検索フォーム保護の編集前確認は8 suites / 52 tests passed。
- T053Bのfresh read-only reviewは`SUBAGENT_STATUS: COMPLETE`、`VERDICT: PASS`済みであり、その後にT053Cの最小削除だけを実施した。
- production側は次の4候補だけを削除した。
  1. `src/utils/addressLoader.ts`のlegacy `loadAddressData()`本体（47–64行相当）を削除した。`AddressDataResult`、`AddressCategory`、`AddressLocation`、`KeyLocation`、`convertToLocation`、`loadAddressDataResult`、`loadKeyLocationsDataResult`、version付きvalidation/loadersは保持した。削除後も`logger`と`appConfig`はresult loadersで使用されているため、不要importの追加削除はない。
  2. `src/components/features/LocationCard.tsx`全体を削除し、`src/components/features/__tests__/LocationCard.test.tsx`も削除した。現行category pageのserver `LocationSummary`にproduction consumerがなく、canonical detail hrefはcategory page側で保持される。
  3. `src/components/features/LocationDetailLoading.tsx`全体を削除し、`src/app/__tests__/accessible-route-pages.test.tsx`のimportとloading-contract test blockだけを削除した。detail特別`loading.tsx`はHTTP 404 streaming correctnessのため既に削除済みの状態を維持し、再導入していない。専用loading UIの再利用可能componentは残さないが、未知detailのSSR/HTTP 404 statusを軟化させない境界を優先した。
  4. `src/lib/location/location-origin-query.ts`からtest-only `LocationLinkKind`、`buildLocationHref()`、URL baseを削除した。`LocationCoordinates`、`LocationOrigin`、`parseLocationOrigin()`、`serializeLocationOrigin()`の実装と挙動は保持した。
- superseded test cleanupは指定箇所だけに限定した。
  - `src/app/__tests__/accessibility-source-contract.test.ts`: `dedicatedConsumerFiles`からLocationCardとmarker entryを削除し、他のmarker/contractは保持。
  - `src/app/__tests__/accessible-route-pages.test.tsx`: LocationDetailLoading importとloading test blockだけを削除し、他のroute/page semantic/error testsは保持。
  - `src/lib/location/__tests__/location-origin-query.test.ts`: local `LocationLinkKind`、`buildHref` adapter、category/detail/other/reset propagation testsだけを削除し、parse/serialize/invalid/absent testsは保持。`BASE_URL`は保持したparse testで使用されるため削除していない。
  - `src/app/__tests__/page.test.tsx`: mock factoryのstale `loadAddressData: jest.fn()`だけを削除。
  - `src/components/features/__tests__/LocationSuggestions.test.tsx`: stale `mockLoadAddressData`、mock factory property、reset/resolved setup、legacy not-called assertionsだけを削除。注入categories、CategoryTabs、converter、callback、browser-fetch no-callは保持。
- `CategoryTabs`、`HomeRouteForm`、Destination/Origin selectors、`useGeocodingSearch`、`geocoding-search`、`/api/geocode`、home/routes rate-limit、server loaders/GeoJSON、distance helpers、origin parser/serializer、`LocationCategoryNavigation`、`LocationSortControls`、public category/detail pagesは変更していない。commit、pushは行っていない。

### T053C検証結果

- T053A exact GREEN: **1 suite / 4 tests passed、exit 0**。
- T053C後focused aggregate（location pages、origin/GPS、home/route-form、rate-limit、retained loader/helper/contracts）: **27 suites / 195 tests passed、exit 0**。複数`--runTestsByPath`指定時のJest informational `Invalid testPattern`が出たが、指定27 suiteの結果は全GREEN。T053A単独コマンドはこの警告なしで再確認した。
- strict TypeScript `npx tsc --noEmit --incremental false`: **exit 0**。
- T053C対象scoped ESLint: **exit 0、error 0、warning 0**。full `npm run lint`: **exit 0**。full lint/buildには既存の`no-explicit-any`、hook、`no-img-element` warningと`next lint` deprecation noticeがあるが、新規errorはない。
- `git diff --check`: **exit 0**。
- production-only TypeScript AST negative audit: production **175 files**を解析し、`loadAddressData`、`LocationCard`、`LocationDetailLoading`、`LocationLinkKind`、`buildLocationHref`のexact identifier hitは各**0件**。削除した2 module fileのpresenceも**false**。保持境界は`loadAddressDataResult` 3、`loadKeyLocationsDataResult` 3、`loadLocationPageData` 12、`parseLocationOrigin` 7、`serializeLocationOrigin` 5、`LocationCategoryNavigation` 3、`LocationSortControls` 3、`CategoryTabs` 3、`useGeocodingSearch` 5、`searchGeocoding` 3、`calculateDistance` 11、`sortLocationsByDistance` 3、`loadGeoJSON` 6 refsだった。
- full Jest（owned dev server `127.0.0.1:3310`、runtime env指定）: **152 suites passed / 1 failed / 2 skipped（155 total）、976 tests passed / 1 failed / 13 skipped（990 executed）**、exit 1。失敗は指定boundary外の`src/app/__tests__/card-title-style-contract.test.ts`のみで、LocationCard削除によりproduction `card-title`検出が旧期待22件から21件になったもの。同test単独再実行とfull Jest再実行で同じ1件を再現した。テスト弱体化や未許可pathの変更は行っていない。
- direct `node node_modules/next/dist/bin/next build`: **exit 0**。既存lint warningのみ。
- 同一build smoke: `/locations/hospital` 200、valid origin付きcategory 200（距離mode marker）、既知nested detail 200、未知category 404、未知detail 404の**5/5**が期待statusと主要HTML markerに一致した。
- runtime server cleanup: owned 3310 serverとその残存`next-server` childを停止し、最終`port_3310_open=false`を確認した。既存の3000番portなど他プロセスは停止していない。

## T059: 親側最終照合

### 最終受入契約

- 確認日時: 2026-09-07 11:18:36 UTC。
- 対象ブランチ: `spec/issue-79-location-data-pages`。
- 検証時HEAD: `b2d6eeb060507f4640a19f517500917b3fa47178`。この節はcommit/push前の親側照合記録であり、実装commitとremote検証は後続のDelivery verificationへ記録する。
- Q21確定前の照合記録として、憲章、`AGENTS.md`、`spec.md`、`plan.md`、`research.md`、`data-model.md`、`contracts/location-pages.md`、`quickstart.md`、`tasks.md`を親側で照合した。当時はSSR中心の動的`origin`、標準404とdata-errorの分離、route-form保護、ブラウザCDN fetch禁止、アクセシビリティ方針に矛盾はないと記録したが、これは実行時サーバーの外部データ取得を許していた旧方針の記録であり、Q21のビルド生成物限定契約を満たす証拠ではない。
- `checklists/requirements.md`は全項目checkedであり、`.specify/extensions.yml`は存在しなかった。`check-prerequisites.sh --json --require-tasks --include-tasks`は`FEATURE_DIR=/opt/data/kazaguruma-transit/specs/023-location-data-pages`と必要文書を返した。

### 最終production-only negative census

- 親側でTypeScript ASTを使い、`src`のproduction `.ts/.tsx` **175ファイル**を走査した。`__tests__`、`__mocks__`、fixtures、docs、test/spec suffix、comments、`.next`を除外し、parse diagnosticsは**0**だった。
- T053A/Cの削除候補とT043/T051/T052のobsolete候補を再確認した。`loadAddressData`、`LocationCard`、`LocationDetailLoading`、`LocationLinkKind`、`buildLocationHref`、`clientGeoUtils`、`LocationListState`/Action/Operation/Status、create/reduce、`loadLocationCategories`、`groupCategoryLocationsByArea`、`findLocationAreaName`、`geocodeAddress`、`GeocodingResult`系、`source=locations`のproduction runtime hitはすべて**0件**。旧`src/app/location-detail/[id]`のpage/loading/test fileも不在である。
- retain境界は保持されている。`loadAddressDataResult`、`loadKeyLocationsDataResult`、`loadLocationPageData`、server `loadGeoJSON`/area grouping、`parseLocationOrigin`/`serializeLocationOrigin`、`calculateDistance`/`sortLocationsByDistance`、`LocationCategoryNavigation`、`LocationSortControls`、route-formの`DestinationSelector`/`OriginSelector`/`useGeocodingSearch`/`/api/geocode`、home/routes rate-limit、`CategoryTabs`→`LocationSuggestions` consumerを誤削除していない。
- T053で一時記録された4 unresolved candidateは、T053Cの削除とT053Dの正当な`card-title`件数補正により解消済みである。最終状態に未解決のproduction delete candidateは**0件**。

### 最終検証結果

- T053D後のfull Jest: **153 suites passed / 2 skipped（155 total）**、**977 tests passed / 13 skipped（990 executed）**、exit 0。T041/T053A negative、T039/T045 runtime、T053D card-title contractを含む。
- T057のquickstart browser acceptance: system Chromium `/usr/bin/chromium` 151.0.7922.173、desktop 1280x900／narrow 390x844、`/locations` redirect、native keyboard、GPS success/denied、origin保持/削除、detail、invalid origin、404、home popular data、禁止endpoint 0件をPASS。data-errorの本番強制は行わず、focused 24 testsでPASSと分離した。
- T058の`NEXT_TELEMETRY_DISABLED=1 npm run build`: exit 0。Prisma generate、`db push`（already in sync）、GTFS import script、Next static pages 211/211を実行した。`.next`、Prisma client、ignored SQLiteは生成・更新されたが、source/test/spec/tasks/ledgerのファイル集合は不変だった。
- T054 strict TypeScript: exit 0。T055 `npm run lint`: exit 0、error 0。既存warningは`no-explicit-any`、`no-img-element`、React hook、unused-disable、Node/Next deprecation等であり、新規errorではない。`transit-config.json`不在によりGTFS実インポート成功とは扱わない。
- `git diff --check`: 最終exit 0。
- build/runtime中に使用した3100、3140、3150、3220、3230、3240、3260、3270、3310、9222の検証用ポートは最終確認で全てclosed。親側のNext/Chromiumプロセス残存はない。

### 最終変更パス照合

- `git status --short --untracked-files=all`の45行は、Spec023のproduction/test/deletion-ledger/tasks変更と、旧route削除・新nested route・server data/origin/GPS/navigation、T053A test、T053D contract correctionの宣言済み境界に一致する。未宣言の一時スクリプト、build harness、runtime結果ファイルは残っていない。
- Q21追加前の照合では、既存tasksの完了状態と変更パスを確認した。Q21追加後はT060〜T068が未完了であり、旧tasksの完了記録だけではビルド時生成物・ビルド失敗・実行時外部取得0件を証明しない。

## Delivery verification

- 確認日時: 2026-09-07 11:25:00 UTC。
- 実装commit: `3b795d81ae111b6c4fb07a24cdb56b884226ec25`。
- `git push -u origin HEAD`はGitHub `github.com:nawashiro/kazaguruma-transit.git`とTangled `git@tangled.org:did:plc:owrqgxh62utntouxk2disqix`の両push先で受理された。
- `git ls-remote`による両remoteの`refs/heads/spec/issue-79-location-data-pages`は、実装commitと同じ`3b795d81ae111b6c4fb07a24cdb56b884226ec25`を返した。
- `gh auth status`は`nawashiro`で成功した。`gh run list --branch spec/issue-79-location-data-pages`は空配列で、当該branch/commitにGitHub Actions runは存在しなかった。したがってCI成功とは主張しない。local full Jest、build、browser acceptanceの結果を上記検証証拠として扱う。
- Delivery verification節のdocs-only追記commit `72d447124436da2d246f78c3a83b1b2307278b49`はGitHub/Tangledへpush済みであり、push後の両remote SHAも同一である。

## Q21 clarification update

- 確認日時: 2026-09-07 UTC。
- ユーザー決定: ホームのよく利用される施設、`key_locations.json`、町字GeoJSONをビルド時に取得・検証し、いずれかが取得・検証できなければ公開用ビルドを失敗させる。ビルド成功後は、場所ページがビルド生成物だけを利用し、CDN・データ提供元へ実行時に再取得しない。`origin`による距離計算・表示切替は生成物を入力として実行時に行ってよい。
- 影響範囲: `spec.md`のQ2/Q21、FR-001/FR-002/FR-016/FR-040、SC-001/SC-004/SC-021、`research.md`、`plan.md`、`data-model.md`、`contracts/location-pages.md`、`quickstart.md`、`tasks.md`を更新した。
- `T060`〜`T068`を、ビルド時取得・検証、生成物作成、実行時artifact-only読込、外部ネットワーク0件、ビルド失敗注入、最終検証の未完了タスクとして追加した。これらが完了するまで、旧T058等のビルド成功記録や旧server data boundaryの検証記録をQ21の受入証拠として扱わない。

## T052H: US5 visual GREEN・6幅ブラウザ受入と削除境界evidence

### 実施境界・開始状態

- 実施日時: **2026-09-08 13:28:30 UTC**。
- branch / HEAD: `spec/issue-79-location-data-pages` / `72e1734278b400db2863639a4db89092bcd1761a`。
- 指定視覚参照は生のSHA `7cbf0a5a57c66b0e8e114e28cc3871ab1f46fd15`を直接参照した。`origin/dev@<sha>`は有効なGit refとして解決できなかった。
- T052Hの書き込み可能範囲は`specs/023-location-data-pages/quickstart.md`と本`deletion-ledger.md`だけ。production source/test/fixture、spec/tasks/plan/research、commit、push、外部API更新は行っていない。
- 検証開始時`git status --short --untracked-files=all`は24行、SHA-256は`fe70318bd1a2cd3de20c8b43dd83f5b174b292d9062b1336f559d4d97af35254`。既存のparent dirty pathsを変更せず、T052Hでは2つの証跡docsだけを追記する境界とした。

### 必須検証結果

- visual-contract 4 suites: `npm test -- --runInBand --runTestsByPath`で**4 suites / 35 tests passed、exit 0**。
- 関連location/category/detail/navigation/sort/origin/404 8 suites: 404 runtime envを`127.0.0.1:3331`へ明示し、未知category/detailを先warm-upしてから実行。**8 suites / 77 tests passed、exit 0**。
- `npx tsc --noEmit --incremental false`: **exit 0**。
- `npm run lint`: **exit 0、error 0**。既存warningと`next lint` deprecationのみ。
- `git diff --check`: **exit 0**。
- 複数角括弧route path指定時のJest `Invalid testPattern` informational warningは記録した。最終summaryはvisual 4 suite、related 8 suiteの指定結果で、warningをGREENの代替にはしていない。

### visual/browser acceptance evidence

- owned dev server: `npm run dev -- --hostname 127.0.0.1 --port 3331`。category/detail代表ページはHTTP 200、unknown category/detailはbrowser HTTP 404。
- ChromeはPuppeteer cacheの138.0.7204.168を使用。カテゴリ6幅の`clientWidth/scrollWidth/bodyScrollWidth`は`320:305/305/305`、`375:360/360/360`、`390:375/375/375`、`768:753/753/753`、`1024:1009/1009/1009`、`1440:1425/1425/1425`で、zero overflow。navは全幅16 links、`display:flex`、`flex-wrap:wrap`、320pxでも`(x=40,y=275,w=225,h=404)`、1440pxでも`(x=464.5,y=251,w=816,h=96)`、ラベル省略・切断なし。
- カテゴリページの削除境界: `[role="tablist"]`、場所pageの`[role="tab"]`、auxiliary carouselは0件。旧`CategoryTabs`/active-category stateを場所ページへ戻さず、semantic category nav、normal Link、`aria-current`を保持した。
- 必須visual領域: `h1=場所をさがす`、説明文、`カテゴリを選択`、`近いところから表示`、地域単位の一覧、`データ提供元`を確認。1440px provider cardは`864x235`。カテゴリ/sort操作は16px・min-height 44px。
- 有効origin `35.6905,139.7578`を使用し、6幅すべてoverflow 0、16/16 category linksがorigin保持、18/18 detail linksがorigin除去、reset hrefがquery-free、distance buttonが`aria-pressed=true`。距離帯は`0/1/2キロ離れています`昇順。out-of-area `51.5074,-0.1278`もエラーなしで距離表示した。
- detail代表`/locations/location-detail/3e328a42-3ff1-4018-be72-746aa6e14e17`は6幅すべて`category nav=0`、`role=tablist/tab=0`、zero overflow（320は305/305、1440は1425/1425）。戻り`/locations/hospital`、destination JSONのみ、website external link `https://www.tky.ndu.ac.jp/hospital/`（`_blank`/`noopener noreferrer`）を維持した。これはdetail nav omissionとorigin除去の削除境界evidenceである。
- 390pxの実CDP Tabでは16/16 category hrefと両sort操作へ到達し、全対象で`:focus-visible` true。origin付きcategory rendered hrefを同一hrefでbrowser navigationしorigin保持を、detail rendered hrefをbrowser navigationしoriginなし・category navなしを確認した。coordinate clickはemulated viewportで発火しなかったため、click成功とは記録していない。
- unknown category/detail browser responseはHTTP 404、H1 `404`、standard not-found body、category nav 0、390px `375/375`。data-load/duplicate/malformed build errorとは混同していない。

### origin/dev reference comparison

- reference `src/app/locations/page.tsx`は586行/21116 bytesで、旧monolithic `PageHeader`/`Card`/`CategoryTabs`/`LocationCard`とtab roleを含む。currentはcategory/detail route、`LocationCategoryNavigation`、`LocationSortControls`へ責務分割済み。参照の視覚語彙は保持しながら、現行契約（通常Link、semantic nav、aria-current、originはcategory間だけ、detailはoriginなし、detail category navなし）を優先した。
- reference/currentで`PageHeader.tsx` 26/632、`Card.tsx` 61/1465、`CategoryTabs.tsx` 81/2409、`Button.tsx` 102/3846、`SidebarLayout.tsx` 142/4916は同一。旧`LocationCard.tsx`はcurrentに存在せず、canonical detail routeへ統一。`CategoryTabs`はroute-form consumerが残るためretain/out-of-scopeであり、場所ページへ再導入していない。
- したがって差分は意図した削除・分割境界であり、PageHeader/Card/provider、responsive wrapping、44px操作領域、keyboard focusを壊す未解決差分は検出されなかった。

### 既知の環境artifactと終了境界

- 404 browser retry中にChrome CDPが切断し、cached Chromeを再起動して受入を再実行した。原因調査用にrootのuntracked `core`（389,578,752 bytes）が生成されたが、受入後に親エージェントが生成物であることを確認して削除した。`file` utilityも環境に存在しなかったため、バイナリ内容は読まずstatだけを記録した。現在の作業ツリーに`core`は残っていない。
- `next start`とbuildはT060–T068/Q21生成物ゲート外のため本T052Hでは実行していない。routesManifest errorは観測していない。
- T052Hの検証・視覚・削除境界はGREENだが、Q21のT060–T068未完了を理由にfeature全体のrelease/build完了とは主張しない。T052H中の変更は本台帳と`quickstart.md`への証跡追記だけである。

## Q21 final verification: T067/T068

- `quickstart.md`のT067専用節に、null policy correction後の再実測結果を記録した。標準`npm run build`はexit 0、検証済みartifactはmain 9カテゴリ/62場所、key 16カテゴリ/169場所、GeoJSON 59 features、`derivedRegions` 169 entriesを保持した。live wire dataのoptional `null` 671件もartifactへ保持し、required fieldのnullは0件だった。
- generator/reader focused suiteは2 suites / 402 tests PASS。public lifecycleは181 passed、failure matrix 175件を全件非0終了・stderr分類・artifact未更新・temporary file 0・fallback 0で確認した。direct generatorの非有限値coverageは7 assertions PASSだった。
- build後のartifact-only `next start` probeはHome、先頭category、先頭detail、valid `origin`付きcategoryの4/4 HTTP 200、主要HTML marker成立、CDN・GeoJSON provider・legacy source・fallbackの禁止通信0件だった。probe後のserverとport 3100は終了済みである。
- T068親側最終検証は、`check-prerequisites.sh --json --require-tasks --include-tasks`成功、requirements checklist全項目checked、Q21のspec/plan/research/data-model/contracts/quickstart/tasks/deletion-ledger照合、full Jest（server起動下）159 passed / 2 skipped suites、1412 passed / 13 skipped tests、strict TypeScript exit 0、`npm run lint` exit 0、`npm run build` exit 0、`git diff --check` exit 0で完了した。
- `npm run import-gtfs`は`transit-config.json`不在のENOENTを出力したがscript自体はexit 0で継続した。これはQ21場所artifactの取得・検証・runtime no-network境界とは別の既存GTFS設定未配置として未解決事項に残す。
- それ以前のT059/Q21 clarification節にある「T060〜T068未完了」は、その節の作成時点の履歴である。現行完了状態は本節、`tasks.md`のT067/T068 `[X]`、および`quickstart.md`のT067最終再実測を正とする。

## T103: screenshot-driven UI correction evidence

### 記録境界

- T103E（US5）は、スクリーンショット駆動UI修正の受入証跡を本台帳へ追記した。T103Eの書き込み対象は本台帳だけであり、既存のpre-T100履歴、production source、test、その他のspec/plan/research/contracts、`quickstart.md`、`tasks.md`、commit、pushは変更していない。
- 既存履歴にある通常navやtab roleなしの記述は、当時の観測結果として保持した。現行契約は本T103節に記録し、過去節を書き換えていない。

### スクリーンショットと視覚比較

- fresh production capture JSONで確認した画像を次に保存した。
  - 1440px通常表示: `/opt/data/tmp/kazaguruma-fixed-1440.png`
  - 390px通常表示: `/opt/data/tmp/kazaguruma-fixed-390.png`
  - 1440px不正origin: `/opt/data/tmp/kazaguruma-fixed-invalid-origin-1440.png`
  - 1440pxGPS拒否: `/opt/data/tmp/kazaguruma-fixed-gps-denied-1440.png`
- 比較基準画像は次の2件である。
  - `/opt/data/tmp/kazaguruma-dev-1440.png`
  - `/opt/data/tmp/kazaguruma-dev-390.png`
- current画像は`PageHeader`、`Card`、grid、spacingの視覚語彙を保持した。要求されたactive backgroundとURL-backed semanticsを追加し、意図しない横方向overflowは確認しなかった。
- GPS alertはcontrolsの下で全幅に配置され、controlsは約69pxへ圧縮されない。比較結果は視覚語彙と配置契約の維持を示すが、pixel-identicalとは主張しない。

### 実ブラウザ、DOM、keyboard、GPS拒否

- fresh production serverは`npx next start -p 3100`で起動し、HTTP 200を返した。Puppeteer Chrome 138でpermission stateは`denied`、`secureContext=true`だった。
- 実入力clickは`isTrusted=true`だった。geolocation拒否はerror code `1`、message `User denied Geolocation`になり、Reactの`role="alert"`は1件表示された。初回の再現失敗はdev/buildで`.next`を共有した混在artifactによるhydration不整合であり、`.next`削除後のfresh buildで解消した。
- 表示文言は`エラー位置情報の利用が許可されませんでした。GPSの権限を確認してください。`である。alert classは`alert alert-error alert-soft text-base-content! w-full self-stretch`であり、alertは操作行とは別の親`mt-6 flex flex-col gap-3`に配置された。
- 1440pxのbounding boxは次の通りである。

| 要素 | x | y | width | height |
|---|---:|---:|---:|---:|
| 町字link | 472 | 631 | 402 | 44 |
| 近い順button | 886 | 631 | 402 | 44 |
| GPS alert | 472 | 687 | 816 | 52 |

- `document.innerWidth=1440`、`scrollWidth=1440`、`bodyScrollWidth=1440`であり、実ブラウザで意図しない横方向overflowはなかった。
- fresh production serverで320/375/390/768/1024/1440pxを計測し、全幅で`scrollWidth=innerWidth`、tab 16件、全tabがviewport内、ラベル`whitespace-nowrap`、alert 0件（通常表示）だった。sort操作は320/375/390pxで各`52px`高、768/1024/1440pxで各`44px`高だった。
- normal、GPS denied、invalid originのtablistは`NAV`で、`aria-label="場所カテゴリ"`、tab 16件を持つ。active tabは`aria-selected="true"`、`aria-current="page"`、`aria-controls="location-category-panel"`、`tabIndex=0`、class `tab tab-active bg-base-100`を持ち、非active tabは`tabIndex=-1`だった。
- invalid originはURLの`origin=not-a-coordinate`を保持し、alert 1件と町字fallbackを表示した。`ArrowRight`でURLを変更せず、次のtabへfocusを移動した。

### build混在の解消とローカル検証

- 初回のproduction GPS再現は、dev serverとbuild/startが同じ混在した`.next`を共有したためBLOCKになった。fresh`.next`を削除してbuildを再実行した後にhydrationは解消し、これはsource regressionではなく、解決済みの環境問題として記録する。
- fresh`.next`削除後の`npm run build`はexit 0で、Next static pagesは211/211だった。GTFSの`transit-config.json` missingは既存の非致命warningであり、buildは継続成功した。
- focused Jestとfull Jestはexit 0だった。full Jestは167 suites passed / 2 skipped、1427 tests passed / 13 skippedだった。
- strict TypeScriptはexit 0、`npm run lint`はexit 0、`git diff --check`はexit 0だった。
- artifact readerは`status=success`、`artifactStatus=validated`を返した。
- GitHub Actions CIのsuccessとは混同しない。未commit差分はCIに乗っていないため、本T103EはCI successを主張せず、上記の実ブラウザ、build、local verificationを受入証跡とする。

### T103E終了確認

- T103Eは本台帳への本節追記だけを行った。production source変更はなく、test、spec、plan、research、contracts、`quickstart.md`、`tasks.md`の変更、commit、pushも行っていない。
