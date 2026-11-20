# location-catalog Specification

## Purpose

「場所をさがす」で、公開JSON-LDのrecordを場所の同一性の正とし、OSM名・カテゴリ名・地域・画像・関連リンクをビルド時に解決した一覧と詳細を提供する。

## Requirements

### Requirement: 公開JSON-LDのIDによる場所の同一性

場所は`urn:uuid:`形式のIDで識別する（MUST）。IDは公開JSON-LDのrecordを指し、重複してはならない（MUST NOT）。表示名はOSMタグミラーから解決し、recordの名前を同一性や表示の判定に使ってはならない（MUST NOT）。

#### Scenario: IDで場所を識別する

- **WHEN** 場所の一覧を読む
- **THEN** IDが同一性を示し、名前はOSMタグミラーの値として扱われる

#### Scenario: 重複IDを拒否する

- **WHEN** 同じIDを持つrecordが2つある
- **THEN** ビルドは失敗する

### Requirement: 目的地目録の候補の一覧化

ビルドは場所一覧を、目的地目録（`data/destinations.json`）の候補に含まれるrecordだけから作らなければならない（MUST）。目録にないrecordは、そのrecordだけを除外し、残りで出力する（MUST）。候補のうち`rdfs:seeAlso`のOSM要素に空でない`name`があるrecordだけを一覧に含める（MUST）。母集団を絞るために、ビルドで距離計算や停留所の取得をしてはならない（MUST NOT）。徒歩圏の判定は目録の更新の責務とし、その定義は`destination-catalog`に従う。

#### Scenario: 目録にあるrecordを一覧にする

- **WHEN** recordが目録の候補にあり、OSM要素に空でない`name`がある
- **THEN** そのrecordは一覧に入る

#### Scenario: 目録にないrecordを一覧にしない

- **WHEN** recordが目録の候補にない
- **THEN** そのrecordは一覧に入らず、ビルドは残りで成功する

#### Scenario: 目録にだけあるrecordを一覧にしない

- **WHEN** recordが目録の候補にあり、OSM要素の`name`が空またはOSM関連付けがない
- **THEN** そのrecordは一覧に入らず、ビルドは成功する

#### Scenario: ビルドで徒歩圏を再計算しない

- **WHEN** ビルドが一覧を作る
- **THEN** 停留所を読み込まず、目録のID集合だけで母集団を決める

#### Scenario: 目録にない場所の詳細を返さない

- **WHEN** 目録の候補にない場所のIDを詳細URLで要求する
- **THEN** artifactに存在しないため404を返す

### Requirement: gif-poiコードと辞書によるカテゴリ

カテゴリは`gif-poi`コードを識別子とし、カテゴリ名辞書の日本語名と定義順で出力する（MUST）。同じコードの場所を1つのカテゴリへまとめ、異なるコードを統合してはならない（MUST NOT）。場所のないカテゴリは出力しない（MUST）。コードがない、複数ある、または辞書にない場合はビルドを失敗させる（MUST）。

#### Scenario: コードに対応するカテゴリへ出力する

- **WHEN** recordの`gif-poi`コードが辞書にある
- **THEN** そのrecordはコードのカテゴリへ辞書の名前で出力される

#### Scenario: 場所のないカテゴリを出力しない

- **WHEN** カテゴリに場所がない
- **THEN** そのカテゴリは一覧に含まれない

#### Scenario: コードが一意でない

- **WHEN** recordの`gif-poi`コードが0件または複数ある
- **THEN** ビルドは失敗する

### Requirement: 場所詳細の内容解決

場所詳細は、ID、OSM名、座標、カテゴリ名、導出地域を持つ（MUST）。`schema:image`の`schema:contentUrl`を写真の取得元に、`schema:subjectOf`の`schema:url`と`schema:name`を関連リンクに使う（MUST）。画像には`schema:creator.schema:name`の作者と`schema:license`のライセンスを添える（MUST）。ライセンスは記録された文字列をそのまま示し、絶対http(s) URIのときだけリンクにする（MUST）。作者がない、またはライセンスがない画像は表示しない（MUST NOT）。派生画像を生成できなかった写真も表示しない（MUST NOT）。`schema:contentUrl`または`schema:subjectOf`の`schema:url`が絶対http(s) URIでない場合は、その項目だけを表示しない（MUST）。

#### Scenario: 画像と関連リンクを表示する

- **WHEN** recordに`schema:image`と`schema:subjectOf`がある
- **THEN** 詳細は画像と関連リンクを表示する

#### Scenario: 画像の帰属を表示する

- **WHEN** recordの`schema:image`に作者とライセンスがある
- **THEN** 詳細は画像の下に作者とライセンスを表示する

#### Scenario: URIのライセンスをリンクにする

- **WHEN** `schema:license`が絶対http(s) URIである
- **THEN** 詳細はライセンス名をそのURIへのリンクにする

#### Scenario: URIでないライセンスをテキストで示す

- **WHEN** recordの`schema:license`が「Public domain」のような絶対http(s) URIでない文字列である
- **THEN** 詳細はライセンスをリンクにせず、記録された文字列のままテキストで示す

#### Scenario: 帰属のない画像を出さない

- **WHEN** recordの`schema:image`に作者がない、またはライセンスがない（空文字列を含む）
- **THEN** 詳細はその画像を表示せず、他の項目を表示する

#### Scenario: 不正な画像URLを出さない

- **WHEN** `schema:image`の`schema:contentUrl`が絶対http(s) URIでない
- **THEN** 詳細は画像を表示せず、他の項目を表示する

#### Scenario: 派生画像のない写真を出さない

- **WHEN** 写真の取得または変換に失敗した
- **THEN** 詳細はその写真を表示せず、他の項目を表示する

### Requirement: 町字による地域の導出

ビルドは町字GeoJSONのポリゴンで全場所の地域を導出しなければならない（MUST）。どのポリゴンにも入らない場所の地域は「その他」とする（MUST）。

#### Scenario: 町字を導出する

- **WHEN** 場所の座標が町字ポリゴンに入る
- **THEN** その場所の地域はポリゴンの名前になる

#### Scenario: 町字を導出できない

- **WHEN** 場所の座標がどの町字ポリゴンにも入らない
- **THEN** その場所の地域は「その他」になる

### Requirement: 場所IDによる詳細の解決

場所詳細のURLは`urn:uuid:`のIDを受け取り、artifactから1件だけ解決する（MUST）。IDがない、重複する、またはartifactに存在しない場合は、詳細を表示せずエラーまたは404にする（MUST）。

#### Scenario: IDで詳細を解決する

- **WHEN** artifactに存在するIDを要求する
- **THEN** その場所の詳細を表示する

#### Scenario: 存在しないIDを要求する

- **WHEN** artifactにないIDを要求する
- **THEN** 404を返す

#### Scenario: 重複したIDを要求する

- **WHEN** 同じIDを持つ場所がartifactに2つある
- **THEN** 詳細はエラーを表示する

### Requirement: 実行時の外部取得をしない

場所ページはビルドartifactだけを読み、実行時に公開JSON-LD、OSMタグミラー、カテゴリ名辞書、WheelMap、Wikimediaを取得してはならない（MUST NOT）。写真はビルドで生成した派生画像だけを参照し、WikimediaのURLを出力してはならない（MUST NOT）。artifactが欠落または不正な場合は、外部へフォールバックせずデータエラーを表示する（MUST）。

#### Scenario: artifactだけで表示する

- **WHEN** 場所ページを表示する
- **THEN** ページはartifactの場所だけを使う

#### Scenario: 写真を外部から取得しない

- **WHEN** 場所ページを表示する
- **THEN** 写真の取得先はビルドで生成した派生画像だけである

#### Scenario: artifactが欠落している

- **WHEN** artifactが欠落または不正である
- **THEN** 場所ページはデータエラーを表示し、外部取得をしない

### Requirement: 旧データ源の削除

場所ページは`keyLocationsUri`と`key_locations.json`を参照してはならず（MUST NOT）、旧カテゴリIDと旧場所IDを受け付けない（MUST NOT）。カテゴリページのURLは`gif-poi`コード、詳細のURLは`urn:uuid:`のIDを使う（MUST）。

#### Scenario: 旧カテゴリURLを拒否する

- **WHEN** 旧カテゴリIDのURLを要求する
- **THEN** 404を返す

#### Scenario: 旧場所IDを拒否する

- **WHEN** `urn:uuid:`でない場所IDを要求する
- **THEN** 404を返す
