# Design

## Context

上流の公開物は、カテゴリ語彙とrecord形状を含む`dataset.jsonld`へ変わった。アプリは実行時に外部を読まず、ビルドで`public/generated/location-data.json`と目的地目録を作る。現行の解析は次の前提を持つ。

- `places.jsonld`の`@graph`にはPlaceだけがある。
- 各Placeは`schema:identifier`に`gif-poi`コードを1つ持つ。
- カテゴリ名は`category-names.jsonld`の`DefinedTermSet`から引く。
- 画像は作者とライセンスがそろって初めて表示する。
- IDは場所ごとに一意で、重複はエラー。

新しい公開物はこの前提を崩す。2026-11-21時点の実測は次のとおり。

- `@graph`はPlace 106、DefinedTermSet 1、DefinedTerm 22、NodeShape 3。
- Placeは`schema:keywords`でtermを参照し、自身の`gif-poi`識別子を持たない。
- termはUUIDの`@id`、`schema:name`、`schema:identifier`の`gif-poi`コードを持つ。
- カテゴリ0件と複数件が契約上許される。
- `schema:image`の`schema:creator`は任意。
- 目的地目録87件のうち、一覧に出るのは86件、カテゴリは20件、写真参照は50件（作者なし2件）。

`sh:NodeShape`は同じ`@graph`にあるが、アプリはRDF実行系を持たない。SHACLのインスタンス検証はせず、形状がアプリの読むpathを宣言しているかだけを確認する。

## Goals / Non-Goals

**Goals:**

- 公開グラフ1文書から、場所・カテゴリ・形状をビルドで解決する。
- カテゴリ0件・複数件を、ビルドを止めずに扱う。
- 作者のない画像を、作者不明と明示して表示する。
- 上流のrecord形状が変わったときに、原因の分かるビルドエラーを出す。
- artifactとページは実行時に外部を読まないままにする。

**Non-Goals:**

- JSON-LDをRDFへ変換するSHACLの完全検証。依存追加が必要で、上流の検証と重複する。
- artifactのフラット化。場所を1回だけ持ち、カテゴリをmembershipにする構造変更は、複数カテゴリが日常になってから行う。
- Release資産の版固定。Pagesの最新を読む現行方針を維持する。
- 旧`places.jsonld`、`category-names.jsonld`への互換エイリアスやフォールバック。
- 写真の取得・変換パイプラインの変更。

## Decisions

### 取得元は`dataset.jsonld`へ一本化する

`app-config.json`の`placesJsonLdUri`を`datasetJsonLdUri`へ改名し、`categoryNamesUri`を削除する。設定を読むのはビルドと目録更新だけで、実行時には読まない。

旧キーを残してURLだけ差し替える案は、名前が実体とずれる。互換エイリアスは二重実装になる。Release資産を固定する案は、月次更新に追随する目的と合わない。採用しない。

`LocationArtifactSourceUris`と`DestinationCatalogSourceUris`も`datasetJsonLdUri`へ揃え、artifactと`data/destinations.json`の`source`を同じ形にする。

### `@graph`は型で分け、カテゴリはtermの索引から引く

```text
dataset.jsonld
  |
  +-- schema:Place -------- schema:keywords ----> term @id
  |                                                    |
  +-- schema:DefinedTermSet -- schema:hasDefinedTerm --+
                                                       |
                                                       v
                                    term: schema:name + gif-poi code
```

Placeは`@type`に`schema:Place`を持つノードだけとする。`urn:uuid:`の`@id`だけではtermや形状も拾うため、IDだけの判定は使わない。同じ判定を目録更新の`readPlaceRecords`にも入れる。

termは`DefinedTermSet`の`schema:hasDefinedTerm`の順で索引化する。`@graph`の出現順は契約ではない。各termは次の検証を通す。

- `@id`が`urn:uuid:`である。
- `schema:name`が空でない。
- `schema:identifier`の`schema:PropertyValue`が`propertyID: gif-poi`で、`value`が4桁コードである。
- コードが重複しない。

Placeの`schema:keywords`は配列と単値を両方受け、参照先termがすべて索引にあることを確認する。参照先がない場合はビルドを失敗させる。カテゴリ0件は失敗ではなく除外とする（後述）。

### 複数カテゴリは同じentryを各バケットへ複製し、同一性を内容の一致で守る

`LocationCategory[]`のartifact構造を変えず、場所が参照する各カテゴリの`locations`へ同じ`LocationEntry`をpushする。場所の生成は1回だけ行い、同じオブジェクトを複製する。

```text
Place A --keywords--> [0702, 0802]
  -> sources.locations[0702].locations += A
  -> sources.locations[0802].locations += A
```

同じIDが複数カテゴリに現れるため、既存の「重複IDは常にエラー」を「同じIDで内容が異なる場合だけエラー」へ変える。比較はartifact検証と詳細解決で同じdeep-equalを使う。項目が1つでも違えば、そのIDはどちらの事実が正しいか決められないのでエラーにする。

代替案は3つ。

- artifactをフラット化する: 構造的には最も正しいが、一覧・詳細・経路フォームのページ層を作り直す。今回は見送る。
- 先頭カテゴリだけ採用する: 差分は最小だが、分類情報を落とし、順序依存の不可解な挙動になる。
- 複数ならビルド失敗: 現行踏襲だが、上流の契約が複数カテゴリを許す以上、月次更新で止まる。

複製と同一性検査を選ぶ。重複を許す変更は、既存のエラー条件を1段緩めるだけで、新しい厳格さを足すものではない。

### カテゴリ0件は警告して除外する

カテゴリtermを1つも参照しない場所は、一覧と経路フォームに載せない。カテゴリページのURLが存在しないため、「未分類」というGIFにないコードを作るのは避ける。ビルドは除外件数を警告として出し、成功する。

カテゴリ判定はOSM関連付けと名前の解決より後ろに置く。カテゴリ0件の場所でも、OSM関連付けがなければ従来どおり静かに除外される。判定順は「座標 → OSM関連付け・名前 → カテゴリ」とし、カテゴリ0件だけを警告対象にする。

### 作者のない画像は「作者不明」として表示する

`schema:creator`は任意とする。artifactでは`imageUri`と`imageLicense`を必須、`imageCreator`を任意にする。`resolveLocationImage`は派生画像データとライセンスだけを必須にし、作者がない場合は`creator`を返さない。

表示は次のとおり。

```text
作者あり : 作者名・CC BY-SA 4.0
作者なし : 作者不明・CC BY 2.0
```

作者不明の画像を隠す案は、上流が公開した情報を捨てる。作者を空のままライセンスだけ出す案は、帰属が済んだように見える。作者不明と明示するのが最も誠実で、分岐も1本で済む。

残るリスクは、CC BYの帰属が上流のCommonsメタデータに依存し、完全ではないこと。これは実装では解消できないため、文書に残す。

### 形状はインスタンス検証ではなく、契約の指紋として読む

`sh:NodeShape`から、`sh:targetClass`が`schema:Place`と`schema:DefinedTerm`の形状を探し、`sh:property`の`sh:path`を集める。Place形状には`schema:geo`、`schema:image`、`schema:keywords`、`rdfs:seeAlso`、DefinedTerm形状には`schema:name`と`schema:identifier`（`gif-poi`）が必要とする。欠ければ「上流のrecord形状が変わった」としてビルドを失敗させる。

形状の全文検証はしない。JSON-LDからRDFへの変換とSHACLエンジンの依存が増え、エラーは「minCount違反」のように汎用化する。こちらのパーサは「keywordsの参照先termがない」と言えるので、診断はパーサの方が具体的だ。形状は、プロパティ名の改名のように、パーサが静かに0件と解釈し得る変更の早期検知にだけ使う。

形状の構造自体が変わった場合（`sh:property`がオブジェクトになる等）も、同じ確認関数で吸収する。形状の追加や無関係なpathの追加では失敗させない。

### 詳細ページは先頭カテゴリをパンくずに、全カテゴリを本文のナビに出す

パンくずは語彙順の先頭カテゴリを使う。2カテゴリ以上あるときは、タイトルの下に「カテゴリ」ナビを出し、場所を含む全カテゴリへリンクする。1カテゴリのときはパンくずだけで足りるため、ナビは出さない。

`generateStaticParams`は場所IDで重複排除する。`loadLocationPageData`は重複IDを拒否せず、`resolveLocationDetail`が同一内容の重複を1件に畳み、内容が異なる重複だけをエラーにする。

### 経路フォームも同じterm索引を使う

`buildRouteDestinations`もPlace型で絞り、term索引からカテゴリを解決する。複数カテゴリの掲載entryは各カテゴリへ同じ目的地を出す。カテゴリ0件のentryは除外し、残りで出力する。`RouteDestinationLocation`はIDを持たないため、重複の同一性検査は不要。

## Risks / Trade-offs

- [同じIDが複数カテゴリに現れ、consumerが誤って重複として扱う] → artifact検証と詳細解決で同一内容だけを許し、内容不一致をエラーにする。将来はartifactのフラット化で解消する。
- [作者不明画像の帰属が不完全] → 表示を「作者不明」に限定し、CC BYの帰属が上流のメタデータに依存することを文書に残す。
- [形状の指紋確認が上流の無害な形状変更で失敗する] → pathの存在だけを見て、追加や順序変更では失敗させない。失敗メッセージに欠けたpathを出す。
- [複数カテゴリが増えるとartifactが重複で膨らむ] → 現データは0件。複製は同じオブジェクトで、件数も小さい。日常になったらフラット化を別変更で行う。
- [写真の取得対象が29件から50件へ増え、ビルドが長くなる] → 既存の同時2接続・間隔・再試行を維持する。失敗写真は従来どおりスキップし、件数を警告する。
- [件数やフィクスチャの更新漏れでテストが脆くなる] → テストのフィクスチャを新しいグラフ構造へ作り直し、件数は実測後に文書へ反映する。
- [既存環境の`app-config.json`が旧キーのまま] → 設定はgit管理外なので、移行手順にローカル更新を明記する。`ensure-app-config`は既存ファイルを上書きしない。

## Migration Plan

1. `app-config.json.example`と各環境の`app-config.json`を`datasetJsonLdUri`へ変え、`categoryNamesUri`を消す。`data/destinations.json`の`source`も同じ形にする。
2. 生成処理を新しいグラフ解析へ変える。Place型フィルタ、term索引、keywords解決、複数カテゴリ、0件の警告、形状確認を入れる。先に新しいフィクスチャでテストを赤くする。
3. artifact検証と詳細解決を、同一内容の重複を許す形へ変える。ページデータの重複拒否を外し、静的パラメータを重複排除する。
4. 詳細ページに全カテゴリのナビを足す。作者不明画像の表示を詳細とカードへ入れる。
5. 目録更新を新しい取得元とterm索引へ揃える。
6. 文書と件数を更新し、`npm run build`でartifactと画像を生成する。場所一覧、複数カテゴリの詳細、作者不明画像、経路フォームを確認する。

ロールバックは通常行わない。旧URLは404で、旧形式のコードへ戻しても最新データを読めない。緊急時は旧形式のRelease資産と旧コードの組み合わせへ一時的に戻すが、維持しない。

## Open Questions

なし。
