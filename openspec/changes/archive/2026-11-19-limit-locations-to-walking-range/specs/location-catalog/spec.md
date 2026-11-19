# Spec Delta

## REMOVED Requirements

### Requirement: 公開JSON-LDの全recordの一覧化

**Reason**: 徒歩圏外の施設を一覧から外し、経路検索で到達できる行き先に揃えるため。

**Migration**: 「目的地目録の候補の一覧化」を使う。

## ADDED Requirements

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
