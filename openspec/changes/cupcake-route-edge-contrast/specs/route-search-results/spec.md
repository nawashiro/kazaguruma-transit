# Spec Delta

## ADDED Requirements

### Requirement: 乗車区間の線のテーマ別の色

経路図の乗車区間の線は、cupcakeテーマでは`secondary-content`の色で描かなければならない（MUST）。cupcakeの`secondary`は地色`base-300`とのコントラストが1.11:1で、線として識別できない。darkテーマでは`secondary`のままとし、見た目を変えない（MUST）。徒歩区間の線、停留所の丸、路線名の文字は、この要件で変えない（MUST NOT）。

#### Scenario: cupcakeで乗車区間を表示する

- **WHEN** cupcakeテーマで経路のある結果ページを表示する
- **THEN** 乗車区間の線は地色から区別できる濃さで描かれ、停留所から停留所までの区間を線で追える
- **THEN** 徒歩区間の線と停留所の丸は、テーマの既定の色のままである

#### Scenario: darkで乗車区間を表示する

- **WHEN** darkテーマで経路のある結果ページを表示する
- **THEN** 乗車区間の線は`secondary`の色で描かれる
