# UI Contract: 場所データページ

**Source**: [spec.md](../spec.md)
**Plan**: [plan.md](../plan.md)

## 1. Route contract

| URL | Meaning | Success | Failure |
|---|---|---|---|
| `/locations` | 場所カテゴリ入口 | 先頭カテゴリURLへ解決 | データ0件・取得失敗はデータエラー |
| `/locations/[category-id]` | 1カテゴリ | カテゴリ一覧を表示 | 未知/空/不正IDは通常404 |
| `/locations/[category-id]?origin=<lat>,<lng>` | 同カテゴリの距離順 | `origin`検証後に距離順 | 解釈不能originはエラー＋町字一覧 |
| `/locations/location-detail/[id]` | 場所詳細 | 一意IDの詳細 | 未知/不正IDは通常404、データ破損はデータエラー |

`[category-id]`は`category:en`をURLエンコードした値であり、別slugを作らない。`origin`の値は緯度、経度の順とする。千代田区外の数値座標は受け入れる。

## 2. Standard 404 contract

- 存在しないカテゴリ、空/不正なカテゴリ識別子、存在しない場所ID、URL識別子として不正な場所IDは通常の404を返す。
- カテゴリ・場所詳細専用の404ページ、404からのfeature固有戻りリンク、旧URL互換リダイレクトは追加しない。
- CDN取得失敗、JSON不正、必須フィールド不足、重複IDは404ではなく、URLが存在するデータエラーとして扱う。

## 3. Category navigation

- 共通レイアウトの`nav`として提供する。
- 通常の同一サイト内リンクを使い、現在ページは`aria-current="page"`で示す。
- 視覚的にtabs-boxを使っても、ページ移動をapplication tab stateに閉じ込めない。
- 現在のカテゴリURLに有効な`origin`がある場合、カテゴリから別カテゴリへのリンクは同じ`origin`を保持する。
- `/locations`入口、町字リセット、詳細リンク、その他ページリンクには不要な`origin`を付けない。

## 4. Sort controls

カテゴリナビゲーションの直下に2つの操作を置く。

### 町字で並べる

- 現在カテゴリのpathへ、queryなしで移動する。
- `origin`を削除し、既定の町字グループ表示に戻す。
- 町字モードを選択中として伝える。

### 近い順に並べる

- 利用者の明示クリックでのみブラウザGPSを要求する。
- 成功時は現在カテゴリpathへ`origin=<latitude>,<longitude>`を付けてGET表示を更新する。
- 失敗時、既存originがなければ町字一覧を維持して日本語エラーを表示する。
- 失敗時、既存originがあれば距離順一覧とoriginを維持して日本語エラーを表示する。
- 場所名・住所入力、Google Maps/geocoding API、住所検索専用rate limitを提供しない。

## 5. Home data contract

- ホームの「よく利用される施設」データはブラウザからCDN取得しない。
- 既存の目的地選択callbackへデータを渡す。
- 経路検索の`destination` query、`/routes` query順序、検索結果契約を変更しない。

## 6. Detail data contract

- カテゴリページの場所は`/locations/location-detail/[id]`への通常リンク。
- 詳細の目的地リンクは既存形式を維持するが、`origin`を含めない。
- 詳細からカテゴリへ戻るリンクも`origin`を含めない。
- 任意表示項目が欠けても場所名、主要操作、戻り導線を失わない。

## 7. Accessibility contract

- 共通レイアウトはページの単一`main`を所有する。
- カテゴリナビ、並べ替え操作、詳細リンクはキーボード操作可能で、現在状態を支援技術へ伝える。
- GPSのloading、permission denied、timeout、invalid originは日本語のstatus/errorとして通知する。
- 404は通常のアプリ共通404契約に従い、場所feature固有の重複案内を追加しない。
