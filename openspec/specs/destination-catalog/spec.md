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

### Requirement: ビルド時の座標と分類の解決

ビルドは公開JSON-LDとカテゴリ名辞書を取得し、掲載entryのIDから座標と`gif-poi`コードを解決し、コードを辞書の名前へ引かなければならない（MUST）。IDが存在しない、座標が不正、`gif-poi`コードがない、複数ある、またはコードが辞書にない場合はビルドを失敗させる。辞書を取得できない、または辞書の形式が不正な場合もビルドを失敗させる。旧`mainFacilities`、ハードコードしたグループ、実行時の外部取得へフォールバックしてはならない（MUST NOT）。

#### Scenario: 掲載IDの座標と分類を解決する

- **WHEN** 掲載IDが公開JSON-LDに存在する
- **THEN** artifactはそのIDの座標と分類を持つ

#### Scenario: 掲載IDが存在しない

- **WHEN** 掲載IDが公開JSON-LDに存在しない
- **THEN** ビルドは失敗する

#### Scenario: 分類コードが一意でない

- **WHEN** 掲載recordの`gif-poi`コードが0件または複数である
- **THEN** ビルドは失敗する

#### Scenario: 公開JSON-LDを取得できない

- **WHEN** ビルドが公開JSON-LDを取得できない
- **THEN** ビルドは失敗し、旧データを使わない

#### Scenario: 辞書にないコードを拒否する

- **WHEN** 掲載recordの`gif-poi`コードがカテゴリ名辞書にない
- **THEN** ビルドは失敗する

#### Scenario: カテゴリ名辞書を取得できない

- **WHEN** ビルドがカテゴリ名辞書を取得できない
- **THEN** ビルドは失敗し、ハードコードした名前を使わない

#### Scenario: カテゴリ名辞書の形式が不正である

- **WHEN** カテゴリ名辞書が`schema:DefinedTermSet`の構造を持たない、またはtermのコードか名前が空である
- **THEN** ビルドは失敗する

### Requirement: gif-poiコードによる表示グループ

ビルドは掲載entryを`gif-poi`コードごとの表示カテゴリへまとめ、カテゴリ名辞書の定義順に出力しなければならない（MUST）。カテゴリはコードを識別子とし、辞書の日本語名を持つ。掲載entryのないカテゴリは出力しない。コードを統合したり、目録の値でカテゴリを上書きしたりしてはならない（MUST NOT）。

#### Scenario: コードに対応するグループへ出力する

- **WHEN** 掲載entryのコードが辞書にある
- **THEN** そのentryはコードのカテゴリへ辞書の名前で出力される

#### Scenario: 空のグループを出力しない

- **WHEN** カテゴリに掲載entryがない
- **THEN** そのカテゴリはartifactに出力されない

#### Scenario: 未知のコードを拒否する

- **WHEN** 掲載entryのコードが辞書にない
- **THEN** ビルドは失敗する

#### Scenario: 異なるコードを統合しない

- **WHEN** 掲載entryのコードがそれぞれ1302と1304である
- **THEN** それらは別々のカテゴリへ出力される

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
