# Tasks: 施設ページと検索フォームのURL整理

**Input**: `specs/023-location-pages-route-form/`の仕様、計画、調査、データモデル、契約、検証ガイド

**前提**: `plan.md`、`spec.md`、`research.md`、`data-model.md`、`contracts/ui-url-contract.md`、`quickstart.md`

**実行規約**:

- 各タスクIDは1人のサブエージェントへだけ委任する。
- REDテストの直後に、別サブエージェントがテストだけを読み取りレビューする。PASSまでGREENを始めない。
- GREEN担当は対応テストを凍結する。許可した本番パス以外を変更しない。
- 親担当が毎回、変更パス、テスト結果、`git diff --check`を再確認してからチェックする。
- `[P]`はパスが完全に重ならない場合だけ並行可能である。本作業は共有テストと生成物が多いため、原則として順番に実行する。
- commit、push、PR、CI確認は最終タスクだけを親担当が実行する。

## Phase 1: 基盤と公開データ

**Goal**: 施設・候補・町字を検証済みの単一JSONへ固定する。

- [x] T001 [US4] `src/lib/location/__tests__/location-build-data.test.ts`と`src/lib/location/__tests__/fixtures/location-build-data.ts`に、施設・カテゴリ検証、元の空白カテゴリID、予約名、ID重複、座標、空カテゴリ、Polygon穴、町字不明、成果物の原子的置換のREDテストを追加する。
- [x] T002 [US4] T001のテストを読み取り専用でレビューした。判定はFAIL。データ集合の取り違え、未実装モジュールだけで失敗するRED、カテゴリ検証と表示情報保持の不足、原子的置換の弱い契約を記録した。レビュー記録は親会話に残す。変更禁止。
- [x] T031 [US4] T002のFAILを修正するREDテストだけを`src/lib/location/__tests__/location-build-data.test.ts`と`src/lib/location/__tests__/fixtures/location-build-data.ts`で更新する。詳細施設を`keyLocations`、トップ候補を`mainFacilities`として実データ集合へ揃える。カテゴリID全契約、有限座標、代表的な表示・帰属情報保持、loader・generatorの成功経路を追加する。順序・英語エラー文言に依存せず、原子的置換の範囲を正確に表す。
- [x] T032 [US4] T031のテストを別サブエージェントが読み取り専用で再レビューした。判定はFAIL。候補座標、全3入力のloader形状、生成日時・データ版、詳細施設IDのテスト不足を記録した。変更禁止。
- [x] T033 [US4] T032のFAILを、`src/lib/location/__tests__/location-build-data.test.ts`と`src/lib/location/__tests__/fixtures/location-build-data.ts`だけで補正する。候補座標、mainFacilitiesとGeoJSONのloader失敗、`generatedAt`と空版、詳細施設IDの不正を追加する。
- [x] T034 [US4] T033を別サブエージェントが読み取り専用で再レビューした。判定はFAIL。任意の説明・画像・外部リンクの欠落許容と、`descriptionCopyright`・`imageCopyright`の保持が未検証だった。変更禁止。
- [x] T035 [US4] T034のFAILを、`src/lib/location/__tests__/location-build-data.test.ts`と`src/lib/location/__tests__/fixtures/location-build-data.ts`だけで補正する。任意表示項目の欠落でも施設を保持し、両方の任意帰属項目を保持する契約を追加する。
- [x] T036 [US4] T035を別サブエージェントが読み取り専用で最終レビューする。FR-005の必須・任意メタデータ契約が過不足なく、テストが永続skipしないことを確認する。変更禁止。PASS後だけT003へ進む。
- [x] T003 [US4] T001/T031/T033/T035をGREENにする。`src/types/location-pages.ts`、`src/lib/location/location-build-data.ts`、`scripts/build-location-data.ts`、`src/generated/location-data.json`、`package.json`、`.gitignore`だけを変更する。`predev`と`prebuild`へ生成を追加し、`start`へ追加しない。実行時施設CDN loaderは追加しない。
- [x] T004 [US4] T003の成果物を親が再確認した後、`src/utils/__tests__/addressLoader.test.ts`と`src/utils/addressLoader.ts`から生成JSONへ移行するためのREDテストを追加する。閲覧時の施設CDN取得と空配列フォールバックの廃止を検証する。
- [x] T005 [US4] T004のテストを読み取り専用でレビューした。判定はFAIL。候補配列の先頭と詳細施設配列の先頭へ依存していたため、ID・カテゴリ名照合へ補正する。
- [x] T037 [US4] T005のFAILを`src/utils/__tests__/addressLoader.test.ts`だけで補正する。現在の生成データの配列順に依存する候補先頭・施設先頭の代表検証を削除またはID・カテゴリ名検索へ変更する。snapshot全体比較と件数検証は維持する。
- [x] T038 [US4] T037を別サブエージェントが読み取り専用で最終レビューする。候補・詳細のデータ集合変換、順序非依存、fetch復元、既存resultローダー契約、truthful REDを確認する。変更禁止。PASS後だけT006へ進む。
- [x] T006 [US4] T004をGREENにする。`src/utils/addressLoader.ts`とT004のテストだけを変更する。経路検索や`/api/geocode`は変更しない。focused Jest 12/12、型検査、lint、差分検査を親が確認した。

## Phase 2: カテゴリ・詳細ページ

**Goal**: 一覧、カテゴリ、詳細を事前生成し、通常リンクで往復する。

- [x] T007 [US1] `src/app/locations/__tests__/page.test.tsx`、`src/app/locations/[category-id]/__tests__/page.test.tsx`、`src/app/locations/location-detail/[id]/__tests__/page.test.tsx`、`src/components/features/__tests__/LocationCard.test.tsx`へREDテストを追加した。カテゴリURL、詳細URL、所属カテゴリリンク、未知URL、帰属情報、町字別初期表示、新旧URL、実行時GeoJSON取得なしを検証する。
- [x] T008 [US1] T007のテストを読み取り専用でレビューした。判定はFAIL。`/locations`テストの1カテゴリmockが全16カテゴリ期待を生む偽のREDを記録した。変更禁止。
- [x] T039 [US1] T008のFAILを`src/app/locations/__tests__/page.test.tsx`だけで補正する。全カテゴリリンクのテスト内で`mockLoadLocationCategories.mockResolvedValueOnce`へ生成済み16カテゴリ相当を渡す。既存テストの1カテゴリfixtureと他の受入条件は維持する。
- [x] T040 [US1] T039を別サブエージェントが読み取り専用で再レビューする。新テストが本番実装の不足だけでREDとなり、既存テスト・通常リンク・非順序依存・条件付きrouteテストを壊していないことを確認する。変更禁止。PASS後だけT009へ進む。
- [x] T009 [US1] T007/T039をGREENにする。`src/app/locations/page.tsx`、`src/app/locations/[category-id]/page.tsx`、`src/app/locations/location-detail/[id]/page.tsx`、必要なnot-foundファイル、`src/components/features/LocationCategoryList.tsx`、`src/components/features/LocationCard.tsx`、`src/lib/location/location-list-state.ts`とT007/T039テストだけを変更する。`src/app/location-detail/[id]/`と旧テストを削除する。`src/utils/clientGeoUtils.ts`は削除せず、使用者がなくなるまで変更しない。focused Jest 4 suite/13 tests、lint、差分検査を親が確認した。全体tscの旧route参照はT022で整理する。
- [x] T010 [US1] `src/components/features/__tests__/LocationCategoryList.test.tsx`へREDテストを追加する。明示GPS・住所検索後だけ距離順に切り替え、失敗時に町字別一覧を保持し、カテゴリ移動・再読み込みで初期表示へ戻ることを検証する。
- [x] T011 [US1] T010のテストを読み取り専用でレビューする。位置情報の自動要求、距離順のURL保存、施設データ再取得を許可していないことを確認する。変更禁止。
- [x] T012 [US1] T010をGREENにする。`src/components/features/LocationCategoryList.tsx`、`src/lib/location/location-list-state.ts`、T010テストだけを変更する。429時の既存利用制限遷移は維持する。実装は5/6テストを通過したが、T010 fixtureの部分一致により1件が偽失敗したため、T041/T042後に再検証する。
- [x] T041 [US1] T012の偽失敗を`src/components/features/__tests__/LocationCategoryList.test.tsx`だけで補正する。旧施設名が新施設名へ部分一致するfixtureを一意な名称またはID照合へ変更する。距離順・失敗時保持・カテゴリ切替の期待値は変更しない。
- [x] T042 [US1] T041を別サブエージェントが読み取り専用でレビューする。補正がテストの観測精度だけを改善し、T010の受入条件を弱めないことを確認する。変更禁止。PASS後にT012のfocused GREENを再実行する。

## Phase 3: 部分入力URLと施設CTA

**Goal**: 結果URL契約を保ったまま、トップが部分的な条件を再現する。

- [x] T013 [US2] `src/lib/transit/__tests__/route-search-query.test.ts`と`src/app/locations/location-detail/[id]/__tests__/page.test.tsx`へREDテストを追加する。目的地のみ、全条件、重複の先頭有効値、不正座標・日時・真偽値、URL優先、旧JSON目的地の不受理、座標CTAを検証する。
- [x] T014 [US2] T013のテストを読み取り専用でレビューする。既存の全条件必須parser、`/routes`、API URL生成の契約を変えていないことを確認する。変更禁止。
- [x] T015 [US2] T013をGREENにする。`src/lib/transit/route-search-query.ts`、必要なら`src/types/route-input.ts`、`src/app/locations/location-detail/[id]/page.tsx`、T013テストだけを変更する。focused Jest 2 suite/24 testsを親が確認した。全体tscの旧route参照はT022で整理する。

## Phase 4: 単一フォーム

**Goal**: 全4セクションを常時表示し、確認済みの地点だけを要約表示する。

- [x] T016 [US3] `src/app/__tests__/page.test.tsx`、`src/app/__tests__/page-navigation-contract.test.tsx`、`src/app/__tests__/accessibility-source-contract.test.ts`、`src/components/features/__tests__/RouteSearchForm.test.tsx`、`src/components/features/__tests__/OriginSelector.test.tsx`、`src/components/features/__tests__/DestinationSelector.test.tsx`、`src/components/features/__tests__/DateTimeSelector.test.tsx`、`src/components/features/__tests__/LocationSuggestions.test.tsx`、`src/components/ui/__tests__/InputField.test.tsx`へREDテストを追加した。単一form、4セクション、URL初期化、候補select、地点編集focus、入力保持、日時・優先ラジオ、GPS文言、項目別エラー、429例外、最終submitだけの経路遷移を検証する。
- [x] T017 [US3] T016のテストを読み取り専用でレビューした。判定はFAIL。候補selectのfixture値、空入力エラー、編集後DOM参照、過剰な静的source検査、GPS可視文言、日時保持の補正を記録した。変更禁止。
- [x] T043 [US3] T017のFAILを、T016で許可したテストパスだけで補正する。候補selectは実在option値を使う。空の出発地検索は既存エラー契約を確認する。編集後は要素を再取得する。静的source検査は新規の過剰な文字列検査を削除または狭め、既存契約を壊さない。GPSの可視文言と不正URL時の有効日時保持を検証する。
- [x] T044 [US3] T043を別サブエージェントが読み取り専用で再レビューする。T016の受入条件を弱めず、偽RED・過剰な実装指定・T022との重複を除去したことを確認する。変更禁止。PASS後だけT018へ進む。
- [x] T018 [US3] T016/T043をGREENにする。`src/app/page.tsx`、`src/components/features/RouteSearchForm.tsx`、`OriginSelector.tsx`、`DestinationSelector.tsx`、`DateTimeSelector.tsx`、`LocationSuggestions.tsx`、`useGeocodingSearch.ts`、`src/components/ui/InputField.tsx`、T016/T043テストだけを変更する。`/routes`、`/api/geocode`、プロバイダ設定を変更しない。focused T016 9 suite/77 tests、T012/T015回帰42 testsを親が確認した。全体tscの旧route参照はT022で整理する。
- [x] T045 テスト衛生を修正する。`src/lib/location/__tests__/fixtures/location-build-data.ts`をJestのテスト収集対象外へ移動し、参照元を更新する。`src/components/features/__tests__/LocationSuggestions.test.tsx`の未使用importを削除する。テストの意味とproductionは変更しない。
- [x] T046 T045を別サブエージェントが読み取り専用でレビューする。全体Jestの空suite収集とlintエラーだけを解消し、fixture契約・既存テストを弱めていないことを確認する。変更禁止。PASS後にT019へ進む。
- [x] T019 [US3] `src/components/features/__tests__/useGeocodingSearch.test.tsx`と`src/components/features/__tests__/OriginSelector.race.test.tsx`へREDテストを追加した。再入力、編集、unmount後に古い名前検索・GPS逆ジオコード応答が新しい選択を上書きしないことを検証する。
- [x] T020 [US3] T019のテストを読み取り専用でレビューした。判定はFAIL。`OriginSelector.race.test.tsx`が`loading=true`中のdisabled検索ボタンを強制発火しており仕様外だったため、GPS側をunmount後の保留逆ジオコード応答へ狭める。
- [x] T047 [US3] T020のFAILを`src/components/features/__tests__/OriginSelector.race.test.tsx`だけで補正する。disabledボタンの強制イベントによるGPS対名前検索競合を削除し、GPS逆ジオコード要求中のunmount後に`onOriginSelected`と状態更新を行わない実在ライフサイクル契約へ置換する。hookの新旧検索競合テストは変更しない。
- [x] T048 [US3] T047を別サブエージェントが読み取り専用で再レビューする。仕様内のunmount契約、応答形状、モック復元、既存429テスト非干渉、truthful REDを確認する。変更禁止。PASS後だけT021へ進む。
- [x] T021 [US3] T019/T047をGREENにする。focused race 3 tests、既存selector回帰26 tests、lint、差分検査を親が確認した。`src/components/features/useGeocodingSearch.ts`、`src/components/features/OriginSelector.tsx`、`src/components/features/__tests__/useGeocodingSearch.test.tsx`、`src/components/features/__tests__/OriginSelector.race.test.tsx`だけを変更する。

## Phase 5: 統合検証と契約の整理

- [x] T022 `src/app/__tests__/accessible-route-pages.test.tsx`、`src/app/__tests__/accessibility-source-contract.test.ts`、`src/components/layouts/__tests__/SidebarLayout.test.tsx`の旧詳細route参照を新routeへ移行するREDテストを追加・更新する。旧子form・旧JSON URLの静的契約を整理し、旧形のproduction使用件数0を`issues/79-location-pages-route-form/investigation.md`へ記録する。
- [x] T023 T022のテストと調査記録を読み取り専用でレビューする。静的検査を弱めず、実在しない任意記法を追加していないことを確認する。変更禁止。
- [x] T024 T022をGREENにする。`src/app/locations/location-detail/[id]/page.tsx`へ生成済みスナップショットを用いた`generateMetadata`を追加し、T022で指定したテストと`issues/79-location-pages-route-form/investigation.md`だけを必要に応じて変更する。旧routeや実行時CDN取得は戻さない。focused 4 suite/23 tests、旧production route参照0件、差分検査を親が確認した。
- [x] T025 隔離コピーで`quickstart.md`の生成、Next本番生成、CDN遮断、全カテゴリ・詳細URL、JS無効、未知URL、フォームのキーボード操作を自動検証するスクリプトとfixtureを追加した。対象は`scripts/fixtures/location-pages/`と`scripts/verify-location-pages.mjs`だけとした。
- [x] T026 T025の検証スクリプトを読み取り専用でレビューした。判定はFAIL。空カテゴリ拒否、配列順依存、サーバー側CDN検証不足、キーボード操作不足、`--next-dir`不一致、範囲検証不足を記録した。変更禁止。
- [x] T049 T026のFAILを`scripts/verify-location-pages.mjs`と`scripts/fixtures/location-pages/`だけで補正する。詳細カテゴリと候補カテゴリの空配列を許容する。カテゴリ・施設・候補の集合比較をIDまたは名称の写像とソートで行う。代表施設・候補を先頭要素で選ばずfixtureの安定ID・名称で選ぶ。施設データCDNの検査対象を具体的なデータURLへ限定し、外部画像を誤検出しない。`--next-dir`と起動成果物を一致させる。生成時刻のISO、座標の有限・範囲、未知URL、JS無効リンク、実際のキーボードによる候補選択・なおす・radio・最終submit到達を検証する。実際の経路送信は行わない。
- [x] T050 T049を別サブエージェントが読み取り専用でレビューした。判定はFAIL。候補選択が`Home`だけで代表候補の実選択を検証していないため、キーボード操作を補正する。
- [x] T051 T050のFAILを`scripts/verify-location-pages.mjs`と`scripts/fixtures/location-pages/`だけで補正する。fixtureの代表候補を先頭以外にし、実optionの位置までTab・ArrowDownで移動して選択する。選択後に値・名称・目的地要約を確認する。候補操作を先頭要素依存にしない。
- [x] T052 T051を別サブエージェントが読み取り専用で最終レビューする。候補を実際に操作すること、順序非依存、静的・runtime前提、DB非変更を確認する。変更禁止。PASS後にT027へ進む。
- [x] T027 T025を実行して検証した。隔離`next build`はexit 0、runtimeは空白カテゴリ解決・unknown表示・HTMLエンティティ処理の3系統でFAILした。production修正が必要なため、スクリプト補正と新しいREDテストを追加してから再実行する。DB・GTFSは変更していない。

## Phase 6: 最終確認と提出

- [x] T053 T027で検出した検証スクリプトの誤検出を`scripts/verify-location-pages.mjs`と`scripts/fixtures/location-pages/`だけで補正する。HTMLエンティティを表示文字列として解釈し、`&`を含む施設名を正しく検証する。実際のfacility CDN検査、未知URL、空白カテゴリ、キーボード契約を弱めない。
- [x] T054 T053を別サブエージェントが読み取り専用でレビューする。検証スクリプトが表示内容を正しく判定し、外部画像や許容済み空カテゴリを誤検出しないことを確認する。変更禁止。PASS後にT055へ進む。
- [x] T055 空白カテゴリとunknown URLの本番不足を検出するREDテストを、既存の`src/app/locations/[category-id]/__tests__/page.test.tsx`、`src/app/locations/[category-id]/not-found.test.tsx`、`src/app/locations/location-detail/[id]/not-found.test.tsx`へ追加する。エンコード済み`natural environment park`の解決、未知カテゴリ・未知詳細の日本語not-foundと`/locations`リンクを検証する。新規テストは収集エラーにしない。
- [x] T056 T055を別サブエージェントが読み取り専用でレビューする。productionのroute解決とsegment not-found契約だけを検証し、既存静的ページ契約を壊さないことを確認する。変更禁止。PASS後にT057へ進む。
- [x] T057 T055をGREENにする。`src/app/locations/[category-id]/page.tsx`、`src/app/locations/[category-id]/not-found.tsx`、`src/app/locations/location-detail/[id]/not-found.tsx`だけを変更した。単体REDは解消したが、fresh runtimeではencodedカテゴリとunknown URLのNext実挙動が未解決だったため、T058以降で追加修正する。
- [x] T058 T027/T057のfresh runtime結果を再現するREDテストへ補正する。`src/app/locations/[category-id]/__tests__/page.test.tsx`と`src/app/locations/location-detail/[id]/__tests__/page.test.tsx`でNextのunknown URL対応に必要な`dynamicParams`契約、二重エンコード相当のカテゴリ値、直接ページの日本語案内を検証する。不要なsegment not-foundテストは整理する。
- [x] T059 T058を別サブエージェントが読み取り専用でレビューする。Nextの実URL挙動をテストが正確に表現し、known static pages・URLエンコード・unknown案内を過剰に固定していないことを確認する。変更禁止。PASS後にT060へ進む。
- [x] T060 T058をGREENにする。`dynamicParams=true`、二重decode、不要segment not-found削除を実装し、T058 focused 12 testsとlint・差分検査を親が確認した。`src/app/locations/[category-id]/page.tsx`、`src/app/locations/location-detail/[id]/page.tsx`を変更し、不要になった`src/app/locations/[category-id]/not-found.tsx`と`src/app/locations/location-detail/[id]/not-found.tsx`を削除する。known pagesをSSGのまま維持し、`dynamicParams=true`でunknown URLを日本語案内へ接続し、カテゴリ識別子の実URLエンコードを解決する。runtime CDN取得と旧routeは戻さない。
- [x] T061 `scripts/verify-location-pages.mjs`の静的route宣言検査と、`specs/023-location-pages-route-form/{research.md,plan.md,quickstart.md}`、`issues/79-location-pages-route-form/investigation.md`のruntime方針を最終実装へ更新する。known routeは`generateStaticParams`でSSG、unknown routeは`dynamicParams=true`で日本語page stateへ到達する契約を記録する。
- [x] T062 T061を別サブエージェントが読み取り専用でレビューする。検証スクリプトと設計文書がfresh runtimeの実測に一致し、unknown/knownの境界を過剰に緩めていないことを確認する。変更禁止。PASS後にT027を再実行する。
- [x] T063 統一404の要件をREDテストへ反映する。`src/app/locations/[category-id]/__tests__/page.test.tsx`と`src/app/locations/location-detail/[id]/__tests__/page.test.tsx`でknown routeの`dynamicParams=false`を検証し、個別unknown page/link依存を削除する。`src/app/__tests__/not-found.test.tsx`で共通404の日本語本文を検証する。
- [x] T064 T063を別サブエージェントが読み取り専用でレビューする。404の意味、known SSG、統一本文、既存静的ページ契約を過剰なく検証することを確認する。変更禁止。PASS後にT065へ進む。
- [x] T065 T063をGREENにする。`src/app/locations/[category-id]/page.tsx`、`src/app/locations/location-detail/[id]/page.tsx`、新規`src/app/not-found.tsx`だけを変更する。known routeをSSGし、`dynamicParams=false`で未知URLを共通404へ送り、カテゴリ・詳細固有の404経路を作らない。戻るリンクは共通404に追加しない。
- [x] T067 `src/app/__tests__/accessible-route-pages.test.tsx`の旧詳細固有404・戻るリンク期待を共通`src/app/not-found.tsx`の見出し・本文テストへ置き換える。リンクを要求しない。
- [x] T068 T067を別サブエージェントが読み取り専用でレビューする。統一404、既知詳細ページ、共通layout/a11y契約を弱めず、旧route期待を残していないことを確認する。変更禁止。PASS後にT066へ進む。
- [x] T066 `scripts/verify-location-pages.mjs`と`specs/023-location-pages-route-form/{spec.md,research.md,plan.md,quickstart.md,contracts/ui-url-contract.md}`、`issues/79-location-pages-route-form/investigation.md`を統一404方針へ更新する。unknown URLはHTTP 404と共通本文を検証し、戻るリンクを要求しない。known routeは`dynamicParams=false`と`generateStaticParams`を検証する。node --check、静的snapshot/source検証、差分検査を親が確認した。
- [x] T069 fresh runtimeで判明した検証器の誤判定を`scripts/verify-location-pages.mjs`だけで補正する。共通404の共有ナビゲーションリンクを禁止せず、JS無効pageとJS有効フォームpageを分離して、CDN監視を両方へ設定する。統一404のHTTP 404・共通本文、全known URL、JS無効リンク、キーボード、CDN 0件の検証は維持する。親のfresh runtimeで8/9 PASS後、T071へ引き継いだ。
- [x] T071 fresh runtimeで判明したRubyfulの`<rt>`付加によるフォーム見出し誤判定を`scripts/verify-location-pages.mjs`だけで補正する。既存の見出しIDを使い、ルビ注釈を除いた見出し名を検証する。フォーム構造・Tab到達・radio・submit・CDN検査は維持する。親のfresh runtimeでruntime 9/9、static 3/3を確認した。
- [x] T070 T069/T071を別サブエージェントが読み取り専用でレビューする。共通404のリンク有無を過剰固定せず、JS無効とJS有効pageを分離し、Rubyful後もフォーム見出しと全受入検査を保持していることを確認する。変更禁止。レビューPASS、fresh runtime 9/9、static 3/3を親が確認した。
- [x] T072 全テストで検出した`src/components/features/LocationCategoryList.tsx`の`disabled:opacity-60` 3箇所を削除し、既存の色・不透明度契約を満たす。disabled cursor・44px操作領域・その他のstyleは維持する。親のcolor-compliance 8/8と残存0件を確認した。
- [x] T028 親担当がfocused Jest、source-only TypeScript（stale`.next`を一時退避）、`npm run lint -- --no-cache`、`npm test -- --runInBand --no-cache --watch=false --coverage=false`、`git diff --check`、隔離`next build`、fresh static/runtime verifierを実行した。全テストは152 suites PASS/2 skipped、994 tests PASS/13 skipped、型検査PASS、lint PASS（既存warningのみ）、direct build exit 0、static 3/3、runtime 9/9だった。Node v26.5.1で実行し、package要求Node 22.xとの差異を記録する。
- [x] T029 親担当が最終差分を確認し、`add: Issue #79の施設ページと検索フォームをURL整理`でcommitした。feature branchをGitHub・Tangledへpushし、両remoteの`git ls-remote` SHAが`f1e978879ed4e238c8a8df3968f3e222c259cb4c`と一致することを確認した。
- [x] T030 親担当がIssue #79を参照する日本語PR #139（`https://github.com/nawashiro/kazaguruma-transit/pull/139`）を作成し、base=`dev`、head=`spec/issue-79-uri-pages`、head SHA=`f1e978879ed4e238c8a8df3968f3e222c259cb4c`、変更62ファイル、title/bodyを読み戻した。Quality Gate run `34027074381`の最終結論PASSを確認した。Issueのclose・PRのmergeは行わない。

## Dependencies & Execution Order

`T001 → T002 → T003 → T004 → T005 → T006 → T007 → T008 → T009 → T010 → T011 → T012 → T013 → T014 → T015 → T016 → T017 → T018 → T019 → T020 → T021 → T022 → T023 → T024 → T025 → T026 → T027 → T028 → T029 → T030`

- US4の生成基盤がUS1・US3をブロックする。
- US1のカテゴリ・詳細がUS2のCTAをブロックする。
- US2の部分URL parserがUS3のフォームをブロックする。
- 各テストレビューがGREENをブロックする。
- 最終検証と提出はすべてのGREENをブロックする。

## Independent Test Criteria

- **US1**: JS無効でも一覧→カテゴリ→詳細→カテゴリをURLだけで辿れる。距離順は明示操作後だけ行う。
- **US2**: 目的地だけ、全条件、不正値のURLを直接開き、既存結果URL契約を壊さない。
- **US3**: 順不同で全条件を入力し、地点の編集で他条件を保持し、最後の送信だけで`/routes`へ進む。
- **US4**: 全ページが同一スナップショットを使い、CDN停止後も閲覧できる。入力不正は公開準備を停止する。

## MVP

まずT001〜T012で、ビルド時スナップショットと静的な施設閲覧を完成させる。続いてURLとフォームを追加する。
