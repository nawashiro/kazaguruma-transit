# Spec Delta

## MODIFIED Requirements

### Requirement: 徒歩圏と名前解決による候補抽出

目録の更新は、経路検索の停留所選択と同じ徒歩ネットワーク上の徒歩距離を使い、`TRANSIT_PARAMS.MAX_WALK_TO_STOP_METERS`（750m）以内のrecordだけを候補にしなければならない（MUST）。直線距離に√2を掛けた補正徒歩距離で判定してはならない（MUST NOT）。上限ちょうどの距離は候補に含める。候補の名前は、`rdfs:seeAlso`にあるOSM要素の`name`を使う（MUST）。OSM名を解決できないrecordは、既存entryの名前がある場合に限り候補にし、既存entryがなければ候補にしない（MUST）。

#### Scenario: 上限以内のrecordを候補にする

- **WHEN** 最寄り停留所までの徒歩距離が537mである
- **THEN** そのrecordは目録の候補になる

#### Scenario: 上限超のrecordを候補にしない

- **WHEN** 最寄り停留所までの徒歩距離が750mを超える
- **THEN** そのrecordは目録に追加されない

#### Scenario: OSM関連付けのない新しいrecordを候補にしない

- **WHEN** recordが`rdfs:seeAlso`にOSM要素を持たず、既存entryもない
- **THEN** そのrecordは目録に追加されない

#### Scenario: OSM名がない既存entryを候補に残す

- **WHEN** recordのOSM要素に空でない`name`がなく、既存entryの名前がある
- **THEN** そのrecordは候補になり、既存entryの名前をコメントとして保つ

#### Scenario: 掲載entryが徒歩圏外になる

- **WHEN** 既存の掲載entryが750mを超える
- **THEN** 目録の更新はそのIDを報告し、目録から除く

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

## ADDED Requirements

### Requirement: 候補ごとの最寄り停留所までの徒歩距離

目録の各entryは、候補にしたときの最寄り停留所までの徒歩距離をメートルの整数で持たなければならない（MUST）。距離は、経路検索の停留所選択と同じ徒歩ネットワークで測る。同じIDが残るentryの距離は、更新のたびに測り直す。徒歩ネットワークから距離を求められないrecordは候補にしない。

#### Scenario: 候補の距離を記録する

- **WHEN** recordを候補にし、最寄り停留所までの徒歩距離が535mである
- **THEN** そのentryは`walkToStopMeters: 535`を持つ

#### Scenario: 残るentryの距離を測り直す

- **WHEN** 既存entryが候補に残り、徒歩距離が前回から変わる
- **THEN** entryの`walkToStopMeters`は新しい距離になる

#### Scenario: 距離を求められないrecord

- **WHEN** 徒歩ネットワークから最寄り停留所までの距離を求められない
- **THEN** そのrecordは候補にしない
