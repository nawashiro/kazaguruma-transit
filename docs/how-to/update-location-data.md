# 場所データの更新

「場所をさがす」はビルド時に場所一覧のartifactを生成します。公開JSON-LDの全recordを母集団にし、OSMタグミラー・カテゴリ名辞書・町字GeoJSON・Wikidataミラーから名前・カテゴリ・地域・画像・バリアフリー情報・電話・ウェブサイト・Wikipediaを解決して `public/generated/location-data.json` へ書き出します。

## 取得元

- 公開JSON-LD: `app-config.json` の `placesJsonLdUri`
- OSMタグミラー: `app-config.json` の `osmMirrorUri`
- 町字GeoJSON: `app-config.json` の `townGeoJsonUri`
- カテゴリ名辞書: `app-config.json` の `categoryNamesUri`
- Wikidataミラー: `app-config.json` の `wikidataMirrorUri`

いずれもビルド時に取得し、実行時には取得しません。WheelMapはリンク先としてのみ参照し、ビルド時にも実行時にも取得しません。Wikidataミラーは `entities` の `sitelinks` だけを使い、取得失敗・形式不正はビルド失敗とします。

## ビルドと件数確認

1. 作業ディレクトリをリポジトリのルートにします。
2. 次のコマンドを実行します。

   ```bash
   npm run build
   ```

3. `public/generated/location-data.json` を確認します。目安は次のとおりです。

   - 場所102件
   - `wheelchair` のある場所25件（`yes` 17、`limited` 5、`no` 3）
   - カテゴリ20件（辞書22件のうち場所のない2件、1306と1402を除く）
   - 画像の作者とライセンス38件（`schema:license`が「Public domain」などURIでない4件は表示しない）
   - 電話28件、ウェブサイト50件、Wikipediaリンク48件、編集リンク102件

4. 場所詳細は `/locations/location-detail/{encodeURIComponent(id)}` を開き、既知IDがHTTP 200で表示されることを確認します。

件数がずれた場合は、公開データセット・OSM・辞書のどれが変わったかを確認します。OSM関連付けまたは空でない`name`がないrecordは、そのrecordだけを一覧から外し、ビルドは成功します。`gif-poi`コードがない・複数ある・辞書にないrecordがあるとビルドは失敗します。重複IDがある場合もビルドは失敗します。1402（保育園）は唯一のrecordがOSM名を持たないため、現在は0件です。

## OSM・WheelMapでの修正

バリアフリー情報はOSMの `wheelchair` タグを `yes`・`limited`・`no` の3状態へ写像します。未設定・未知の値は「情報なし」として区別し、一覧でも無彩色のバッジを表示し、詳細では「追加してください。」と追加を促します。

- nodeは `https://wheelmap.org/nodes/{id}` へ向かいます。
- wayは `https://wheelmap.org/nodes/-{id}` へ向かいます。
- relationは `https://www.openstreetmap.org/relation/{id}` へ向かいます。

最新の状態確認と修正は、場所詳細の参照リンクからWheelMapまたはOpenStreetMapへ進み、OSM側でタグを直します。ビルド時のミラーは月次更新のため、直した内容の反映は次回ビルド以降になります。

画像は `schema:image` の `schema:contentUrl`・`schema:creator.schema:name`・`schema:license` を使います。作者またはライセンスがない画像は一覧・詳細のどちらにも表示しません。ライセンスは`CC BY-SA 4.0`のような名前で表示します。詳細ページでは元のURIへリンクし、一覧カードでは「写真 作者・ライセンス」の1行でテキスト表示します。不正な絶対http(s) URIの画像・関連リンクもその項目だけ表示しません。

## 電話・ウェブサイト・Wikipediaの解決と警告

- 電話は `phone` または `contact:phone` から取り、数字以外を外し、先頭の `81` を落とし、`3` で始まる9桁には `0` を足します。`03` で始まる10桁は `03-NNNN-NNNN`、9桁は `03-XXX-XXXX` に整形し、`tel:` リンクにします。正規化できない値は表示せず、ビルド時に警告します。
- ウェブサイトは `website` を `contact:website` より優先し、絶対http(s) URIだけを表示します。「ウェブサイトを開く」と表示します。
- Wikipediaは日本語を優先し、OSMの `wikipedia` タグ → Wikidataミラーの `jawiki` → OSMの他言語 → Wikidataミラーの `enwiki` の順で解決します。`lang:Title` の空白は `_` に置換してURLエンコードします。どれもなければ表示しません。
- 編集リンクは基本情報の最後に置き、`https://www.openstreetmap.org/edit?{type}={id}` でOSMのiDエディタを開きます。車いす情報と基本情報のデータの直後には「© OpenStreetMap contributors ODbL-1.0」を表示し、独立した提供元セクションは置きません。
- 基本情報は電話・ウェブサイト・Wikipedia・営業状態・営業時間・編集リンクの値があるものを出し、どれもなければ節ごと出しません。

## 営業時間の規則と警告

- artifactの各場所へ `openingHours`（OSMの生の規則）を追加します。ビルドでは解釈せず、文字列であることだけを検証します。
- 詳細ページはサーバーで日本時間（Asia/Tokyo）に評価し、現在の状態と先一週間の予定を計算します。プロセスのTZに依存しないようDateをずらすアダプタを使い、グローバルなTZは変えません。
- 基本情報の中に「営業状態」と「営業時間」の2行を置きます。営業状態の行は状態バッジ、次に変わる時刻、祝日の警告、目安の注意書きを持ち、営業時間の行は一週間の一覧と目安の注意書きを持ちます。「今:」は付けません。「24/7」は「24時間営業」と表示します。
- 一週間の一覧の先頭は、日付と曜日の代わりに「今日」と表示します。
- 「目安なので、正確な時間は施設に問い合わせてください。」は両方の行に表示します。
- `PH` または `SH` が規則になく、営業状態を解釈できる場合、「祝日は通常と異なる場合があります。」を営業状態の行に追加します。祝日指定がある場合、または営業状態を解釈できない場合は出しません。
- 規則がない場所は2行とも出しません。解釈できない場合は営業中・営業時間外を断定せず、営業時間の行に生の規則と目安の注意書きだけを表示します。

## 公開データセットでの修正

掲載が減る・説明が出ないなどの欠落は、アプリ側で旧データを残さず、公開データセットの `inputs/facilities.json` へ施設を追加して戻します。カテゴリ名辞書のコード追加・削除はビルドを失敗させるため、データセット側の語彙を直します。
