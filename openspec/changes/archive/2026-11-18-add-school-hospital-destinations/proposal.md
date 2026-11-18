# Proposal

## Why

公開JSON-LDに小学校8校と病院6施設が追加されたが、ルートページの目録は前回の更新時のままで、これらの施設を候補に持たない。利用者は名前検索を使わないと小学校や病院を目的地に選べない。

## What Changes

- `data/destinations.json`を公開JSON-LDとOSMタグミラーから再生成し、新規候補15件（小学校8、病院6、映画館1）を`includeInRouteForm: false`で追加する。
- 小学校8件と病院6件の`includeInRouteForm`を`true`にする。映画館（CINEMALICE）は`false`のままにする。
- ビルドは`gif-poi`コード1503を辞書名「小学校」、1601を「病院」としてカテゴリ化し、ルートページの「よく利用される施設から選択」に追加する。カテゴリは辞書順に並ぶため、小学校は「その他の社会福祉施設」と「図書館」の間、病院は「図書館」の後ろへ入る。
- 掲載は22件から36件、実際の表示は21件から35件、カテゴリは6から8になる。既存22件の名前と掲載選択は変えない。
- 仕様は変更しない。`destination-catalog`は掲載選択をデータで行い、新しい候補を既定で掲載しない契約を既に定めている。今回変わるのは目録の選択内容だけである。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

なし。要件レベルの振る舞いは変わらないため、`.openspec.yaml`の`skip_specs: true`で仕様の差分を作らない。

## Impact

- 変更: `data/destinations.json`。
- 生成: `public/generated/location-data.json`（ビルド生成物、追跡外）。
- 変更しない: アプリケーションコード、`/locations`ページの`keyLocations`、API。
- 依存: 公開JSON-LD、OSMタグミラー、カテゴリ名辞書（既存の取得先）。
- 運用: 次に公開データへ施設が追加されたときも、目録の再生成と掲載選択が必要になる。
