# location-facts Specification

## Purpose

場所詳細に、来訪前の確認とデータ修正に使える電話・ウェブサイト・Wikipedia・OpenStreetMap編集先を、ビルド時に解決したデータから提供する。

## Requirements

### Requirement: 電話番号の正規化

ビルドはOSMタグの`phone`または`contact:phone`を、`+81`・`81`の接頭辞と区切り文字を外し、千代田区の固定電話`03-NNNN-NNNN`（10桁）または`03-XXX-XXXX`（9桁）へ正規化しなければならない（MUST）。正規化できない値は表示しない（MUST NOT）。詳細は`tel:`リンクで表示する（MUST）。

#### Scenario: 国際表記を正規化する

- **WHEN** `phone`が`+81-3-32642111`である
- **THEN** 表示は`03-3264-2111`、リンクは`tel:0332642111`になる

#### Scenario: 区切りだけを外す

- **WHEN** `phone`が`03-3262-9191`である
- **THEN** 表示は`03-3262-9191`のままになる

#### Scenario: 正規化できない値を隠す

- **WHEN** `phone`が`03`で始まる10桁または9桁に正規化できない
- **THEN** 電話番号を表示せず、他の項目を表示する

### Requirement: ウェブサイトの表示

ビルドは`website`を`contact:website`より優先して解決し、絶対http(s) URIだけを表示する（MUST）。値がない、または絶対http(s) URIでない場合は表示しない（MUST NOT）。リンクは新しいタブで開き、`rel="noopener noreferrer"`を付ける（MUST）。

#### Scenario: ウェブサイトを表示する

- **WHEN** `website`が絶対http(s) URIである
- **THEN** 詳細は「ウェブサイトを開く」リンクを表示する

#### Scenario: 不正なURLを隠す

- **WHEN** `website`が絶対http(s) URIでない
- **THEN** 詳細はウェブサイトを表示せず、他の項目を表示する

### Requirement: Wikipediaの解決順

ビルドは日本語を優先し、OSMの`wikipedia`タグ、Wikidataミラーの`jawiki`、OSMの他言語、Wikidataミラーの`enwiki`の順でWikipedia記事を解決する（MUST）。`lang:Title`を`https://{lang}.wikipedia.org/wiki/{Title}`へ変換し、タイトルをURLエンコードする（MUST）。どれもない場合は表示しない（MUST NOT）。

#### Scenario: OSMの日本語記事を使う

- **WHEN** `wikipedia`が`ja:千代田区役所`である
- **THEN** リンクは`https://ja.wikipedia.org/wiki/%E5%8D%83%E4%BB%A3%E7%94%B0%E5%8C%BA%E5%BD%B9%E6%89%80`になる

#### Scenario: Wikidataの日本語記事を使う

- **WHEN** OSMに`wikipedia`がなく、Wikidataミラーに`jawiki`がある
- **THEN** リンクは日本語版Wikipediaの記事になる

#### Scenario: 英語記事へフォールバックする

- **WHEN** 日本語の記事がどちらにもなく、OSMまたはWikidataに英語記事がある
- **THEN** リンクは英語版Wikipediaの記事になる

#### Scenario: 記事がない

- **WHEN** OSMにもWikidataミラーにもWikipedia記事がない
- **THEN** 詳細はWikipediaリンクを表示しない

### Requirement: OSM編集リンク

場所詳細の上部に、`https://www.openstreetmap.org/edit?{type}={id}`へのリンクを表示する（MUST）。`type`は`node`・`way`・`relation`のいずれかとする（MUST）。可視文言は「編集する（OpenStreetMapを開きます）」とし、新しいタブで開くことを支援技術へ伝える（MUST）。`aria-label`で可視文言を上書きしてはならない（MUST NOT）。

#### Scenario: nodeの編集リンク

- **WHEN** OSM要素が`node/1420770185`である
- **THEN** リンクは`https://www.openstreetmap.org/edit?node=1420770185`になる

#### Scenario: wayの編集リンク

- **WHEN** OSM要素が`way/145408909`である
- **THEN** リンクは`https://www.openstreetmap.org/edit?way=145408909`になる

#### Scenario: 上部に表示する

- **WHEN** 場所詳細を表示する
- **THEN** 編集リンクは見出しの近くに表示される

### Requirement: 基本情報の欠落項目

場所詳細は「基本情報」に電話、ウェブサイト、Wikipediaを表示し、値がある項目だけを出さなければならない（MUST）。すべての項目がない場合は基本情報セクションを表示しない（MUST NOT）。

#### Scenario: 一部の項目だけを表示する

- **WHEN** 電話とウェブサイトがあり、Wikipediaがない
- **THEN** 基本情報は電話とウェブサイトを表示し、Wikipediaを表示しない

#### Scenario: すべての項目がない

- **WHEN** 電話、ウェブサイト、Wikipediaのどれもない
- **THEN** 基本情報セクションを表示しない

### Requirement: ビルド時のWikidataミラー取得

ビルドは`wikidataMirrorUri`からWikidataミラーを取得し、`entities`の`sitelinks`を使わなければならない（MUST）。取得できない、または形式が不正な場合はビルドを失敗させる（MUST）。

#### Scenario: Wikidataミラーを使う

- **WHEN** ビルドが`entities`と`sitelinks`を持つWikidataミラーを取得する
- **THEN** Wikipediaの解決にそのsitelinkを使う

#### Scenario: Wikidataミラーを取得できない

- **WHEN** ビルドが`wikidataMirrorUri`を取得できない
- **THEN** ビルドは失敗する

#### Scenario: Wikidataミラーの形式が不正である

- **WHEN** Wikidataミラーに`entities`がない、またはentityの形式が不正である
- **THEN** ビルドは失敗する

### Requirement: 実行時の外部取得をしない

場所詳細はビルドartifactだけを読み、実行時にOSM、Wikidata、Wikipediaへ取得要求をしてはならない（MUST NOT）。参照リンクへの遷移だけを許可する（MUST）。

#### Scenario: artifactだけで表示する

- **WHEN** 場所詳細を表示する
- **THEN** 電話、ウェブサイト、Wikipedia、編集リンクはartifactの値だけを使う

#### Scenario: 参照先はリンクとしてのみ使う

- **WHEN** 利用者が参照リンクを選ぶ
- **THEN** ブラウザは参照先へ遷移し、ページ側は取得要求をしない
