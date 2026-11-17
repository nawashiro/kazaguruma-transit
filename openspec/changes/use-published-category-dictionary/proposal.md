# Proposal

## Why

ルートページの施設カテゴリは、`scripts/generate-location-artifact.ts`の`ROUTE_DESTINATION_GROUPS`にハードコードされ、`gif-poi`コードの統合と目録の`group`上書きで表示を調整している。公開データセットは、GIF POIコード表から採用したカテゴリ名辞書`category-names.jsonld`を公開している。辞書を使えば、カテゴリ名の変更やコードの追加をビルド側の修正なしに反映でき、コードの統合と上書きをなくせる。

## What Changes

- ビルド設定へ`categoryNamesUri`を追加し、ビルドは公開カテゴリ名辞書を取得する。
- ルートページのカテゴリは、掲載entryの`gif-poi`コードごとに辞書の日本語名で1つずつ出力する。辞書の順に並べ、掲載entryのないカテゴリは出力しない。
- artifactのカテゴリ識別子を、ハードコードした英語スラッグから`gif-poi`コード（`categoryId`）へ変える。
- `ROUTE_DESTINATION_GROUPS`とコードからグループを引く処理、目録entryの`group`とその上書きを削除する。`gif-poi`コードが辞書にない場合はビルドを失敗させる。
- **BREAKING**: ルートページの表示カテゴリが13の独自グループから、辞書のコード単位（初期掲載では6カテゴリ）へ変わる。障害者支援・高齢者支援・子育てなどの独自のまとめはなくなり、該当施設は「その他の社会福祉施設」など辞書の名前で表示される。
- 辞書の取得失敗、形式不正、コード欠落はビルド失敗とする。旧グループ定義や目録の`group`へフォールバックしない。
- `docs/how-to/update-destinations.md`のグループ説明を、辞書の利用へ更新する。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `destination-catalog`: 「gif-poiコードによる表示グループ」を、公開カテゴリ名辞書による表示カテゴリへ置き換える。ビルド時の分類解決に辞書の取得と検証を加える。

## Impact

- 変更: `scripts/generate-location-artifact.ts`、`data/destinations.json`、`scripts/update-destinations.ts`、`src/lib/location/destination-catalog.ts`、`src/lib/location/location-artifact.ts`、`src/app/page.tsx`、`src/types/route-destinations.ts`、`app-config.json`、`app-config.json.example`、関連するテスト、`docs/how-to/update-destinations.md`。
- 依存: 公開データセットのカテゴリ名辞書`https://nawashiro.github.io/chiyoda_city_main_facilities/category-names.jsonld`。
- 変更しない: `/locations`ページと`keyLocations`のカテゴリ。
