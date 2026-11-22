# Spec Delta

## REMOVED Requirements

### Requirement: ビルド時の座標と分類の解決

**Reason**: カテゴリ名辞書が廃止され、カテゴリは`schema:keywords`の`DefinedTerm`から解決する形になったため。

**Migration**: 「公開グラフからの座標とカテゴリの解決」を使う。

## MODIFIED Requirements

### Requirement: gif-poiコードによる表示グループ

ビルドは掲載entryを`gif-poi`コードごとの表示カテゴリへまとめ、`schema:DefinedTermSet`の`schema:hasDefinedTerm`の順に出力しなければならない（MUST）。カテゴリはコードを識別子とし、termの`schema:name`を表示名に持つ。複数のコードを持つ掲載entryは、各カテゴリへ同じentryを出力する。掲載entryのないカテゴリは出力しない。コードを統合したり、目録の値でカテゴリを上書きしたりしてはならない（MUST NOT）。

#### Scenario: コードに対応するグループへ出力する

- **WHEN** 掲載entryのコードがtermにある
- **THEN** そのentryはコードのカテゴリへtermの名前で出力される

#### Scenario: 空のグループを出力しない

- **WHEN** カテゴリに掲載entryがない
- **THEN** そのカテゴリはartifactに出力されない

#### Scenario: 語彙順で出力する

- **WHEN** 複数のカテゴリに掲載entryがある
- **THEN** カテゴリは`schema:hasDefinedTerm`の順に出力される

#### Scenario: 異なるコードを統合しない

- **WHEN** 掲載entryのコードがそれぞれ1302と1304である
- **THEN** それらは別々のカテゴリへ出力される

#### Scenario: 複数カテゴリのentryを各グループに出力する

- **WHEN** 掲載entryが2つのカテゴリtermを参照する
- **THEN** そのentryは両方のカテゴリへ同じ内容で出力される

#### Scenario: 未知のコードを拒否する

- **WHEN** Placeの`schema:keywords`が語彙にないtermを参照する
- **THEN** ビルドは失敗する

#### Scenario: 目録の値でカテゴリを変えない

- **WHEN** 目録のentryがグループの指定を持つ
- **THEN** ビルドはその値を使わず、コードのカテゴリへ出力する

## ADDED Requirements

### Requirement: 公開グラフからの座標とカテゴリの解決

ビルドは公開グラフとOSMタグミラーを取得し、掲載entryのIDから座標とカテゴリtermを解決し、termの`gif-poi`コードと`schema:name`をカテゴリに使わなければならない（MUST）。IDが存在しない、座標が不正、参照先termがない、コードが4桁でない、コードが重複する場合はビルドを失敗させる（MUST）。カテゴリtermを1つも参照しない掲載entryは、そのentryだけを除外して残りで出力する（MUST）。公開グラフを取得できない場合もビルドを失敗させる（MUST）。旧`mainFacilities`、ハードコードしたグループ、実行時の外部取得へフォールバックしてはならない（MUST NOT）。

#### Scenario: 掲載IDの座標とカテゴリを解決する

- **WHEN** 掲載IDが公開グラフに存在し、カテゴリtermを参照する
- **THEN** artifactはそのIDの座標と分類を持つ

#### Scenario: 掲載IDが存在しない

- **WHEN** 掲載IDが公開グラフに存在しない
- **THEN** ビルドは失敗する

#### Scenario: カテゴリtermを参照しない

- **WHEN** 掲載entryのPlaceが`schema:keywords`を持たない
- **THEN** そのentryだけを除外し、残りのentryでビルドは成功する

#### Scenario: 公開グラフを取得できない

- **WHEN** ビルドが公開グラフを取得できない
- **THEN** ビルドは失敗し、旧データを使わない

#### Scenario: 参照先termがない

- **WHEN** Placeの`schema:keywords`がグラフにないtermを参照する
- **THEN** ビルドは失敗する

#### Scenario: termのコードが不正または重複する

- **WHEN** termの`gif-poi`コードが4桁でない、または同じコードのtermが2つある
- **THEN** ビルドは失敗する
