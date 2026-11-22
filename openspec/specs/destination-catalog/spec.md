# destination-catalog Specification

## Purpose
ルートページと場所検索ページが共有する目的地目録を、公開JSON-LDのID参照として維持し、ルートページに掲載する候補を明示的に選ぶ。

## Requirements

### Requirement: 公開JSON-LDのIDによる同一性

目録の各entry MUST `urn:uuid:`形式のIDを持ち、同じIDを重複して持ってはならない（MUST NOT）。IDは公開JSON-LDのrecordを指す。名前は人間用の任意コメントであり、同一性と表示の判定に使ってはならない（MUST NOT）。

#### Scenario: IDでentryを識別する

- **WHEN** 目録のentryを読む
- **THEN** IDが同一性を示し、名前は表示用として扱われる

#### Scenario: 重複IDを拒否する

- **WHEN** 同じIDを持つentryが2つある
- **THEN** 目録の検証は失敗する

### Requirement: 徒歩圏と名前解決による候補抽出

目録の更新は、経路検索の停留所選択と同じ碁盤目補正後の徒歩距離を使い、`TRANSIT_PARAMS.DEFAULT_SEARCH_RADIUS`（500m）以内のrecordだけを候補にしなければならない（MUST）。上限ちょうどの距離は候補に含める。候補の名前は、`rdfs:seeAlso`にあるOSM要素の`name`を使う（MUST）。OSM名を解決できないrecordは、既存entryの名前がある場合に限り候補にし、既存entryがなければ候補にしない（MUST）。

#### Scenario: 上限以内のrecordを候補にする

- **WHEN** 最寄り停留所までの補正徒歩距離が500m以下である
- **THEN** そのrecordは目録の候補になる

#### Scenario: 上限超のrecordを候補にしない

- **WHEN** 最寄り停留所までの補正徒歩距離が500mを超える
- **THEN** そのrecordは目録に追加されない

#### Scenario: OSM関連付けのない新しいrecordを候補にしない

- **WHEN** recordが`rdfs:seeAlso`にOSM要素を持たず、既存entryもない
- **THEN** そのrecordは目録に追加されない

#### Scenario: OSM名がない既存entryを候補に残す

- **WHEN** recordのOSM要素に空でない`name`がなく、既存entryの名前がある
- **THEN** そのrecordは候補になり、既存entryの名前をコメントとして保つ

#### Scenario: 掲載entryが徒歩圏外になる

- **WHEN** 既存の掲載entryが500mを超える
- **THEN** 目録の更新はそのIDを報告し、目録から除く

### Requirement: ルートページ掲載の明示的な選択

目録の各entry MUST `includeInRouteForm`を持つ。新しいentryの初期値は`false`とする。ルートページは`includeInRouteForm`が`true`のentryだけを表示しなければならない（MUST）。

#### Scenario: 新しい候補を掲載しない

- **WHEN** 候補が追加され、`includeInRouteForm`を指定しない
- **THEN** `false`で追加され、ルートページに表示されない

#### Scenario: 掲載を選んだentryを表示する

- **WHEN** entryの`includeInRouteForm`が`true`である
- **THEN** ルートページはそのentryを表示する

### Requirement: 目録更新での掲載選択の保持

目録の再更新は、同じIDが残るentryの`includeInRouteForm`を保持しなければならない（MUST）。名前は人間用のコメントであり、更新時にOSMの名前で置き換えてよい。OSM名がないentryは既存の名前を保つ。新しい候補は`false`で追加する。掲載entryが徒歩圏外になった、または公開JSON-LDから消えたときは、そのIDを報告する。

#### Scenario: 既存entryの掲載選択を保持する

- **WHEN** 既存entryが候補に残る
- **THEN** そのentryの`includeInRouteForm`は変わらない

#### Scenario: 新しい候補を未掲載で追加する

- **WHEN** 新しいrecordが候補になる
- **THEN** `includeInRouteForm: false`で追加される

#### Scenario: 掲載entryが候補から外れる

- **WHEN** 掲載entryが候補から外れる
- **THEN** 目録の更新はそのIDを報告し、目録から除く

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

### Requirement: OSMタグミラーからの表示名

ビルドはOSMタグミラーを取得し、掲載entryの`rdfs:seeAlso`にあるOSM要素の`name`を表示名に使わなければならない（MUST）。目録の名前は表示に使ってはならない（MUST NOT）。OSM関連付けまたは空でない`name`がない掲載entryは、そのentryをartifactに含めず、残りのentryで出力する（MUST）。ビルドを失敗させてはならない（MUST NOT）。

#### Scenario: OSMの名前を表示する

- **WHEN** 掲載entryのOSM要素に`name`がある
- **THEN** ルートページはその`name`を表示する

#### Scenario: 目録の名前を表示に使わない

- **WHEN** 目録の名前がOSMの`name`と異なる
- **THEN** ルートページはOSMの`name`を表示する

#### Scenario: 掲載entryのOSM名がない

- **WHEN** 掲載entryにOSM関連付けまたは空でない`name`がない
- **THEN** そのentryはartifactに含まれず、残りの掲載entryが出力される
- **THEN** ビルドは成功する

#### Scenario: OSMタグミラーを取得できない

- **WHEN** ビルドがOSMタグミラーを取得できない
- **THEN** ビルドは失敗する

### Requirement: 実行時の外部取得をしない

ルートページはビルドartifactだけを読み、目録または公開JSON-LDを実行時に取得してはならない（MUST NOT）。artifactが欠落または不正な場合は、外部へフォールバックせずデータエラーを表示する。

#### Scenario: artifactだけで表示する

- **WHEN** ルートページを表示する
- **THEN** ルートページはartifactのentryだけを使う

#### Scenario: artifactが欠落している

- **WHEN** artifactが欠落または不正である
- **THEN** ルートページはデータエラーを表示し、外部取得をしない

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
