# Spec Delta

## MODIFIED Requirements

### Requirement: 徒歩圏と名前解決による候補抽出

目録の更新は、経路検索の停留所選択と同じ徒歩ネットワーク上の徒歩距離を使い、`TRANSIT_PARAMS.DEFAULT_SEARCH_RADIUS`（500m）以内のrecordだけを候補にしなければならない（MUST）。直線距離に√2を掛けた補正徒歩距離で判定してはならない（MUST NOT）。上限ちょうどの距離は候補に含める。候補の名前は、`rdfs:seeAlso`にあるOSM要素の`name`を使う（MUST）。OSM名を解決できないrecordは、既存entryの名前がある場合に限り候補にし、既存entryがなければ候補にしない（MUST）。

#### Scenario: 上限以内のrecordを候補にする

- **WHEN** 最寄り停留所までの徒歩距離が500m以下である
- **THEN** そのrecordは目録の候補になる

#### Scenario: 上限超のrecordを候補にしない

- **WHEN** 最寄り停留所までの徒歩距離が500mを超える
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
