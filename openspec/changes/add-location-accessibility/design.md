# Design

## Context

ビルドは`scripts/generate-location-artifact.ts`で公開JSON-LD、OSMタグミラー、`key_locations.json`、町字GeoJSON、カテゴリ名辞書を取得し、`public/generated/location-data.json`へ書き出す。ルートページ用の`sources.routeDestinations`は目録の掲載IDから作り、`/locations`用の`sources.keyLocations`はv2.1.1の`key_locations.json`をそのまま検証して持つ。`derivedRegions`は`keyLocations`の座標から町字を導出している。

`/locations`のページは`loadLocationPageData`で`keyLocations`を読み、カテゴリページは`category:en`、詳細ページは`KeyLocation`の名前・説明・画像・ウェブサイト・ライセンスを表示する。ルートページは`routeDestinations`だけを読む。

公開JSON-LDは103件の`urn:uuid:` recordを持ち、`schema:geo`、`schema:identifier`の`gif-poi`、`rdfs:seeAlso`のOSM要素、`schema:image`、`schema:subjectOf`を持つ。名前と説明は持たない。OSMタグミラー（version `202611170100`）は102要素を持ち、25要素に`wheelchair`タグがある。内訳は`yes` 17、`limited` 5、`no` 3で、`wheelchair:description`は持たない。カテゴリ名辞書は21コードの日本語名を定義順に持つ。

## Goals / Non-Goals

**Goals:**

- `/locations`を、ルートページと同じ公開JSON-LD・OSMタグミラー・カテゴリ名辞書から作る。
- `wheelchair`タグをビルド時に3状態へ解決し、一覧と詳細で使う。
- `keyLocations`の取得・検証・型・テスト・設定を削除する。
- ルートページの目的地目録と表示は変えない。

**Non-Goals:**

- 検索結果へのバリアフリー表示（#152）。
- バリアフリー状態による絞り込み・並べ替え。
- 地図表示や経路のバリアフリー判定。
- 公開データセットへの説明文・施設の追加。
- 旧URLから新URLへのリダイレクト。

## Decisions

### `/locations`は目録ではなく公開JSON-LDの全recordを使う

`data/destinations.json`は経路検索で到達できる徒歩圏の候補と、ルートページへの掲載選択を持つ。場所検索は「行き先を探す」ための一覧であり、500m判定や掲載選択で候補を絞るべきではない。よって`/locations`は公開JSON-LDの全recordを母集団にする。

目録を使う案は、停留所から遠い施設と未掲載の施設が場所検索から消える。旧`/locations`も169件すべてを出しており、挙動を狭める理由がない。採用しない。

### artifactへ`gif-poi`コード単位の場所一覧を追加する

`sourceUris`に`keyLocationsUri`を残さず、`sources.locations`を追加する。形は`{ category, categoryId, locations: [...] }`の配列で、`categoryId`は4桁の`gif-poi`コード、`category`は辞書の日本語名とする。並びは辞書の`schema:hasDefinedTerm`の順、場所のないコードは出さない。各場所は次を持つ。

```ts
type LocationEntry = {
  id: string;                       // urn:uuid
  name: string;                     // OSM tags.name
  lat: number;
  lng: number;
  imageUri?: string;                // schema:image.schema:contentUrl
  relatedPages: { name: string; url: string }[]; // schema:subjectOf
  osmElement: { type: "node" | "way" | "relation"; id: number };
  wheelchair: "yes" | "limited" | "no" | null;
};
```

`routeDestinations`は現行のまま残す。同じ公開JSON-LDから2つの射影を作るが、目的が違う（掲載選択つきのルート用と、全件の場所検索用）ため、一方へ寄せない。カテゴリのまとめ方だけは同じ辞書を使う。

### 名前と欠落recordの扱いはルートページと揃える

表示名は`rdfs:seeAlso`のOSM要素をOSMタグミラーで引いた`tags.name`とする。OSM関連付けまたは空でない`name`がないrecordは、そのrecordだけを一覧から外し、ビルドは成功させる。現在は「子育てひろば「あい・ぽーと」麹町」の1件が該当する。

名前を目録やrecordから補う案は、表示名の出所を2つに増やす。場所検索とルートページで同じ場所の名前が食い違う原因になるため採らない。

### バリアフリーは`wheelchair`タグだけを3状態へ写像する

| タグ | 状態 | 説明文 |
| --- | --- | --- |
| `yes` | 全面 | 入口には段がなく、全部の部屋に段がありません。 |
| `limited` | 一部 | 入口には最大7センチの1段の段差があります。ほとんどの部屋には段がありません。 |
| `no` | 非対応 | 入口には段が1段から数段あり、部屋は車いす不可。 |
| 未設定・未知 | 情報なし | バリアフリー情報がありません。 |

説明文はOSM wikiの`wheelchair=yes`（entry: stepless / rooms: stepless）、`limited`（entry: 7cm以下の段差 / most important rooms: stepless）、`no`（entry: 7cm超の段差 / important rooms: not accessible）を日本語にしたもの。WheelMapの画面も同じ3状態と説明を使う。

WheelMapの「まったくそうではありません」というラベルは直訳調で、状態を即座に伝えにくい。UIのラベルは「非対応」とし、説明文で「部屋は車いす不可」と伝える。表記をWheelMapへ完全一致させるより、意味の伝達を優先する。

`wheelchair:description`、`toilets:wheelchair`、`capacity:disabled`はミラーにないため扱わない。追加されたら別changeで表示を検討する。

### 参照リンクはOSM要素の種類で分ける

WheelMapの`Poi`は`osm_id`を主キーとし、wayは負の`osm_id`で保存する（`way?`は`osm_id < 0`）。WheelMapのフロントエンドも`/nodes/`のIDが負ならwayへ振り分ける。したがって参照リンクは次のように構成する。

| OSM要素 | リンク先 | ラベル |
| --- | --- | --- |
| node | `https://wheelmap.org/nodes/{id}` | WheelMapで確認・更新する |
| way | `https://wheelmap.org/nodes/-{id}` | WheelMapで確認・更新する |
| relation | `https://www.openstreetmap.org/relation/{id}` | OpenStreetMapで確認・更新する |

WheelMapが`Poi`として持つのはnodeとwayだけで、`osm_type`は`node`か`way`である。relationは対応ページがないため、タグを直せるOSM要素ページへ逃がす。現在の102件はnodeが61件、wayが37件、relationが4件である。

issueの「WheelMap URLとOSM IDは厳密には一致しない可能性を呑む」は、wayで実際に不一致になる。負のIDを使えばwayは一致し、relationだけがWheelMapの対象外になる。全件を`/nodes/{id}`にする案は、way 37件が別のnodeへ解決するか404になるため採らない。relationもWheelMapへ誘導する案は、対応ページがないため採らない。

### 表示は詳細に集約し、一覧は既知の状態だけバッジにする

詳細ページは、見出しと地域の下に画像と帰属を置き、その下に「バリアフリー情報」を置く。状態1つを、アイコン、ラベル、説明文、情報源、更新リンクの1ブロックにまとめる。

```text
+--------------------------------------------------+
| (@) 全面                                         |
| 入口には段がなく、全部の部屋に段がありません。     |
| 情報源: OpenStreetMap                            |
| [詳細を見る・編集する]                            |
| [（WheelMapを開きます）]                          |
+--------------------------------------------------+
```

- `section`に`aria-labelledby`を付け、見出しは`h2`にする。
- ブロックは`rounded-box border-l-4 bg-base-200 p-4`。左線とアイコンの色だけを状態色（success・warning・error）にし、文字は`text-base-content`のままにする。`badge-soft`の色を16pxの文字に使うとコントラストが4.5:1に届かないため。
- ラベルは`text-xl font-bold`、説明文と情報源は`text-base`。すべて`ruby-text`を付ける。
- リンクは`btn btn-outline h-auto min-h-[44px] flex-col gap-0 py-2 whitespace-normal text-center`。可視文言は2行に分け、1行目に「詳細を見る・編集する」、2行目に「（WheelMapを開きます）」を置く。情報なしのときは「詳細を見る・追加する」、relationのときは「（OpenStreetMapを開きます）」に変える。WheelMapには写真などの追加情報がある場合があるため「見る」を含める。文言が長いので、1行に押し込まず2行を固定する。`target="_blank"`と`rel="noopener noreferrer"`を付け、可視文言の後ろに`sr-only`で「（新しいタブで開きます）」を足す。`aria-label`で上書きしない。

一覧カードは、状態が分かる場所だけバッジを付ける。102件中77件が「情報なし」であり、全件にバッジを付けると一覧が「情報なし」で埋まる。

- タイトルの下、町字と同じ行に置く。状態を左、町字を右にし、区切り文字は使わず余白で分ける。長い名前でもタイトルは全幅を保ち、バッジ行だけが折り返す。
- `badge badge-lg badge-outline`に`Accessibility`アイコン（`size-4`）と状態のテキストを入れる。`badge-lg`は16pxで、色付き文字を避けられる。
- 情報なしの場所はバッジを出さず、町字だけを出す。色だけで状態を伝えない（WCAG 2.2の1.4.1）。

### 画像と関連リンクはある場合だけ出す

`schema:image.schema:contentUrl`を画像に、`schema:subjectOf`の`schema:name`と`schema:url`を関連リンクにする。どちらも絶対http(s) URIでない場合は、その項目だけを表示しない。ID、座標、`gif-poi`コードはデータ契約の根幹なので、従来どおり不正ならビルドを失敗させる。画像と関連リンクは表示の付加情報であり、1件の不正で全件を止めない。

画像には作者とライセンスを`figcaption`で添える。`schema:image`の`schema:creator.schema:name`と`schema:license`をartifactに持ち、ライセンス名はリンクにする。42件すべてが両方を持つため、帰属を落とすとCC BY/CC BY-SAの条件を満たさない。

関連リンクはバリアフリー情報セクションの中に、更新リンクの下へ並べる。東京バリアフリーマップと言葉の道案内はバリアフリーの参照先であり、画像や基本情報に混ぜない。

旧`keyLocations`の説明文とウェブサイトは新しいrecordにないため表示しない。`schema:subjectOf`には東京バリアフリーマップと言葉の道案内へのリンクがあり、バリアフリー情報の参照先として詳細に出す。

### 地域は全場所について町字GeoJSONから導出する

`deriveRegions`の入力`keyLocations`を`locations`へ変え、`sources.locations`の全場所について導出する。どのポリゴンにも入らない場合は「その他」とする。`townGeoJsonUri`は残す。

### 旧データ源を破壊的に削除する

`keyLocationsUri`、`sources.keyLocations`、`KeyLocation`・`KeyLocationCategory`・`KeyLocationsDataResult`、`isKeyLocation`・`isKeyLocationCategory`、`loadLocationPageData`の`keyLocations`射影、関連テストと文書を削除する。カテゴリページのURLは`/locations/{code}`、詳細は`/locations/location-detail/{urn:uuid}`にする。旧URLのリダイレクトは作らない。

旧`key_locations.json`を残して欠落施設を補う案は、場所の同一性を2つのスキーマで持つ二重実装になる。憲章の「旧経路を保つためだけのフォールバックや二重実装を追加しない」に反するため採らない。

### データ提供元とライセンス表示を更新する

一覧のデータ提供元カードに、バリアフリー情報がOSMの`wheelchair`タグに基づくこと、WheelMap（nodeとway）またはOpenStreetMapで確認・更新できることを書く。旧カードの「風ぐるまの停留所から徒歩圏内（600m以内）」は、全103件を出す移行後は事実と違うため削除し、「千代田区の主要施設」に直す。`src/lib/license/openDataLicenses.json`の千代田区区民向け施設データの説明に、バリアフリー情報がOpenStreetMap由来（ODbL 1.0）であることを加える。WheelMapはリンク先であり、データの複製元ではない。

## Risks / Trade-offs

- [掲載が169件から102件へ減り、保育所・幼稚園・劇場が消える] → 受け入れる。欠落は公開データセットの`inputs/facilities.json`へ追加して戻す。アプリ側で旧データを残さない。
- [説明文43件が表示できなくなる] → 受け入れる。必要になったら`schema:description`を公開データセットへ追加する。
- [relationはWheelMapの対象外] → OSM要素ページへリンクし、ラベルも「OpenStreetMapで確認・更新する」にする。WheelMapの地図を座標で開く案は、URL仕様を確認できないため採らない。
- [WheelMapのURL規則が変わる] → リンクはビルド時に構成し、実行時に取得しない。規則が変わった場合はリンク構成だけを直せるようにする。
- [OSMタグミラーが月次更新で、状態が古い] → 詳細からWheelMapまたはOSMへ誘導し、最新情報の確認と更新を促す。ビルド時に追加取得はしない。
- [102件中25件しか状態がない] → 「情報なし」を明示し、更新導線を出す。断定や推測はしない。
- [画像の作者とライセンスを表示できない] → 42件すべてが`schema:creator`と`schema:license`を持つため、両方をartifactへ持ち、`figcaption`に出す。片方でも欠ける場合はビルドを失敗させ、帰属なしで画像を出さない。
- [カテゴリURLと場所URLが変わり、ブックマークが切れる] → リダイレクトは作らない。サイト内リンクはすべて新URLへ更新する。
- [辞書のコード追加・削除でビルドが失敗する] → ルートページと同じ扱い。失敗を握りつぶさず、データセットの語彙を直す。
- [カテゴリページが`force-dynamic`のまま] → 実行時取得はしないため静的化も可能だが、`origin`クエリによる並べ替えがあるため現状を維持する。

## Migration Plan

1. `scripts/generate-location-artifact.ts`へ`locations`の射影と`wheelchair`・`osmElement`・`imageUri`・`relatedPages`の解決を追加し、`keyLocations`の取得と検証を削除する。`deriveRegions`を全場所へ広げる。
2. `src/lib/location/location-artifact.ts`の検証と型を`locations`へ切り替える。`routeDestinations`の検証は変えない。
3. `location-page-data.ts`と`location-detail-resolver.ts`を`locations`へ切り替え、重複ID・不正ID・欠落の扱いを保つ。
4. カテゴリページ、詳細ページ、`/locations`のリダイレクトを新URLへ切り替え、バリアフリー表示とバッジを追加する。
5. `app-config.json`と`.example`から`keyLocationsUri`を削除する。文書とライセンス表示を更新する。
6. テストを更新し、`npm run build`でartifactを生成して、場所102件、状態あり25件、カテゴリ21件を確認する。
7. ロールバックは、artifact生成・設定・ページ・型を旧`keyLocations`へ戻して再ビルドする。`data/destinations.json`は影響を受けない。

## Open Questions

なし。
