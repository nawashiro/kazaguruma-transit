# Spec Delta

## MODIFIED Requirements

### Requirement: 場所詳細の内容解決

場所詳細は、ID、OSM名、座標、カテゴリ名、導出地域を持つ（MUST）。`schema:image`の`schema:contentUrl`を写真の取得元に、`schema:subjectOf`の`schema:url`と`schema:name`を関連リンクに使う（MUST）。画像には`schema:creator.schema:name`の作者と`schema:license`のライセンスを添え、ライセンス名をリンクにする（MUST）。作者またはライセンスがない画像は表示しない（MUST NOT）。派生画像を生成できなかった写真も表示しない（MUST NOT）。画像またはリンクが絶対http(s) URIでない場合は、その項目だけを表示しない（MUST）。

#### Scenario: 画像と関連リンクを表示する

- **WHEN** recordに`schema:image`と`schema:subjectOf`がある
- **THEN** 詳細は画像と関連リンクを表示する

#### Scenario: 画像の帰属を表示する

- **WHEN** recordの`schema:image`に作者とライセンスがある
- **THEN** 詳細は画像の下に作者とライセンスを表示し、ライセンス名をリンクにする

#### Scenario: 帰属のない画像を出さない

- **WHEN** recordの`schema:image`に作者またはライセンスがない
- **THEN** 詳細はその画像を表示せず、他の項目を表示する

#### Scenario: 不正な画像URLを出さない

- **WHEN** `schema:image`の`schema:contentUrl`が絶対http(s) URIでない
- **THEN** 詳細は画像を表示せず、他の項目を表示する

#### Scenario: 派生画像のない写真を出さない

- **WHEN** 写真の取得または変換に失敗した
- **THEN** 詳細はその写真を表示せず、他の項目を表示する

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
