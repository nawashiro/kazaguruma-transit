# Design

## Context

`scripts/generate-location-artifact.ts`は公開JSON-LD、OSMタグミラー、町字GeoJSON、カテゴリ名辞書、Wikidataミラー、`data/destinations.json`を読み、`public/generated/location-data.json`を書き出す。`sources.locations`は`buildLocations`が公開JSON-LDの全recordから作り、`sources.routeDestinations`は目録の`includeInRouteForm`が`true`のentryから作る。

現時点のartifactは`sources.locations`が101件・19カテゴリ、`routeDestinations`が35件。目録は85件で、内訳は一覧と目録の共通が83件、目録だけが2件（`東京都産業労働局労働相談情報センター`と`子育てひろば「あい・ぽーと」麹町`、いずれもOSM名が空）、一覧だけが18件（美術館・博物館など）。目録は経路検索の停留所と同じ碁盤目補正後の徒歩距離500mで`update-destinations` CLIが更新し、候補から外れたentryは報告して除く。

`loadLocationPageData`はartifactだけを読み、ページはartifactの`locations`をそのまま表示する。詳細はartifactのIDで解決する。

## Goals / Non-Goals

**Goals:**

- 一覧と詳細の母集団を、目録の候補と同じ集合にする。
- 母集団の判定をビルドの1か所に閉じ、ページ側で件数や距離を再計算しない。
- artifact検証、静的パラメータ、地域導出を新しい母集団と整合させる。

**Non-Goals:**

- 目録の500m判定、目録更新CLI、`includeInRouteForm`の扱いを変える。
- 目録にだけある2件の表示名を目録のコメントから補う。
- データ提供元カードやページ説明の文言を変える。
- 削除される詳細URLからのリダイレクトを作る。

## Decisions

### 母集団はビルドで目録のID集合に絞る

`buildArtifact`が受け取る`catalog`のID集合を`buildLocations`へ渡し、集合にないrecordを`continue`で落とす。`routeDestinations`の構築と同じ`catalog`を使うため、2つの射影が同じID参照から作られる。

ページ側で表示件数を絞る案は採らない。artifactに18件が残り、静的パラメータと詳細解決がそのIDをまだ受け付けるため、一覧と詳細で見える集合がずれる。

### 距離を再計算せず、目録のIDを信じる

ビルドは停留所を読まず、`calculateGridWalkingDistanceKm`を呼ばない。500m判定の正本は目録更新に置いたままにする。ビルドで距離を計算する案は、停留所DBの読み込みと判定式の二重実装を招き、経路検索・目録・場所一覧の3か所で判定がずれる。

### 目録にだけある2件は表示しない

表示名はOSMタグミラーの`name`だけから決める。目録の`name`は人間用のコメントであり、表示名に使うと名前の出所が2つになる。この結果、一覧は85件ではなく83件になる。目録の85件と表示の83件の差は、OSM名がないrecordとして説明できる状態を保つ。

### 目録と公開JSON-LDの不整合ではビルドを止めない

目録にあり公開JSON-LDにないIDは、一覧の母集団から落とすだけでビルドは成功させる。`routeDestinations`が掲載IDの欠落で失敗する既存の検証は変えない。場所一覧は目録の射影であり、目録の検証は`validateDestinationCatalog`が担う。ここで失敗させると、目録更新の遅れだけで場所ページ全体のビルドが止まる。

## Risks / Trade-offs

- [目録更新の遅れで、公開JSON-LDに増えた施設が一覧に出ない] → `docs/how-to/update-location-data.md`に、場所一覧が目録の更新結果に従うことを明記し、データ更新手順に目録更新を含める。
- [18件の詳細URLが404になり、既存のリンクやブックマークが切れる] → 掲載対象を絞る変更の意図した結果として受け入れる。リダイレクトは作らない。
- [カテゴリ数と件数を固定しているテストが広範囲に落ちる] → fixtureとartifactを小さく作り直し、件数は母集団の差で説明できる最小のケースにする。
- [目録にだけある2件が「消えた」と見える] → 変更の説明に、OSM名がないため表示できない2件として明記する。
