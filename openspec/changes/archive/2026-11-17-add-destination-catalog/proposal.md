# Proposal

## Why

公開JSON-LDへの移行で、ルートページが参照していたv2.1.1の`main_facilities.json`は更新されない。ルートページの目的地一覧は、公開JSON-LDの`urn:uuid:`を参照する共有目録としてこちらで持ち、経路検索で到達できる徒歩圏の候補だけを明示的に選ぶ必要がある。

## What Changes

- `data/destinations.json`を追加する。公開JSON-LDの`urn:uuid:`、人間用の任意コメントとしての名前、`includeInRouteForm`を持つ。
- 目録を更新するCLIを追加する。公開JSON-LDからIDを取得し、経路検索と同じ徒歩距離判定（500m）で候補を絞る。名前はOSMタグミラーから取り、OSM名がない既存entryは目録の名前を残す。既存の`includeInRouteForm`はIDで引き継ぐ。
- ビルドで公開JSON-LDとOSMタグミラーを取得し、`includeInRouteForm: true`のIDだけを座標、`gif-poi`コード、OSMの`name`へ結合して、ルートページ用のartifactを作る。OSM名を解決できない掲載entryはartifactへ出さず、残りのentryで出力する。
- ルートページの表示名はOSMタグミラーから解決する。目録の名前は表示に使わない。
- ルートページは`mainFacilities`ではなく、このartifactを使う。
- `mainFacilitiesUri`と`main_facilities.json`の取得を削除する。
- 初期値は、旧ルートページに対応する22件を`includeInRouteForm: true`にする。OSM関連付けのない「子育てひろば「あい・ぽーと」麹町」は掲載のまま残し、ビルドでスキップする。表示されるのは21件になる。
- **BREAKING**: ルートページの目的地一覧が旧62件から新しい22件掲載（21件表示、以後、個別に追加）へ変わる。病院・学校・リサイクルは一覧から外れ、名前検索で選ぶ。
- 場所検索ページでの`destinations.json`利用は別changeとする。

## Capabilities

### New Capabilities
- `destination-catalog`: 公開JSON-LDのIDを参照する共有目的地目録、徒歩圏による候補抽出、ルートページへの明示的な掲載選択、ビルド時の座標・分類・OSM表示名の解決、OSM名がない掲載entryのスキップ。

### Modified Capabilities

なし。`route-search-form`のUI要件は変えない。`stop-candidate-selection`の判定は共通化するが、要求は変えない。

## Impact

- 新規: `data/destinations.json`、目録更新CLI、`src/lib/transit/stop-selection.ts`。
- 変更: `scripts/generate-location-artifact.ts`、`src/lib/location/location-artifact.ts`、`src/app/page.tsx`、関連する型とテスト、`app-config.json`と`app-config.json.example`、`src/lib/license/openDataLicenses.json`。
- 削除: `mainFacilitiesUri`、`main_facilities.json`の取得、`locationsDataVersion`、未使用の住所データローダー。
- 追加設定: `placesJsonLdUri`と`osmMirrorUri`。
- 変更しない: `keyLocationsUri`と`/locations`ページ。
