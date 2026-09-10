# Research: 場所データページのJavaScript削減

**Feature**: [spec.md](./spec.md)
**Phase**: 0 — Outline & Research
**Date**: 2026-09-07
**Repository**: `/opt/data/kazaguruma-transit`

## 調査方法と前提

`AGENTS.md`、憲章、既存の場所一覧・場所詳細・ホーム・経路検索URL契約、`/discussions`の共通ナビゲーション、現在の場所データを読み取り専用で調査した。現在のソースは変更していない。

現在の場所データ版 `2.1.1` を読み取り、`key_locations.json` は16カテゴリ・169場所、カテゴリID重複0、場所ID重複0、URL境界に問題となるslash/backslash/query/fragment/control character 0件だった。カテゴリ順の先頭は `city_office_and_branch_offices`（表示名「区役所・出張所」）である。

## Decision 1: ビルド時に場所データを固定し、実行時は生成物だけを使う

### Decision

- ビルド工程で、ホームの`main_facilities.json`、カテゴリ・詳細の`key_locations.json`、地域判定用の町字GeoJSONを取得・検証し、検証済みの場所データと座標から導出した表示用地域情報をビルド生成物へ固定する。各データソースの完全な取得URI（`mainFacilitiesUri`、`keyLocationsUri`、`townGeoJsonUri`）は`appConfig`（設定ファイルは`app-config.json`）から読む。
- HTTP、JSON/GeoJSON形状、必須フィールド、空カテゴリ、重複IDなどの取得・検証失敗は、空・不完全・古い生成物を残さず公開用ビルドを失敗させる。
- `/locations`、`/locations/[category-id]`、`/locations/location-detail/[id]`、ホームは、ビルド成功後にビルド生成物だけを読む。実行時にCDNやデータ提供元へ再取得せず、生成物を補う別データ取得も行わない。
- `origin`クエリによる距離計算、並べ替え、表示切替は、任意の座標に対応するため実行時に行ってよい。ただし入力はビルド生成物に限定する。
- 各データソースの取得URI（`mainFacilitiesUri`、`keyLocationsUri`、`townGeoJsonUri`）の更新は次回ビルドで反映する。新しい場所データAPI、DB、ブラウザ永続化、アプリケーション独自の永続キャッシュは追加しない。

### Rationale

任意の`origin`をURLで受け付けるカテゴリページでは、全座標の組み合わせを静的HTMLとして列挙することはできない。そこで、データ取得・検証・地域導出をビルド時の固定工程へ分離し、ページのHTML生成方式とは独立した入力境界にする。これなら実行時の距離計算を維持しながら、データ提供元の障害や実行時CDNアクセスをなくせる。ビルド時データ生成とページ全体の静的HTML生成は同一視しない。

### Alternatives considered

- **データ取得を含めてページをSSRする**: 実行時にCDNへ依存し、データ提供元の障害が利用者へ伝播するため不採用。SSRを使う場合も、入力は生成物に限定する。
- **全ページを静的HTMLに固定する**: 任意の`origin`付き表示を事前列挙できず、距離順表示の契約を壊すため不採用。データのビルド時固定とページHTMLの静的化は分離する。
- **現在のclient fetchを維持する**: CDN失敗、loading、URLナビゲーション、カテゴリ状態をブラウザ側に残すため不採用。
- **座標をPOST/fetchで別APIへ送る**: `origin`をURLに含めない代償としてAPIと通信状態を増やすため不採用。

## Decision 2: `/locations`は先頭カテゴリの正規URLへ解決する

### Decision

- `/locations`はデータ順が確定した先頭カテゴリの`/locations/[category-id]`へ解決する。
- カテゴリ0件、場所データ取得失敗、形式不正の場合はビルドを成功扱いにせず、公開用ビルドを失敗させる。ビルド後の生成物欠落・破損は外部へフォールバックせずデータエラー状態とする。
- 存在しないカテゴリID、空ID、URL識別子として不正な値は通常の404とする。
- `origin`を持たないサイドバー入口からは、先頭カテゴリの町字表示へ入る。

### Rationale

`/locations`と先頭カテゴリページの二重表示を避け、URLと表示内容を一致させる。共通ナビゲーションの先頭選択状態も、URLで一意に決まる。

## Decision 3: URL・origin・並べ替えの契約

### Decision

- `[category-id]`は既存の`category:en`をURLエンコードした値とする。新しいslug対応表は作らない。
- `origin=<latitude>,<longitude>`は現在カテゴリURLの一時状態とする。緯度・経度順は既存の経路検索結果URLと同じである。
- 数値として解釈できる座標は千代田区外でも受け入れる。文字列形式不正、NaN等はエラーを表示しつつ町字一覧を表示する。
- カテゴリ間のナビゲーションは有効な`origin`を維持する。
- 場所詳細、その他ページ、「町字で並べる」は`origin`を削除する。
- 有効な`origin`で再度GPS取得に失敗しても、既存の距離順表示と`origin`を維持し、エラーだけを表示する。
- `sessionStorage`、`localStorage`、アプリ共通状態には座標を保存しない。

### Rationale

カテゴリ間では同じ座標で比較することが利用者にとって自然だが、詳細や他ページまで位置情報を持ち回る必要はない。「町字で並べる」を明示的なリセット経路にすることで、URL状態を通常のリンクで制御できる。

## Decision 4: 「近いところから表示」はGPS専用の小さな境界にする

### Decision

- カテゴリナビゲーションの下に「町字で並べる」「近い順に並べる」の2操作を置く。
- 「近い順に並べる」はブラウザの`navigator.geolocation`を、利用者の明示操作後にだけ呼ぶ。
- 取得成功後は現在カテゴリURLへ通常のGET遷移を行い、ビルド生成物を入力として実行時に距離順を計算する。
- 名前・住所入力、Google Maps API、ジオコーディングAPI、住所検索専用レート制限は場所ページから削除する。
- 「町字で並べる」は現在カテゴリのqueryなしURLへの通常遷移とする。

### Rationale

GPSボタンだけのclient islandにし、場所データはビルド生成物から読み、距離計算・ページ表示はその生成物を入力として扱う。住所検索はGoogle Maps APIとレート制限の複雑性を持つため、今回の小さな責務から外す。

## Decision 5: 町字分類はビルド時に導出し、既存の純粋計算を再利用する

### Decision

- `geoUtils.ts`のポリゴン判定、地域名整形、カテゴリ内グループ化の純粋関数を、ビルド時のGeoJSON取得・検証・地域導出工程と分離して再利用する。
- GeoJSONは`appConfig`（設定ファイルは`app-config.json`）の`townGeoJsonUri`で指定した完全な取得URIからビルド工程で取得・検証し、座標から地域を導出した結果を場所ページのビルド生成物へ含める。実行時はGeoJSON CDNやデータ提供元へアクセスせず、コードへ取得URIを埋め込んだり、Next.jsの実行時fetchキャッシュを場所データの境界として使ったりしない。
- `key_locations.json`の正規スキーマには`area`フィールドがなく、確認したデータ版の169場所にも存在しない。町字はすべて座標からGeoJSONで導出し、導出不能は「その他」にする既存意味を維持する。
- 距離計算は既存`calculateDistance`、距離順は既存`sortLocationsByDistance`を基礎にし、同距離時は元のデータ順を維持する。
### Alternatives considered

- **GeoJSONを毎回ブラウザまたは実行時サーバーで取得する**: CDN依存を公開後まで残し、ビルド成功後の実行時外部取得禁止に反するため不採用。
- **key_locations.jsonにareaフィールドを追加・依存する**: 正規スキーマに存在しないキーであり、データ契約を壊すため不採用。町字は座標からGeoJSONで導出する。
- **距離計算ロジックを新規実装する**: 既存の距離計算とテストを重複させるため不採用。

## Decision 6: 共通カテゴリナビゲーションはURLナビゲーションとして実装する

### Decision

- `/locations/layout.tsx`は共通shellとデータエラー境界だけを担当し、カテゴリナビゲーションを共有しない。カテゴリナビゲーションは`/locations/[category-id]/layout.tsx`だけが所有する。
- `LocationCategoryNavigation`は`nav`・通常リンク・`aria-current="page"`を持つ。視覚的なtabs-boxは再利用してよいが、通常のサイト移動をapplication tab widgetとして複製しない。
- `origin`の読み取り・カテゴリ間リンクへの付与だけを小さなclient islandに限定し、場所データ取得は行わない。
- `/discussions`の`DiscussionManagementTabLayout`は、active state、ページリンク、戻り導線、キーボード検証の参照として利用する。

### Rationale

既存の`CategoryTabs`はbuttonと一時的なactive stateを持つため、カテゴリURLを正本にする要求とは異なる。`DiscussionManagementTabLayout`の構造・状態表示を参照しつつ、場所カテゴリでは通常ナビゲーションとして最小のclient境界にする。

## Decision 7: URL不在とデータエラーを分離する

### Decision

- 未知・空・不正なカテゴリURLと場所詳細URLは通常の404にする。feature固有の404ページや404からの戻りリンクは追加しない。
- ビルド時のCDN fetch、HTTP、JSON/GeoJSON decode・形状検証、必須フィールド検証、重複IDの失敗は公開用ビルドを失敗させる。URLが存在するページでビルド生成物が欠落・破損した場合だけ、日本語のデータエラーとして扱い、実行時の外部フォールバックは行わない。
- `loadKeyLocationsData`の空配列成功化を詳細・カテゴリの不在判定に使わず、status-preserving境界を通す。

### Rationale

URL不在と、存在するページのデータ破損・取得失敗を同じ画面へ収束させると、404、再試行、運用障害の意味が曖昧になる。Next.js標準の404をURL識別子境界に使い、ビルド時の取得・検証失敗は公開前に止め、ビルド後の生成物欠落・破損だけをデータエラーとして扱う。

## Decision 8: 不要ロジックは削除ゲートを通して根こそぎ除去する

### Decision

- 後方互換用の別名ルート、旧client fetch、住所検索状態、場所ページ専用geocode/rate-limit分岐、移行後に未使用となるtab/state/importは、新しい契約がGreenになった後に削除する。
- 削除候補は、実行時production consumerの参照調査と、削除後の負の検索で確認する。テスト・fixture・履歴資料だけの残存はproduction consumerとは区別する。
- 旧経路を残すfallback、compatibility redirect、隠れたfeature flag、未使用exportで保険をかけない。
- 削除は対象ごとの小さな作業単位にし、代替テスト、fresh test review、削除、focused GREEN、親所有のproduction verificationの順に行う。production reviewは独立taskにしない。

### Rationale

「新しいページを追加する」だけでは、旧ページ、旧loader、旧state、旧API分岐が残り、JavaScript削減とKISSの効果を失う。削除の安全性は、曖昧な最終掃除ではなく、候補ごとの参照境界と負の検索で検証できる。

### Alternatives considered

- **最後に一括で未使用コードを掃除する**: どのテスト・新実装に依存するかが曖昧になり、削除漏れと過剰削除を同時に招くため不採用。
- **旧経路をredirect/aliasで残す**: 憲章の後方互換を目的とした複雑化禁止と、今回のURL整理に反するため不採用。
- **lintやtree-shakingに任せる**: runtime route、CSS、状態分岐、外部API呼び出しの不要性を証明できないため不採用。

## Decision 9: ビルド成果物の更新単位を明示する

### Decision

- 場所データと町字GeoJSONの、`appConfig`（設定ファイルは`app-config.json`）で指定する各取得URIの変更は、実行中の自動再取得ではなく、次回の公開用ビルドで取り込む。
- ビルド生成物が存在しない、破損している、または必要なデータを含まない場合、ランタイムはCDNへフォールバックせず日本語のデータエラーを表示する。正常な公開は、必要な生成物を含むビルドの成功を前提とする。

### Rationale

取得元の変更を実行時へ持ち込まないことで、同じデプロイが参照する場所データを固定でき、障害時に古い・部分的なデータを混在させない。`origin`はデータ版ではなく利用者の一時的な表示順だけを変えるため、生成物の固定と両立する。

### Decision 10: UIの視覚基準は`origin/dev`から固定する

#### Decision

- UIの視覚基準は、実装開始時点の`origin/dev`の`7cbf0a5a57c66b0e8e114e28cc3871ab1f46fd15`を参照する。
- `PageHeader`、`Card`、`CategoryTabs`、`LocationCard`、`Button`、`SidebarLayout`の表示クラス、余白、文字組み、カード階層、操作領域を確認する。
- `CategoryTabs`は視覚的な参照だけに使い、場所ページでは`nav`、通常`Link`、`aria-current="page"`を正本とする。`role="tablist"`、`role="tab"`、ローカルactive stateは復活させない。
- `dev`の場所ページにあるカルーセルは対象外とする。データ提供元カードの内容とリンクは維持する。
- `dev`の現行カテゴリナビゲーションが使う横スクロールや最小幅固定は採用せず、カテゴリ項目の行だけを折り返す。ラベルは改行・省略しない。

#### Rationale

既存利用者の視覚的な学習コストを下げながら、URLナビゲーション、GPSのみの並べ替え、ビルド生成物、WCAG 2.2 AAを同時に維持できる。視覚基準と機能契約を分けることで、古いタブ状態や住所検索を誤って復活させない。

#### Alternatives considered

- **現在のfeature branchの表示をそのまま正本にする**: 実装途中の変更を基準にしてしまい、`dev`からの視覚的な退行を検出できないため不採用。
- **`CategoryTabs`をそのまま再利用する**: button、tab role、ローカル状態がURL正本の契約と衝突するため不採用。
- **新しいデザインシステムを導入する**: 既存表示との差分と実装量を増やすため不採用。

## Decision 11: レビュー指摘のUI・設定・町字順を既存契約へ戻す

### Decision

- 場所カテゴリナビゲーションは、ルートページの「よく利用される施設から選択」で使う`CategoryTabs`の視覚クラスを踏襲する。`tabs tabs-box`、`tab`、`text-base`、`px-4`、`text-base-content`、`ruby-text`、`gap-0`を基礎にし、場所ページ固有の通常`nav`・`Link`・`aria-current`・flex-wrap・focus-visible・44px操作領域を重ねる。
- 並べ替えCardのタイトルは操作を総称する「並べ替え」とし、GPSの操作名は「近い順に並べる」のまま維持する。
- GPS拒否などの利用者向けエラーは、他ページと同じDaisyUIの`alert alert-error alert-soft text-base-content!`と`role="alert"`を使い、表示テキスト「エラー」と具体的な説明を必ず含める。色だけでエラーを伝えない。
- `app-config.json`の欠落はビルドを非ゼロ終了させる。アプリのnpm lifecycle、Dockerfile、生成スクリプトはexampleをコピーせず、CI workflowが必要時だけ明示的にコピーする。
- 町字表示の地域グループは、表示用に整形した町字文字列の`localeCompare`昇順で並べ、同じ町字内は入力順を維持する。

### Rationale

既存のルートページと共有UIの視覚語彙を再利用すると、場所ページだけが別のデザインに見える差分を最小の変更で解消できる。エラーのタイトルと意味論を明示すれば、色覚に依存せず状態を理解できる。設定生成を運用側へ残すと、設定忘れが公開ビルドを通過するため、CIの一時準備と運用ビルドの責務を分離する。町字順はデータ取得順に依存せず、利用者が文字列順として予測できる表示にする。

## Evidence / official references

- Current route query serialization: `src/lib/transit/route-search-query.ts:25-33,68-75,112-124`
- Current location client data loading and nearby state: `src/app/locations/page.tsx:30-110,143-259`
- Current area grouping/distance utilities: `src/lib/location/location-list-state.ts:94-172`, `src/utils/clientGeoUtils.ts:20-140`
- Current client category tabs: `src/components/ui/CategoryTabs.tsx:1-81`
- Discussion navigation reference: `src/components/discussion/DiscussionManagementTabLayout.tsx:127-160`
- Location status-preserving loader: `src/utils/addressLoader.ts:143-163`
- Location resolver: `src/lib/location/location-detail-resolver.ts:122-176`
- `origin/dev` UI baseline commit: `7cbf0a5a57c66b0e8e114e28cc3871ab1f46fd15`
- `origin/dev` UI references: `src/app/locations/page.tsx`, `src/components/layouts/PageHeader.tsx`, `src/components/ui/Card.tsx`, `src/components/ui/CategoryTabs.tsx`, `src/components/features/LocationCard.tsx`, `src/components/ui/Button.tsx`, `src/components/ui/CarouselCard.tsx`, `src/components/layouts/SidebarLayout.tsx`
- Next.js 15 `generateStaticParams`: https://nextjs.org/docs/15/app/api-reference/functions/generate-static-params
- Next.js 15 route segment configuration: https://nextjs.org/docs/15/app/api-reference/file-conventions/route-segment-config
