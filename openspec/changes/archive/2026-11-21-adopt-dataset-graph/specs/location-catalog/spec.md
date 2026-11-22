# Spec Delta

## REMOVED Requirements

### Requirement: gif-poiコードと辞書によるカテゴリ

**Reason**: 上流はカテゴリ名辞書を廃止し、Placeの`gif-poi`識別子を`schema:keywords`の`DefinedTerm`参照へ変えた。辞書の取得を前提にした分類は成立しない。

**Migration**: `dataset.jsonld`の`DefinedTerm`からコードと名前を解決する「カテゴリtermへの参照による分類」を使う。

## MODIFIED Requirements

### Requirement: 公開JSON-LDのIDによる場所の同一性

場所は`urn:uuid:`形式のIDで識別する（MUST）。IDは公開グラフの`schema:Place` recordを指す。同じIDを複数のカテゴリに掲載してよいが、その場合は場所の内容が同一でなければならず、内容が異なる重複を許さない（MUST NOT）。表示名はOSMタグミラーから解決し、recordの名前を同一性や表示の判定に使ってはならない（MUST NOT）。

#### Scenario: IDで場所を識別する

- **WHEN** 場所の一覧を読む
- **THEN** IDが同一性を示し、名前はOSMタグミラーの値として扱われる

#### Scenario: 複数カテゴリの重複を同一内容なら許す

- **WHEN** 同じIDの場所が2つのカテゴリにあり、内容が同じである
- **THEN** ビルドは成功し、詳細はそのIDを1件の場所として解決する

#### Scenario: 重複IDを拒否する

- **WHEN** 同じIDの場所が2つあり、内容が異なる
- **THEN** ビルドは失敗する

### Requirement: 場所詳細の内容解決

場所詳細は、ID、OSM名、座標、カテゴリ名、導出地域を持つ（MUST）。`schema:image`の`schema:contentUrl`を写真の取得元に、`schema:subjectOf`の`schema:url`と`schema:name`を関連リンクに使う（MUST）。画像には`schema:license`のライセンスを添え（MUST）、作者が分かるときは`schema:creator.schema:name`の作者名を添える（MUST）。作者が分からないときは「作者不明」と示す（MUST）。ライセンスは記録された文字列をそのまま示し、絶対http(s) URIのときだけリンクにする（MUST）。ライセンスがない画像は表示しない（MUST NOT）。派生画像を生成できなかった写真も表示しない（MUST NOT）。`schema:contentUrl`または`schema:subjectOf`の`schema:url`が絶対http(s) URIでない場合は、その項目だけを表示しない（MUST）。

#### Scenario: 画像と関連リンクを表示する

- **WHEN** recordに`schema:image`と`schema:subjectOf`がある
- **THEN** 詳細は画像と関連リンクを表示する

#### Scenario: 画像の帰属を表示する

- **WHEN** recordの`schema:image`に作者とライセンスがある
- **THEN** 詳細は画像の下に作者とライセンスを表示する

#### Scenario: 作者不明の画像を表示する

- **WHEN** recordの`schema:image`に作者がなく、ライセンスがある
- **THEN** 詳細は画像を表示し、作者の代わりに「作者不明」とライセンスを示す

#### Scenario: URIのライセンスをリンクにする

- **WHEN** `schema:license`が絶対http(s) URIである
- **THEN** 詳細はライセンス名をそのURIへのリンクにする

#### Scenario: URIでないライセンスをテキストで示す

- **WHEN** recordの`schema:license`が「Public domain」のような絶対http(s) URIでない文字列である
- **THEN** 詳細はライセンスをリンクにせず、記録された文字列のままテキストで示す

#### Scenario: 帰属のない画像を出さない

- **WHEN** recordの`schema:image`に作者もライセンスもない（空文字列を含む）
- **THEN** 詳細はその画像を表示せず、他の項目を表示する

#### Scenario: 不正な画像URLを出さない

- **WHEN** `schema:image`の`schema:contentUrl`が絶対http(s) URIでない
- **THEN** 詳細は画像を表示せず、他の項目を表示する

#### Scenario: 派生画像のない写真を出さない

- **WHEN** 写真の取得または変換に失敗した
- **THEN** 詳細はその写真を表示せず、他の項目を表示する

### Requirement: 場所IDによる詳細の解決

場所詳細のURLは`urn:uuid:`のIDを受け取り、artifactから1件だけ解決する（MUST）。同じIDが複数のカテゴリにある場合、内容が同一であれば1件の場所として解決する（MUST）。IDがない、内容が異なる重複がある、またはartifactに存在しない場合は、詳細を表示せずエラーまたは404にする（MUST）。

#### Scenario: IDで詳細を解決する

- **WHEN** artifactに存在するIDを要求する
- **THEN** その場所の詳細を表示する

#### Scenario: 複数カテゴリの同じIDを1件に解決する

- **WHEN** 同じIDの場所が2つのカテゴリにあり、内容が同じである
- **THEN** 詳細はその場所を1件だけ表示する

#### Scenario: 存在しないIDを要求する

- **WHEN** artifactにないIDを要求する
- **THEN** 404を返す

#### Scenario: 重複したIDを要求する

- **WHEN** 同じIDの場所が2つあり、内容が異なる
- **THEN** 詳細はエラーを表示する

### Requirement: 実行時の外部取得をしない

場所ページはビルドartifactだけを読み、実行時に公開グラフ、OSMタグミラー、カテゴリ語彙、WheelMap、Wikimediaを取得してはならない（MUST NOT）。写真はビルドで生成した派生画像だけを参照し、WikimediaのURLを出力してはならない（MUST NOT）。artifactが欠落または不正な場合は、外部へフォールバックせずデータエラーを表示する（MUST）。

#### Scenario: artifactだけで表示する

- **WHEN** 場所ページを表示する
- **THEN** ページはartifactの場所だけを使う

#### Scenario: 写真を外部から取得しない

- **WHEN** 場所ページを表示する
- **THEN** 写真の取得先はビルドで生成した派生画像だけである

#### Scenario: artifactが欠落している

- **WHEN** artifactが欠落または不正である
- **THEN** 場所ページはデータエラーを表示し、外部取得をしない

## ADDED Requirements

### Requirement: カテゴリtermへの参照による分類

カテゴリは、`schema:Place`の`schema:keywords`が参照する`schema:DefinedTerm`とする（MUST）。識別子はtermの`schema:identifier`にある`gif-poi`コード、表示名はtermの`schema:name`とし、出力順は`schema:DefinedTermSet`の`schema:hasDefinedTerm`に従う（MUST）。参照先termがない、コードが4桁でない、コードが重複する、名前が空の場合はビルドを失敗させる（MUST）。

#### Scenario: termからカテゴリを解決する

- **WHEN** Placeの`schema:keywords`が`gif-poi`コードと名前を持つtermを参照する
- **THEN** その場所はコードのカテゴリへ名前で出力される

#### Scenario: 語彙順で出力する

- **WHEN** 複数のカテゴリに場所がある
- **THEN** カテゴリは`schema:DefinedTermSet`の`schema:hasDefinedTerm`の順に出力される

#### Scenario: 場所のないカテゴリを出力しない

- **WHEN** カテゴリに場所がない
- **THEN** そのカテゴリは一覧に含まれない

#### Scenario: 参照先termがない

- **WHEN** Placeの`schema:keywords`がグラフにないtermを参照する
- **THEN** ビルドは失敗する

#### Scenario: コードが不正または重複する

- **WHEN** termの`gif-poi`コードが4桁でない、または同じコードのtermが2つある
- **THEN** ビルドは失敗する

#### Scenario: 名前が空である

- **WHEN** termの`schema:name`が空である
- **THEN** ビルドは失敗する

### Requirement: 複数カテゴリの場所の掲載

複数の`schema:keywords`を持つ場所は、参照された各カテゴリの一覧へ同じ内容で掲載する（MUST）。場所詳細は、その場所を含む全カテゴリへのリンクを表示する（MUST）。

#### Scenario: 各カテゴリに掲載する

- **WHEN** 場所が2つのカテゴリtermを参照する
- **THEN** その場所は両方のカテゴリの一覧に表示される

#### Scenario: 詳細から全カテゴリへリンクする

- **WHEN** 複数カテゴリの場所詳細を表示する
- **THEN** 場所を含むすべてのカテゴリへのリンクが表示される

### Requirement: 公開グラフの形状確認

ビルドは、公開グラフの`schema:Place`を対象とする`sh:NodeShape`が`schema:geo`、`schema:image`、`schema:keywords`、`rdfs:seeAlso`を宣言していることを確認しなければならない（MUST）。`schema:DefinedTerm`を対象とする形状が`schema:name`と`gif-poi`の`schema:identifier`を宣言していることも確認する（MUST）。形状がない、または必要なpathがない場合は、上流のrecord形状が変わったとしてビルドを失敗させる（MUST）。

#### Scenario: 形状がアプリの読むpathを宣言する

- **WHEN** PlaceとDefinedTermの形状が必要なpathを持つ
- **THEN** ビルドは形状確認を通過する

#### Scenario: Place形状がない、またはpathが欠ける

- **WHEN** Placeの形状がない、または`schema:keywords`などのpathを宣言していない
- **THEN** ビルドは上流のrecord形状が変わったとして失敗する

#### Scenario: DefinedTerm形状のpathが欠ける

- **WHEN** DefinedTermの形状が`schema:identifier`を宣言していない
- **THEN** ビルドは失敗する

### Requirement: カテゴリのない場所の除外

カテゴリtermを1つも参照しない場所は、一覧と経路フォームに掲載しない（MUST）。ビルドは除外した件数を警告として出力し、成功する（MUST）。

#### Scenario: カテゴリのない場所を掲載しない

- **WHEN** 目録の候補に`schema:keywords`を持たない場所がある
- **THEN** その場所は一覧と経路フォームに含まれず、ビルドは成功する

#### Scenario: 除外を警告する

- **WHEN** カテゴリのない場所を除外する
- **THEN** ビルドは除外した件数を警告に出す

#### Scenario: 他の場所を出力する

- **WHEN** カテゴリのない場所とカテゴリのある場所が混在する
- **THEN** カテゴリのある場所だけが出力される
