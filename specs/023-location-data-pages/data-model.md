# Data Model: 場所データページのJavaScript削減

**Source**: [spec.md](./spec.md)
**Research**: [research.md](./research.md)

本featureは新規永続データを追加しない。以下は、サーバー側のページ表示、URL query、最小client interaction、データエラーを表す論理モデルである。

## 1. Location Source Result

場所データ提供元から取得した状態を、空配列と取得失敗で混同しないための境界。

| Field | Type | Required | Rules |
|---|---|---:|---|
| `status` | `success \| error` | yes | transport、HTTP、JSON decode、必須フィールド検証を区別する。 |
| `categories` | `KeyLocationCategory[]` | success only | カテゴリ識別子、場所ID、必須フィールドを検証済みとする。 |
| `error` | `Error` | error only | 利用者向け文言とは分離し、ログ・データエラー状態へ変換する。 |

Rules:

- `main_facilities.json`はホームのよく利用される施設用、`key_locations.json`はカテゴリ・詳細用とする。
- データ版は既存`appConfig.locationsDataVersion`を利用する。
- 空配列を取得成功として返さない。
- カテゴリIDは`category:en`、表示ラベルは`category`と分離する。
- 場所IDはデータセット全体で一意でなければならない。

## 2. Category Identifier and Page Request

| Field | Type | Required | Rules |
|---|---|---:|---|
| `categoryId` | string | route required | `category:en`のURLエンコード値。未知・空・URL識別子として不正なら通常404。 |
| `origin` | string or absent | query optional | `latitude,longitude`の順。値が数値として解釈できる場合は千代田区外でも受け入れる。 |
| `originState` | `absent \| valid \| invalid` | derived | invalidは日本語エラー＋町字一覧。invalidはカテゴリ間リンクへ伝播しない。 |
| `sortMode` | `town \| distance \| invalid-origin` | derived | absent/invalidは町字、validは距離順。UI表示モードと一致する。 |

`origin`はURLの一時状態であり、sessionStorage/localStorageには保存しない。カテゴリ間リンクのみ有効な値を保持し、詳細・その他リンクでは除去する。

## 3. Location Category Page State

```text
loading
  ├─ source-error → Japanese data error state
  ├─ category-not-found → standard 404
  ├─ invalid-origin → Japanese origin error + town-grouped list
  ├─ town → area-grouped category list
  └─ distance → origin-based distance-sorted category list
```

### Town mode

- `origin`なし、またはinvalid originで表示する既定モード。
- GeoJSONから町字を導出し、導出不能な場所は「その他」へ入れる。
- 「町字で並べる」は現在カテゴリのqueryなしURLへ移動する。

### Distance mode

- 有効な`origin`からカテゴリ内の全場所の距離を計算する。
- 既存の`calculateDistance`と`sortLocationsByDistance`の意味を再利用する。
- 同距離は入力データの順序を維持する。
- GPS再取得失敗時は既存の有効なoriginと距離順一覧を維持し、エラーを表示する。

## 4. Location Category Navigation

| Field | Type | Rules |
|---|---|---|
| `label` | string | データの表示カテゴリ名。 |
| `href` | string | `/locations/<encoded category:en>`。有効なoriginがあるカテゴリページからは`?origin=...`を保持。 |
| `isCurrent` | boolean | pathnameのカテゴリ識別子と一致する場合true。 |
| `ariaCurrent` | `page \| undefined` | 現在ページのみ`page`。 |

ナビゲーションは場所データ取得を行わない。`origin`を読み取るclient境界が必要な場合も、ナビリンク生成とactive stateだけを担当する。

## 5. Location Sort Controls

| Control | Effect | URL |
|---|---|---|
| `町字で並べる` | 既定の町字グループへ戻す | 現在カテゴリpathのみ、`origin`なし |
| `近い順に並べる` | 明示クリック後にGPS取得し、距離順へ移行 | 成功時に現在カテゴリpath + `origin=<lat>,<lng>` |

両方の操作は表示中モードをアクセシブルに伝える。GPS要求はページ表示時に自動開始しない。

## 6. Location Detail Page State

| State | Meaning | Response |
|---|---|---|
| `success` | IDが一意に解決 | 詳細本文、目的地リンク、カテゴリ戻りリンク |
| `not-found` | URL IDが存在しない | 通常の404 |
| `invalid-request-id` | URL IDが空・不正 | 通常の404 |
| `duplicate-id` | データ内ID重複 | 日本語データエラー |
| `invalid-data` | JSON/必須フィールド不正 | 日本語データエラー |
| `data-load-error` | CDN/HTTP/decode失敗 | 日本語データエラー |

詳細リンクと詳細ページのカテゴリ戻りリンクは`origin`を含めない。

## 7. Home Popular Location Data

- サーバー側で`main_facilities.json`を取得・検証する。
- `LocationSuggestions`は取得処理を持たず、シリアライズ可能なカテゴリデータを受け取る。
- 既存の目的地選択callback、ホームの`destination` query、経路検索URL契約は変更しない。
- データ取得エラーは空のカテゴリを成功として扱わず、日本語状態へ変換する。

## 8. Ownership

| Responsibility | Owner |
|---|---|
| CDN fetch/status/shape validation | server data boundary |
| route category resolution and 404 | App Router server page |
| origin parsing and distance sort | pure location page utility/server page |
| GPS permission/request/error | small client sort control |
| category href/current state | shared category navigation |
| detail ID resolution | existing resolver boundary |
| presentation | route/page and small feature components |
