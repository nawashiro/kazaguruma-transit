# Data Model: 場所データページのJavaScript削減

**Source**: [spec.md](./spec.md)
**Research**: [research.md](./research.md)

本featureは新規永続データを追加しない。以下は、ビルド時データ生成物、生成物を使うページ表示、URL query、最小client interaction、データエラーを表す論理モデルである。

## 1. Location Source Result

場所データ提供元からビルド工程で取得・検証した状態を、空配列と取得失敗で混同しないための境界。実行時はこの境界の成功データを含むビルド生成物だけを読む。

| Field | Type | Required | Rules |
|---|---|---:|---|
| `status` | `success \\| error` | yes | ビルド時のtransport、HTTP、JSON decode、必須フィールド検証を区別する。 |
| `categories` | `KeyLocationCategory[]` | success only | カテゴリ識別子、場所ID、必須フィールドを検証済みとする。 |
| `error` | `Error` | error only | 利用者向け文言とは分離し、ログ・データエラー状態へ変換する。 |

Rules:

- `main_facilities.json`はホームのよく利用される施設用、`key_locations.json`はカテゴリ・詳細用、町字GeoJSONは座標から地域を導出するために使う。
- `appConfig`（設定ファイルは`app-config.json`）に設定した`mainFacilitiesUri`、`keyLocationsUri`、`townGeoJsonUri`の完全な取得URIを各データソースの正本として利用する。版指定が必要な場合はURIに含め、データソース用の別バージョン項目は持たない。
- 空配列を取得成功として返さない。
- カテゴリIDは`category:en`、表示ラベルは`category`と分離する。
- 場所IDはデータセット全体で一意でなければならない。
- 必要なデータの取得・検証に失敗した場合はビルドを失敗させ、空・不完全・古い生成物を成功状態として残さない。

### Q21 wire schema validation policy

| Field class | Wire schema | Build/artifact read |
|---|---|---|
| optional field/property | 欠落または明示的な`null` | 欠落相当として許容し、明示的な`null`をsanitize・除去せずartifactへ保持する。 |
| optional field/propertyの非null値 | 値あり | `wrong type`、`invalid URI`、非有限数値はビルド失敗と読み取り失敗にする。 |
| required field | 欠落または明示的な`null` | ビルド失敗と読み取り失敗にする。非nullでも`wrong type`、`invalid URI`、非有限数値なら同じ扱いとする。 |

この方針は`main_facilities.json`、`key_locations.json`、町字GeoJSONのwire schemaと、ビルド生成物のartifact readに共通して適用する。

## 2. Build Artifact Boundary

ビルド成功後の場所ページが参照する固定データの論理境界。

| Field | Type | Required | Rules |
|---|---|---:|---|
| `sources` | `main_facilities + key_locations + town_geojson` | yes | `appConfig`（`app-config.json`）に設定した各データソースの完全な取得URIからビルド工程で取得・検証し、生成物へ含める。 |
| `sourceUris` | `{ mainFacilitiesUri: string; keyLocationsUri: string; townGeoJsonUri: string }` | yes | 各URIは絶対URIとして検証し、版指定が必要な場合はURIに含める。更新は再ビルドで反映する。 |
| `derivedRegions` | location ID keyed display-region values | yes | 場所座標とGeoJSONからビルド時に導出し、表示用地域名の規則を適用する。 |
| `status` | `validated \\| invalid` | yes | `validated`だけを公開用生成物として出力する。`invalid`はビルド失敗へ投影する。 |

Rules:

- ビルド生成物の内部ファイル形式・配置は実装で決めるが、カテゴリ・詳細・ホームのランタイム入口はこの生成物だけをデータ正本とする。
- 実行時にCDN、GeoJSONデータ提供元、旧データ源へ再取得・フォールバックしてはならない。
- 生成物が実行時に欠落・破損している場合は、日本語のデータエラーを表示し、外部取得で補ってはならない。正常なデプロイは、必要な生成物を含むビルド成功を前提とする。
- `origin`による距離計算・表示切替は、生成物を入力として実行時に行ってよい。

## 3. Category Identifier and Page Request

| Field | Type | Required | Rules |
|---|---|---:|---|
| `categoryId` | string | route required | `category:en`のURLエンコード値。未知・空・URL識別子として不正なら通常404。 |
| `origin` | string or absent | query optional | `latitude,longitude`の順。値が数値として解釈できる場合は千代田区外でも受け入れる。 |
| `originState` | `absent \| valid \| invalid` | derived | invalidは日本語エラー＋町字一覧。invalidはカテゴリ間リンクへ伝播しない。 |
| `sortMode` | `town \| distance \| invalid-origin` | derived | absent/invalidは町字、validは距離順。UI表示モードと一致する。 |

`origin`はURLの一時状態であり、sessionStorage/localStorageには保存しない。カテゴリ間リンクのみ有効な値を保持し、詳細・その他リンクでは除去する。

## 4. Location Category Page State

```text
build
  ├─ source-error → build failure; no deployable artifact
runtime
  ├─ artifact-error → Japanese data error state; no external fallback
  ├─ category-not-found → standard 404
  ├─ invalid-origin → Japanese origin error + town-grouped list
  ├─ town → area-grouped category list
  └─ distance → origin-based distance-sorted category list
```

### Town mode

- `origin`なし、またはinvalid originで表示する既定モード。
- ビルド生成物に含まれるGeoJSON由来の地域を使い、導出不能な場所は「その他」へ入れる。
- 「町字で並べる」は現在カテゴリのqueryなしURLへ移動する。

### Distance mode

- 有効な`origin`からカテゴリ内の全場所の距離を計算する。
- 既存の`calculateDistance`と`sortLocationsByDistance`の意味を再利用する。
- 同距離は入力データの順序を維持する。
- GPS再取得失敗時は既存の有効なoriginと距離順一覧を維持し、エラーを表示する。

## 5. Location Category Navigation

| Field | Type | Rules |
|---|---|---|
| `label` | string | データの表示カテゴリ名。 |
| `href` | string | `/locations/<encoded category:en>`。有効なoriginがあるカテゴリページからは`?origin=...`を保持。 |
| `isCurrent` | boolean | pathnameのカテゴリ識別子と一致する場合true。 |
| `ariaCurrent` | `page \| undefined` | 現在ページのみ`page`。 |

ナビゲーションは場所データ取得を行わない。`origin`を読み取るclient境界が必要な場合も、ナビリンク生成とactive stateだけを担当する。

## 6. Location Sort Controls

| Control | Effect | URL |
|---|---|---|
| `町字で並べる` | 既定の町字グループへ戻す | 現在カテゴリpathのみ、`origin`なし |
| `近い順に並べる` | 明示クリック後にGPS取得し、距離順へ移行 | 成功時に現在カテゴリpath + `origin=<lat>,<lng>` |

両方の操作は表示中モードをアクセシブルに伝える。GPS要求はページ表示時に自動開始しない。

## 7. Location Detail Page State

| State | Meaning | Response |
|---|---|---|
| `success` | IDが一意に解決 | 詳細本文、目的地リンク、カテゴリ戻りリンク |
| `not-found` | URL IDが存在しない | 通常の404 |
| `invalid-request-id` | URL IDが空・不正 | 通常の404 |
| `duplicate-id` | ビルド時にデータ内IDが重複 | 公開用ビルド失敗。ビルド後の生成物で検出した場合は日本語データエラー |
| `invalid-data` | ビルド時にJSON/必須フィールドが不正 | 公開用ビルド失敗。ビルド後の生成物で検出した場合は日本語データエラー |
| `data-load-error` | ビルド生成物の欠落・破損 | 日本語データエラー（外部フォールバックなし） |

詳細リンクと詳細ページのカテゴリ戻りリンクは`origin`を含めない。

## 8. Home Popular Location Data

- ビルド工程で`main_facilities.json`を取得・検証し、ホームはビルド生成物から読む。
- `LocationSuggestions`は取得処理を持たず、シリアライズ可能なカテゴリデータを受け取る。
- 既存の目的地選択callback、ホームの`destination` query、経路検索URL契約は変更しない。
- ビルド時のデータ取得エラーはビルド失敗とし、ビルド後の生成物欠落・破損は空のカテゴリを成功として扱わず、日本語状態へ変換する。

## 9. Ownership

| Responsibility | Owner |
|---|---|
| build-time source fetch/status/shape validation | build data-generation boundary |
| generated-artifact read and integrity status | runtime artifact reader |
| route category resolution and 404 | App Router server page |
| origin parsing and distance sort | pure location page utility/server page |
| GPS permission/request/error | small client sort control |
| category href/current state | shared category navigation |
| detail ID resolution | existing resolver boundary |
| presentation | route/page and small feature components |
