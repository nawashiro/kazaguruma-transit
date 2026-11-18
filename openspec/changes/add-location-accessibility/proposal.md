# Proposal

## Why

「場所をさがす」は更新停止した`key_locations.json`（v2.1.1）を参照しており、場所の同一性がOSM要素に結び付いていない。そのためバリアフリー情報を参照できず、`#154`でルートページだけが移行した新スキーマから取り残されている。

## What Changes

- 「場所をさがす」のデータ源を`key_locations.json`から公開JSON-LD、OSMタグミラー、カテゴリ名辞書へ移す。場所の同一性は`urn:uuid:`、名前はOSMタグの`name`、カテゴリは`gif-poi`コードと辞書の名前で決める。
- ビルドartifactへ、公開JSON-LDの全recordを`gif-poi`コードごとにまとめた場所一覧を追加する。OSM名を解決できないrecordは一覧へ出さない。地域は町字GeoJSONから全recordについて導出する。
- 場所詳細にバリアフリー情報を追加する。OSMタグミラーの`wheelchair`を`yes`・`limited`・`no`の3状態に写像し、OSMの定義に沿った説明文と更新導線を表示する。更新導線は、nodeを`https://wheelmap.org/nodes/{id}`、wayを`https://wheelmap.org/nodes/-{id}`、relationを`https://www.openstreetmap.org/relation/{id}`へ向ける。タグがない場所は「情報なし」として区別し、追加を促す。
- 場所一覧のカードには、状態が分かっている場所だけバッジを表示する。色だけで状態を伝えず、アイコンとテキストを併用する。
- 場所詳細の画像に`schema:image`、関連リンクに`schema:subjectOf`（東京バリアフリーマップ、言葉の道案内）を使う。画像には作者とライセンスを`figcaption`で添える。
- `keyLocationsUri`、`keyLocations`の検証・型・取得・テストを削除する。旧カテゴリURLと旧場所IDのURLは残さない。
- **BREAKING**: 「場所をさがす」の掲載が169件から102件へ減る。保育所（24→1）、幼稚園（8→0）、劇場（14→0）は公開JSON-LDにコードがないため一覧から消える。説明文43件も表示できなくなる。カテゴリは16から21へ変わり、URLは`/locations/{gif-poiコード}`と`/locations/location-detail/{urn:uuid}`になる。

## Capabilities

### New Capabilities

- `location-catalog`: 公開JSON-LDのrecordを場所として扱い、OSM名・カテゴリ名・地域・画像・関連リンクをビルド時に解決して一覧と詳細を提供する。
- `wheelchair-accessibility`: OSMの`wheelchair`タグを3状態へ写像し、説明文とWheelMapまたはOpenStreetMapへの更新導線を場所詳細と一覧に表示する。

### Modified Capabilities

なし。ルートページの目的地目録とカテゴリ表示は変えない。

## Impact

- 変更: `src/lib/location/location-artifact.ts`、`src/lib/location/location-page-data.ts`、`src/lib/location/location-detail-resolver.ts`、`src/utils/addressLoader.ts`、`src/app/locations/**`、`scripts/generate-location-artifact.ts`、`app-config.json`、`app-config.json.example`、関連するテストと文書、`src/lib/license/openDataLicenses.json`。
- 削除: `keyLocationsUri`、artifactの`sources.keyLocations`、`keyLocations`の取得と検証、旧カテゴリ型。
- 依存: 公開JSON-LD、OSMタグミラー、カテゴリ名辞書、町字GeoJSON（すべて既存の取得先）。WheelMapはリンク先としてのみ参照し、実行時に取得しない。
- 範囲外: 検索結果へのバリアフリー表示（#152）、歩行空間ネットワーク、Nostrによるウィキ、公開データセット側の施設拡充、ルートページの目的地一覧。
