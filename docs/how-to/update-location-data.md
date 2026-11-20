# 場所データの更新

「場所をさがす」はビルド時に場所一覧のartifactを生成します。母集団は目的地目録（`data/destinations.json`）の候補に含まれるrecordだけで、公開JSON-LDの全recordではありません。公開JSON-LD・OSMタグミラー・カテゴリ名辞書・町字GeoJSON・Wikidataミラーから名前・カテゴリ・地域・写真・バリアフリー情報・電話・ウェブサイト・Wikipediaを解決して `public/generated/location-data.json` へ書き出します。写真は同じビルドで取得・変換し、配信用のWebPを `public/generated/location-images/` へ出力します。

## 母集団

場所一覧は、目的地目録（`data/destinations.json`）の候補に含まれるrecordだけを対象にします。`npm run update-destinations` が経路検索と同じ徒歩圏の判定で目録を更新します。公開JSON-LDにrecordが増えても、目録を更新するまで場所一覧には出ません。目録の候補のうち、OSM要素に空でない`name`がないrecordは表示しません。ビルドは距離を再計算せず、目録のID集合だけで母集団を決めます。

## 取得元

- 目的地目録: `data/destinations.json`
- 公開JSON-LD: `app-config.json` の `placesJsonLdUri`
- OSMタグミラー: `app-config.json` の `osmMirrorUri`
- 町字GeoJSON: `app-config.json` の `townGeoJsonUri`
- カテゴリ名辞書: `app-config.json` の `categoryNamesUri`
- Wikidataミラー: `app-config.json` の `wikidataMirrorUri`
- 写真: `schema:image` の `schema:contentUrl` からファイル名を取り、`https://commons.wikimedia.org/wiki/Special:FilePath/<ファイル名>?width=1280`

外部の取得元はいずれもビルド時に取得し、実行時には取得しません。目的地目録はリポジトリ内の `data/destinations.json` を読みます。WheelMapはリンク先としてのみ参照し、ビルド時にも実行時にも取得しません。Wikidataミラーは `entities` の `sitelinks` だけを使い、取得失敗・形式不正はビルド失敗とします。

## ビルドと件数確認

1. 作業ディレクトリをリポジトリのルートにします。
2. 次のコマンドを実行します。

   ```bash
   npm run build
   ```

3. `public/generated/location-data.json` を確認します。目安は次のとおりです。

   - 場所79件
   - `wheelchair` のある場所13件（`yes` 8、`limited` 3、`no` 2）
   - カテゴリ18件（辞書22件のうち、recordがないカテゴリと、目録の候補にない・OSM名がないrecordだけのカテゴリを除く）
   - 画像の作者とライセンス29件（`schema:license`は非空の文字列なら表示し、絶対http(s) URIのときだけリンクにする）
   - 派生画像のある場所29件。幅は480・960・1280pxを上限とし、元画像が小さい場合は元画像の幅
   - 電話24件、ウェブサイト37件、Wikipediaリンク33件、編集リンク79件

   写真と派生画像の件数は、次のコマンドでも確認できます。

   ```bash
   node -e "const a=require('./public/generated/location-data.json');const l=a.sources.locations.flatMap(c=>c.locations);console.log('写真',l.filter(x=>x.image).length,'派生画像の場所',l.filter(x=>x.image).length)"
   ls public/generated/location-images/*.webp | wc -l
   ```

4. 場所詳細は `/locations/location-detail/{encodeURIComponent(id)}` を開き、既知IDがHTTP 200で表示されることを確認します。目録の候補にないIDは404になります。

件数がずれた場合は、公開データセット・OSM・辞書・目的地目録のどれが変わったかを確認します。目録の候補にないrecordは、そのrecordだけを一覧から外し、ビルドは成功します。OSM関連付けまたは空でない`name`がないrecordも同様です。`gif-poi`コードがない・複数ある・辞書にないrecordがあるとビルドは失敗します。重複IDがある場合もビルドは失敗します。1402（保育園）と1219（職業安定所）は目録の候補にあるもののOSM名を持たないため0件、1004（庭園）は目録の候補にないため0件です。

## 写真の派生画像

- 写真は `Special:FilePath` の1280px以下から取得し、同時2接続、間隔を空けて要求します。429と5xxは `Retry-After` を尊重して最大3回再試行し、User-Agentは `KazagurumaTransit/1.0 (+https://github.com/nawashiro/kazaguruma-transit)` です。
- `sharp` でEXIFの向きを適用し、480・960・1280pxを候補とし、元画像の幅が候補より小さい場合は元画像の幅でWebP（品質80）を生成します。元画像を拡大しません。
- 出力名は `<内容ハッシュ16桁>-<幅>.webp` です。ハッシュは出力バイトのSHA-256先頭16桁で、同じ入力なら同じ名前、内容が変われば別の名前になります。
- artifactの各場所には `image` として元画像の幅・高さと `variants`（幅と `/generated/location-images/<ファイル名>` のパス）が入ります。`imageUri`・`imageCreator`・`imageLicense` は取得元の記録として残り、ページは `imageUri` を表示しません。`imageLicense` は絶対http(s) URIのときだけ詳細ページでリンクにし、それ以外は記録された文字列のままテキストで示します。「Public domain」のような非URIのライセンスも、作者名があれば表示します。
- 取得または変換に失敗した写真は `image` なしになり、一覧・詳細はその写真を表示しません。ビルドは続行し、最後に `写真を取得できませんでした: N件` を警告します。原寸URLへのフォールバックはしません。
- `upload.wikimedia.org/wikipedia/commons/` 以外の写真は対象外として同じ警告に数えます。

生成の前に `public/generated/location-images/` を空にします。`public/generated/` はgit管理外で、`.dockerignore` にも入れてあるためDockerのビルド文脈には入りません。生成物は次のコマンドで確認できます。

```bash
ls public/generated/location-images/*.webp | wc -l
node -e "const a=require('./public/generated/location-data.json');const v=a.sources.locations.flatMap(c=>c.locations).flatMap(x=>x.image?.variants??[]);console.log([...new Set(v.map(x=>x.width))].sort((a,b)=>a-b),v.length)"
node -e "const sharp=require('sharp'),fs=require('fs');const f=fs.readdirSync('public/generated/location-images')[0];sharp('public/generated/location-images/'+f).metadata().then(m=>console.log(f,m.format,m.width,m.height))"
```

## 配信キャッシュ

`next.config.ts` の `headers()` が `/generated/location-images/:path*` に `Cache-Control: public, max-age=31536000, immutable` を付けます。`/generated/location-data.json` には付けないため、artifactは長期キャッシュされません。`npm start` のあと、次のコマンドで確認できます。

```bash
curl -sI "http://127.0.0.1:3000$(node -e "const a=require('./public/generated/location-data.json');process.stdout.write(a.sources.locations.flatMap(c=>c.locations).find(l=>l.image).image.variants[0].path)")" | grep -i cache-control
curl -sI http://127.0.0.1:3000/generated/location-data.json | grep -i cache-control
```

## OSM・WheelMapでの修正

バリアフリー情報はOSMの `wheelchair` タグを `yes`・`limited`・`no` の3状態へ写像します。未設定・未知の値は「情報なし」として区別し、一覧でも無彩色のバッジを表示し、詳細では「追加してください。」と追加を促します。

- nodeは `https://wheelmap.org/nodes/{id}` へ向かいます。
- wayは `https://wheelmap.org/nodes/-{id}` へ向かいます。
- relationは `https://www.openstreetmap.org/relation/{id}` へ向かいます。

最新の状態確認と修正は、場所詳細の参照リンクからWheelMapまたはOpenStreetMapへ進み、OSM側でタグを直します。ビルド時のミラーは月次更新のため、直した内容の反映は次回ビルド以降になります。

画像は `schema:image` の `schema:contentUrl`・`schema:creator.schema:name`・`schema:license` を使います。作者またはライセンスがない画像は一覧・詳細のどちらにも表示しません。ライセンスは`CC BY-SA 4.0`のような名前で表示します。一覧と詳細はビルドで生成した派生画像を `srcset` で表示し、原寸のURIへはリンクしません。詳細では画像の下に作者とライセンスを表示し、一覧カードでは「写真 作者・ライセンス」の1行でテキスト表示します。不正な絶対http(s) URIの画像・関連リンクもその項目だけ表示しません。

## 電話・ウェブサイト・Wikipediaの解決と警告

- 電話は `phone` または `contact:phone` から取り、数字以外を外し、先頭の `81` を落とし、`3` で始まる9桁には `0` を足します。`03` で始まる10桁は `03-NNNN-NNNN`、9桁は `03-XXX-XXXX` に整形し、`tel:` リンクにします。正規化できない値は表示せず、ビルド時に警告します。
- ウェブサイトは `website` を `contact:website` より優先し、絶対http(s) URIだけを表示します。「ウェブサイトを開く」と表示します。
- Wikipediaは日本語を優先し、OSMの `wikipedia` タグ → Wikidataミラーの `jawiki` → OSMの他言語 → Wikidataミラーの `enwiki` の順で解決します。`lang:Title` の空白は `_` に置換してURLエンコードします。どれもなければ表示しません。
- 編集リンクは基本情報の情報行の後、出典の前に左寄せで置き、`https://www.openstreetmap.org/edit?{type}={id}` でOSMのiDエディタを開きます。車いす情報と基本情報の操作ボタンの後には「© OpenStreetMap contributors ODbL-1.0」を表示し、独立した提供元セクションは置きません。
- 基本情報は電話・ウェブサイト・Wikipedia・営業状態・営業時間・編集リンクの値があるものを出し、どれもなければ節ごと出しません。

## 営業時間の規則と警告

- artifactの各場所へ `openingHours`（OSMの生の規則）を追加します。ビルドでは解釈せず、文字列であることだけを検証します。
- 詳細ページはサーバーで日本時間（Asia/Tokyo）に評価し、現在の状態と先一週間の予定を計算します。プロセスのTZに依存しないようDateをずらすアダプタを使い、グローバルなTZは変えません。
- 基本情報の中に「営業状態」と「営業時間」の2行を置きます。営業状態の行は状態バッジ、次に変わる時刻、今日が祝日のときは祝日の警告、目安の注意書きを持ち、営業時間の行は一週間の一覧と目安の注意書きを持ちます。「今:」は付けません。「24/7」は「24時間営業」と表示します。
- 一週間の一覧の先頭は、日付と曜日の代わりに「今日」と表示します。
- 「目安なので、正確な時間は施設に問い合わせてください。」は両方の行に表示します。
- `PH` または `SH` が規則になく、今日が日本の祝日で、営業状態を解釈できる場合、「祝日は通常と異なる場合があります。」を営業状態の行に追加します。祝日でない日、祝日指定がある場合、または営業状態を解釈できない場合は出しません。
- 規則がない場所は2行とも出しません。解釈できない場合は営業中・営業時間外を断定せず、営業時間の行に生の規則と目安の注意書きだけを表示します。

## 公開データセットでの修正

掲載が減る・説明が出ないなどの欠落は、アプリ側で旧データを残さず、公開データセットの `inputs/facilities.json` へ施設を追加して戻します。カテゴリ名辞書のコード追加・削除はビルドを失敗させるため、データセット側の語彙を直します。
