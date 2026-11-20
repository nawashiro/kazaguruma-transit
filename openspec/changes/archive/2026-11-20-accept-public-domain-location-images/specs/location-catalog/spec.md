# Spec Delta

## MODIFIED Requirements

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
