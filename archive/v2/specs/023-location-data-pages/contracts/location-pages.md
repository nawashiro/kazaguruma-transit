# UI Contract: 場所データページ

**Source**: [spec.md](../spec.md)
**Plan**: [plan.md](../plan.md)

## 1. Route contract

| URL | Meaning | Success | Failure |
|---|---|---|---|
| `/locations` | 場所カテゴリ入口 | 生成物の先頭カテゴリURLへ解決 | ビルド時のデータ0件・取得失敗はビルド失敗、ビルド後の生成物欠落・破損はデータエラー |
| `/locations/[category-id]` | 1カテゴリ | カテゴリ一覧を表示 | 未知/空/不正IDは通常404 |
| `/locations/[category-id]?origin=<lat>,<lng>` | 同カテゴリの距離順 | `origin`検証後に距離順 | 解釈不能originはエラー＋町字一覧 |
| `/locations/location-detail/[id]` | 場所詳細 | 一意IDの詳細 | 未知/不正IDは通常404、データ破損はデータエラー |

`[category-id]`は`category:en`をURLエンコードした値であり、別slugを作らない。`origin`の値は緯度、経度の順とする。千代田区外の数値座標は受け入れる。

### Build-time data boundary

- ホームの`main_facilities.json`、カテゴリ・詳細の`key_locations.json`、町字GeoJSONは、`appConfig`（設定ファイルは`app-config.json`）に設定した各データソースの完全な取得URIから公開用ビルド工程で取得・検証する。
- HTTP、JSON/GeoJSON形状、必須フィールド、空カテゴリ、重複ID、任意フィールドの`null`以外の型・形式などの取得・検証失敗は、空・不完全・古い生成物を公開せず、ビルドを失敗させる。
- wire schema上の任意field/propertyは、欠落または明示的な`null`を欠落相当として許容し、明示的な`null`はsanitize・除去せずartifactへ保持する。任意field/propertyの`null`以外の`wrong type`・`invalid URI`・非有限数値と、required fieldの欠落・明示的な`null`・非nullの不正値は、ビルド時の検証とビルド後のartifact readで失敗させる。
- ビルド成功後のホーム、カテゴリ、詳細ページは、検証済みビルド生成物だけをデータ正本として読む。実行時にCDN、GeoJSONデータ提供元、旧データ源へ再取得・フォールバックしない。
- `origin`による距離計算・表示切替は、ビルド生成物を入力として実行時に行ってよい。各データソースの取得URIの更新は次回ビルドで反映する。

## 2. Standard 404 contract

- 存在しないカテゴリ、空/不正なカテゴリ識別子、存在しない場所ID、URL識別子として不正な場所IDは通常の404を返す。
- カテゴリ・場所詳細専用の404ページ、404からのfeature固有戻りリンク、旧URL互換リダイレクトは追加しない。
- ビルド時のCDN取得失敗、JSON/GeoJSON不正、必須フィールド不足・明示的な`null`、任意フィールドの`null`以外の`wrong type`・`invalid URI`・非有限数値、重複IDは404ではなく公開用ビルド失敗として扱う。ビルド成功後の生成物欠落・破損は404ではなく日本語のデータエラーとして扱い、外部へフォールバックしない。

## 3. Category navigation

- 共通レイアウトの`nav[role="tablist"]`として提供する。
- URLを持つ同一サイト内`Link[role="tab"]`を使い、現在ページは`aria-selected="true"`と`aria-current="page"`で示し、対応するカテゴリ内容を`aria-controls`で参照する。非選択項目は`aria-selected="false"`かつ`tabIndex="-1"`とする。
- `/discussions`の`DiscussionManagementTabLayout`に合わせ、ArrowRight/ArrowLeft/Home/Endでタブ間のフォーカスを移動する。矢印キーではURLを変更せず、Enter/クリックで通常のURL遷移を行う。
- ルートページの「よく利用される施設から選択」と同じ`tabs tabs-box` / `tab text-base px-4 text-base-content ruby-text gap-0`の視覚クラスを使う。狭い画面ではリンク項目の行だけを`flex-wrap`し、ラベルの`whitespace-nowrap`、44px操作領域、可視フォーカスを維持する。現在項目は`tab-active`に加えてactive背景を明示し、DaisyUIの直接子セレクターに依存しない。
- 現在のカテゴリURLに有効な`origin`がある場合、カテゴリから別カテゴリへのリンクは同じ`origin`を保持する。
- `/locations`入口、町字リセット、詳細リンク、その他ページリンクには不要な`origin`を付けない。

## 4. Sort controls

カテゴリナビゲーションの直下に2つの操作を置く。

この操作領域を含むCardのタイトルは「並べ替え」とする。操作ラベルは「町字で並べる」「近い順に並べる」とする。

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

- ホームの「よく利用される施設」データはビルド生成物から読み、ブラウザおよび実行中サーバーからCDN取得しない。
- 既存の目的地選択callbackへデータを渡す。
- 経路検索の`destination` query、`/routes` query順序、検索結果契約を変更しない。

## 6. Detail data contract

- カテゴリページの場所は`/locations/location-detail/[id]`への通常リンク。
- 詳細の目的地リンクは既存形式を維持するが、`origin`を含めない。
- 詳細からカテゴリへ戻るリンクも`origin`を含めない。
- 任意表示項目の明示的な`null`は、表示上はwire schema上の欠落相当として扱い、artifactには明示的な`null`を保持する。
- 任意表示項目が欠けても場所名、主要操作、戻り導線を失わない。

## 7. Accessibility contract

- 共通レイアウトはページの単一`main`を所有する。
- カテゴリナビ、並べ替え操作、詳細リンクはキーボード操作可能で、現在状態を支援技術へ伝える。
- GPSのloading、permission denied、timeout、invalid origin、場所データの表示失敗は日本語のstatus/errorとして通知する。errorは`role="alert"`と`alert alert-error alert-soft text-base-content!`を持ち、視認可能な「エラー」タイトルと具体的な説明を含める。色だけを状態の根拠にしない。
- 404は通常のアプリ共通404契約に従い、場所feature固有の重複案内を追加しない。

## 8. `origin/dev` visual contract

- 視覚基準は`origin/dev`の`7cbf0a5a57c66b0e8e114e28cc3871ab1f46fd15`とする。
- `PageHeader`の唯一の`h1`と説明文、`Card`の`section.card`・`card-body`・`card-title`の階層、`LocationCard`の画像・本文・余白・ホバー表現、`Button`の44px以上の操作領域を基準にする。
- `CategoryTabs`は`tabs tabs-box`などの視覚クラスと、`tab`、`tab-active`、`aria-selected`、roving focusの意味論を参照する。場所ページでは`nav[role="tablist"]`・URLを持つ`Link[role="tab"]`・`aria-current="page"`・`aria-controls`を使い、`/discussions`のキーボード操作を踏襲する。
- 場所一覧は`dev`のカードグリッドを基準にし、町字表示は地域セクション、距離表示は`Nキロ離れています`の距離帯セクションへ分ける。
- `dev`の補助案内カルーセルは表示しない。データ提供元カードの見出し、説明、リンク、案内は維持する。
- カテゴリラベルは改行・省略せず、ナビゲーション項目の行だけを複数行へ折り返す。ナビゲーションとページ全体に横スクロールを設定しない。
- WCAG 2.2 AA、通常文字16px以上、可視フォーカス、通常リンクの意味は、`dev`の視覚表現より優先する。
- `app-config.json`がないビルドは非ゼロで失敗する。アプリのnpm lifecycle、Dockerfile、ビルドスクリプトは`app-config.json.example`から自動生成せず、CIが必要時に明示的にコピーする。
- 町字表示の地域セクションは、表示用町字文字列を`localeCompare`昇順に並べ、同一町字内の場所順は入力順を維持する。
