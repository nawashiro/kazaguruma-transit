# Proposal

## Why

上流の千代田区施設データが公開形式を変えた。`places.jsonld` と `category-names.jsonld` は404になり、`dataset.jsonld` の自己完結グラフへ移行している。現行のビルドは最初の取得で停止し、カテゴリの取得元と画像作者の扱いも上流とずれている。月次更新に追随し続けるため、公開グラフを読む形へ切り替える。

## What Changes

- **BREAKING** 取得元の設定を `placesJsonLdUri` から `datasetJsonLdUri` へ改名し、`categoryNamesUri` を削除する。旧URLへのフォールバックは持たない。
- Place を `@type` の `schema:Place` で抽出する。同じ `@graph` の `DefinedTerm` と `NodeShape` を場所として扱わない。
- カテゴリを `schema:keywords` が参照する `schema:DefinedTerm` から解決する。表示名は term の `schema:name`、URLと識別子は term の `gif-poi` コードを使う。カテゴリの順序は `schema:DefinedTermSet` の `schema:hasDefinedTerm` に従う。
- 複数カテゴリの場所を参照された各カテゴリの一覧へ掲載する。同じIDの場所は内容も同一であることを要求し、内容が異なる重複はビルドと詳細解決でエラーにする。
- カテゴリを持たない場所を一覧と経路フォームから除外し、ビルドは警告を出して続行する。
- **BREAKING** 画像の作者を任意にする。作者がない画像は「作者不明」と明示してライセンスとともに表示する。作者もライセンスもない画像は表示しない。
- `sh:NodeShape` のうち、アプリが読む `schema:geo`、`schema:image`、`schema:keywords`、`rdfs:seeAlso` と `DefinedTerm` の `schema:identifier` が宣言されているかをビルドで確認する。形状によるインスタンス検証は行わない。
- 場所詳細は複数カテゴリのとき全カテゴリへリンクし、パンくずは語彙順の先頭カテゴリを使う。静的生成のパラメータはIDで重複排除する。
- 目的地目録の `source` と更新処理を新しい取得元へ揃える。
- 取得元、カテゴリ、複数カテゴリ、画像、重複IDの仕様と、件数の案内を更新する。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `location-catalog`: カテゴリを `schema:keywords` の `DefinedTerm` から解決し、0件と複数件を扱う。詳細の全カテゴリ表示、作者不明画像、重複IDの同一性、公開グラフの形状確認を規定する。
- `destination-catalog`: 経路フォームのカテゴリ解決を公開グラフの term へ変え、複数カテゴリの掲載と0件の除外を規定する。
- `location-ui`: 一覧カードの写真帰属で、作者がない画像を「作者不明」として表示する。

## Impact

- ビルド: `scripts/generate-location-artifact.ts`、`scripts/update-destinations.ts`
- artifact とページ: `src/lib/location/location-artifact.ts`、`destination-catalog.ts`、`location-page-data.ts`、`location-detail-resolver.ts`、`location-image.ts`
- 画面: 場所詳細ページ、場所一覧カード
- 設定とデータ: `app-config.json.example`、各環境の `app-config.json`、`data/destinations.json`
- テスト: 生成、artifact、目録、詳細解決、ページ表示の各テスト
- 文書: `docs/how-to/update-location-data.md`、`docs/how-to/update-destinations.md`
- 依存関係の追加なし
