## Purpose

この機能は、transit-configとGTFS入力をbuildの明示的な前提にし、設定し忘れを成功扱いにせず、再現可能なCI検証を提供する。

## ADDED Requirements

### Requirement: Build requires a valid transit configuration

ビルド SHALL、有効なtransit-configが存在しない場合、または設定がJSONとして不正な場合に、成功結果を返す前に失敗する。設定にはデータベース設定、1件以上のagency、各agencyのGTFS入力元を含める。ビルドはこの検証を省略しない。

#### Scenario: transit-configが存在しない

- **WHEN** 利用者がtransit-configを用意せずにbuildを実行する
- **THEN** buildは非ゼロの終了状態で失敗し、成功したbuildとして扱われない

#### Scenario: transit-configが不正または不完全である

- **WHEN** transit-configのJSON、agency、またはGTFS入力元が不正である
- **THEN** buildは非ゼロの終了状態で失敗し、Next.jsの成功結果を後続処理へ渡さない

### Requirement: Build requires a successful GTFS import

ビルド SHALL、設定されたGTFS入力を読み取れない場合、GTFSとして検証できない場合、またはアプリケーションが利用できる必須の交通データを取り込めない場合に成功しない。取り込み結果が空であることを警告だけで済ませない。

#### Scenario: ローカルGTFS入力元が存在しない

- **WHEN** 有効なtransit-configが存在するが、指定されたGTFSファイルまたはディレクトリが存在しない
- **THEN** buildは非ゼロの終了状態で失敗する

#### Scenario: 必須データを含むGTFSを取り込める

- **WHEN** GTFS入力に少なくとも1件のagency、route、stop、trip、stop_time、および対応するサービス情報がある
- **THEN** GTFS取り込みは成功し、buildは次の工程へ進む

### Requirement: CI provides a non-secret synthetic transit fixture

CI SHALL、transit-configとGTFS入力をリポジトリ内の合成fixtureから明示的に用意する。transit入力の検証に本番GTFS、GitHub Secret、または外部GTFS URLを要求しない。

#### Scenario: Secretを利用できないPull Request

- **WHEN** forkからのPull RequestがCIを実行し、GitHub Secretを利用できない
- **THEN** CIはリポジトリ内の合成fixtureを使ってtransit-configとGTFS取り込みを検証できる

#### Scenario: 合成fixtureの設定をbuildへ渡す

- **WHEN** CIがtransit依存のbuild工程を開始する
- **THEN** CIは合成transit-configとローカルGTFS入力元を明示的に配置し、設定欠落とは異なる有効な入力としてbuildへ渡す

### Requirement: Synthetic fixture covers observed producer variations

合成fixture SHALL、現行のGTFS importerが扱うべき入力形式の変化を、実在する本番データを複製せずに検証できる。

#### Scenario: Unicode IDと任意項目の空値を扱う

- **WHEN** fixtureが日本語を含むserviceまたはtripのID、ゼロ埋めID、空の任意項目、route_short_nameの空値を含む
- **THEN** GTFS取り込みはIDをASCIIや数値へ変換せず、必須データを失わずに成功する

#### Scenario: サービス例外と終端属性を扱う

- **WHEN** fixtureがcalendar_datesの追加・削除例外、始端・終端のpickup/dropoff属性、shapeとのtrip対応を含む
- **THEN** GTFS取り込みは対応する交通データを成功扱いにし、入力を空データとして扱わない

#### Scenario: BOM、改行、列順の差を扱う

- **WHEN** fixtureの一部がBOMまたはCRLFを含み、stop_timesの列順が異なる
- **THEN** GTFS取り込みはヘッダーに基づいて列を解決し、入力形式だけを理由に失敗しない

### Requirement: Fixture licensing remains separate from application code

CI fixture SHALL、新たに作成した合成データで構成し、本番GTFSまたは第三者データをAGPLのアプリケーションコードへ取り込まない。第三者データを将来fixtureへ含める場合は、データのライセンスと帰属情報をコードのライセンスと別に明示する。

#### Scenario: 本番GTFSを含まない合成fixtureを配布する

- **WHEN** リポジトリがCI fixtureを配布する
- **THEN** fixtureは架空のagency、route、stop、trip、および時刻データだけで構成され、本番データの再配布を必要としない

#### Scenario: 第三者データをfixtureへ追加する

- **WHEN** 将来、第三者ライセンスのデータをfixtureへ含める
- **THEN** リポジトリは元データの提供者、出典、ライセンス、改変内容を別の帰属情報として保持し、AGPLだけを適用した表示をしない
