# 補正後徒歩距離によるバス停候補の上限

## Why

バス停候補の絞り込みは直線距離500mで行う。碁盤目街路の最悪補正（√2）後の徒歩距離では上限が約707mになり、想定より遠くまで歩く経路を返すことがある。候補の採用判定でも同じ√2補正を使い、最悪経路の徒歩を500m以内に保つ。

## What Changes

- 周辺バス停の絞り込みは、直線距離を碁盤目補正した徒歩距離で判定する。
- 従来経路（最寄りバス停1件）も同じ上限を適用する。補正徒歩距離が上限を超えるとき、従来経路は経路なしとして返し、既存の周辺バス停経路にフォールバックする。
- `DEFAULT_SEARCH_RADIUS` のコメントを「最悪徒歩距離の上限（メートル）」に更新する。
- 絞り込み対象を最初の10件に限定している `getStopsWithinRadius` の問題は、このchangeの対象外とする。

## Impact

- 新しいcapability spec: `stop-candidate-selection`
- 影響する実装: `src/lib/transit/transit-service.ts`（絞り込みと従来経路の判定）、`src/lib/transit/transit-params.ts`（コメント）
- 新規テスト: `src/lib/transit/__tests__/`
