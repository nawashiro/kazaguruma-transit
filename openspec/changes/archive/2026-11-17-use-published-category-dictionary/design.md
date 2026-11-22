# Design

## Context

ビルドは`scripts/generate-location-artifact.ts`で公開JSON-LD、OSMタグミラー、`keyLocations`、町字GeoJSONを取得し、`public/generated/location-data.json`を書き出す。ルートページ用の`sources.routeDestinations`は、`ROUTE_DESTINATION_GROUPS`に定義した13の表示グループへ`gif-poi`コードを割り当て、コードだけでは決まらないentryを目録の`group`で上書きして作っている。

公開データセットは`category-names.jsonld`を配布している。これは`schema:DefinedTermSet`で、`schema:hasDefinedTerm`の各termが`#0702`のような4桁コードの`@id`と日本語の`schema:name`を持つ。施設の`gif-poi`コードは公開JSON-LDの`schema:identifier`にあり、名前辞書とコードで結合できる。

初期掲載22件のコードは1302、1304、1307、1403、1499、1512で、OSM名を解決できる21件が6カテゴリになる。現行のグループ定義は複数コードをまとめ、1499の施設を目録の`group`で「障害者支援」「高齢者支援」「子育て」へ振り分けている。

## Goals / Non-Goals

**Goals:**

- 表示カテゴリのコードと名前を公開カテゴリ名辞書だけから決める。
- コードの統合と目録による上書きをなくす。
- 辞書の欠落や形式不正をビルド失敗として扱い、旧定義へフォールバックしない。

**Non-Goals:**

- 公開データセットの語彙やラベルの変更。
- 英語ラベルの追加。辞書は日本語名だけを持つ。
- `/locations`ページと`keyLocations`のカテゴリの変更。
- 表示順やカテゴリの見やすさのための並べ替え。

## Decisions

### カテゴリ名辞書を5つ目の取得元にする

`app-config.json`へ`categoryNamesUri`を追加し、`https://nawashiro.github.io/chiyoda_city_main_facilities/category-names.jsonld`を設定する。ビルドは他の取得元と同じ`Promise.all`で辞書を取得し、artifactの`sourceUris`にも`categoryNamesUri`を残す。

検証は、ルートの`@type`が`schema:DefinedTermSet`であること、`schema:hasDefinedTerm`が空でない配列であること、各termの`@id`のfragmentが4桁コードであること、`schema:name`が空でない文字列であること、コードが重複しないことを確かめる。コードは`@id`から取り、配列の位置や名前から推測しない。

`data/categories.json`を追加で取得する案は採らない。施設とコードの対応は公開JSON-LDの`schema:identifier`にあり、辞書は名前の解決だけに必要である。辞書をリポジトリへ複製する案も採らない。複製はデータセットの更新に追従せず、同じ語彙を二重に管理することになる。

### コード単位のカテゴリを辞書順で出力する

`buildRouteDestinations`は掲載entryのコードを辞書で引き、コードごとに`RouteDestinationCategory`を1つ作る。出力順は辞書の`schema:hasDefinedTerm`の順とし、掲載entryのないコードは出力しない。複数コードをまとめる処理は持たない。

`RouteDestinationCategory`の識別子は`gif-poi`コードとし、フィールド名を`categoryId`にする。現在の`category:en`はハードコードしたグループの英語スラッグを受けるためのもので、辞書には対応する値がない。コードを`category:en`へ入れるとフィールド名が実態と合わないため、名前を変える。`category`は辞書の日本語名をそのまま使う。

### 目録のgroupとグループ定義を削除する

`ROUTE_DESTINATION_GROUPS`、`GROUP_BY_CODE`、`GROUP_BY_ID`、`RouteDestinationGroup`を削除する。`DestinationCatalogEntry.group`と検証、`scripts/update-destinations.ts`の`group`引き継ぎも削除し、`data/destinations.json`から`group`を消す。

辞書にないコード、辞書の取得失敗、辞書の形式不正はビルド全体を失敗させる。表示名を解決できないentryだけをスキップする現在の扱いとは分け、カテゴリの欠落はデータ契約の破れとして扱う。ハードコードしたグループへ戻すフォールバックは持たない。

### artifactの検証とルートページをcategoryIdへ合わせる

`src/lib/location/location-artifact.ts`の`RouteDestinationCategory`検証と`src/app/page.tsx`の`isRouteDestinations`を`categoryId`へ変える。`LocationSuggestions`の`key`も`category.category`から`category.categoryId`へ変え、同名カテゴリが増えても衝突しないようにする。

## Risks / Trade-offs

- [表示カテゴリが変わる] → 独自の「障害者支援」「高齢者支援」「子育て」はなくなり、該当施設は「その他の社会福祉施設」「公民館」など辞書の名前で表示される。利用者の目的別のまとめは失われるが、辞書を正とする今回の意図どおりであり、分類の改善はデータセット側で行う。
- [辞書のラベルが行政用語である] → 「役場支所及び出張所」のような名前をそのまま表示する。サイト側で別名を持たない。読みにくさが問題になったら、データセットの語彙を直す。
- [辞書のURLが版固定でない] → 公開データセットの語彙からコードが消えるとビルドが失敗する。失敗を握りつぶさず、目録の掲載選択かデータセットの語彙を直す。
- [categoryIdへの変更で古いartifactを読めない] → ビルドでartifactを再生成する。実行時に旧形式へフォールバックしない。
- [辞書の取得がビルドの新たな単一障害点になる] → 公開JSON-LDと同じPages配信であり、取得失敗は既存のデータ取得失敗と同じ扱いにする。

## Migration Plan

1. `app-config.json`と`app-config.json.example`へ`categoryNamesUri`を追加する。
2. ビルドへ辞書の取得・検証を追加し、`routeDestinations`をコード単位のカテゴリへ切り替える。グループ定義と`group`上書きを削除する。
3. 目録の型・検証・更新CLIから`group`を削除し、`data/destinations.json`を更新する。
4. 型、artifact検証、ルートページ、`LocationSuggestions`を`categoryId`へ切り替える。
5. テストを更新し、artifactを再生成して`npm run build`、型検査、lintを通す。
6. ロールバックは、ビルド、設定、型、目録を旧定義へ戻してartifactを再生成する。`group`の値はgitの履歴から復元できる。
