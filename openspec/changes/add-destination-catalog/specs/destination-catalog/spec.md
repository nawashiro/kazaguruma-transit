# Spec Delta

## Purpose

ルートページと場所検索ページが共有する目的地目録を、公開JSON-LDのID参照として維持し、ルートページに掲載する候補を明示的に選ぶ。

## ADDED Requirements

### Requirement: 公開JSON-LDのIDによる同一性

目録の各entry MUST `urn:uuid:`形式のIDを持ち、同じIDを重複して持ってはならない（MUST NOT）。IDは公開JSON-LDのrecordを指す。名前は人間用の任意コメントであり、同一性と表示の判定に使ってはならない（MUST NOT）。

#### Scenario: IDでentryを識別する

- **WHEN** 目録のentryを読む
- **THEN** IDが同一性を示し、名前は表示用として扱われる

#### Scenario: 重複IDを拒否する

- **WHEN** 同じIDを持つentryが2つある
- **THEN** 目録の検証は失敗する

### Requirement: 徒歩圏とOSM関連付けによる候補抽出

目録の更新は、経路検索の停留所選択と同じ碁盤目補正後の徒歩距離を使い、`TRANSIT_PARAMS.DEFAULT_SEARCH_RADIUS`（500m）以内のrecordだけを候補にしなければならない（MUST）。上限ちょうどの距離は候補に含める。候補は、`rdfs:seeAlso`にOSM要素を持ち、OSMタグミラーに空でない`name`があるrecordに限る（MUST）。

#### Scenario: 上限以内のrecordを候補にする

- **WHEN** 最寄り停留所までの補正徒歩距離が500m以下である
- **THEN** そのrecordは目録の候補になる

#### Scenario: 上限超のrecordを候補にしない

- **WHEN** 最寄り停留所までの補正徒歩距離が500mを超える
- **THEN** そのrecordは目録に追加されない

#### Scenario: OSM関連付けのないrecordを候補にしない

- **WHEN** recordが`rdfs:seeAlso`にOSM要素を持たない
- **THEN** そのrecordは不完全として目録に追加されない

#### Scenario: OSMの名前がないrecordを候補にしない

- **WHEN** recordのOSM要素に空でない`name`がない
- **THEN** そのrecordは不完全として目録に追加されない

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

目録の再更新は、同じIDが残るentryの`includeInRouteForm`を保持しなければならない（MUST）。名前は人間用のコメントであり、更新時にOSMの名前で置き換えてよい。新しい候補は`false`で追加する。掲載entryが候補から外れたときは、そのIDを報告する。

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

ビルドは公開JSON-LDを取得し、掲載entryのIDから座標と`gif-poi`コードを解決しなければならない（MUST）。IDが存在しない、座標が不正、`gif-poi`コードがない、または複数ある場合はビルドを失敗させる。旧`mainFacilities`や実行時の外部取得へフォールバックしてはならない（MUST NOT）。

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

### Requirement: gif-poiコードによる表示グループ

ビルドは掲載entryを`gif-poi`コードに対応する表示グループへまとめ、定義した順に出力しなければならない（MUST）。掲載entryのないグループは出力しない。対応しないコードがある場合はビルドを失敗させる。

#### Scenario: コードに対応するグループへ出力する

- **WHEN** 掲載entryのコードがグループ定義にある
- **THEN** そのentryは対応するグループに出力される

#### Scenario: 空のグループを出力しない

- **WHEN** グループに掲載entryがない
- **THEN** そのグループはartifactに出力されない

#### Scenario: 未知のコードを拒否する

- **WHEN** 掲載entryのコードがグループ定義にない
- **THEN** ビルドは失敗する

### Requirement: OSMタグミラーからの表示名

ビルドはOSMタグミラーを取得し、掲載entryの`rdfs:seeAlso`にあるOSM要素の`name`を表示名に使わなければならない（MUST）。目録の名前は表示に使ってはならない（MUST NOT）。OSM関連付けまたは空でない`name`がない掲載entryがある場合、ビルドを失敗させる。

#### Scenario: OSMの名前を表示する

- **WHEN** 掲載entryのOSM要素に`name`がある
- **THEN** ルートページはその`name`を表示する

#### Scenario: 目録の名前を表示に使わない

- **WHEN** 目録の名前がOSMの`name`と異なる
- **THEN** ルートページはOSMの`name`を表示する

#### Scenario: 掲載entryのOSM名がない

- **WHEN** 掲載entryにOSM関連付けまたは空でない`name`がない
- **THEN** ビルドは失敗する

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
