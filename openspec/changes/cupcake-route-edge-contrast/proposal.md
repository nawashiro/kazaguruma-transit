# Proposal

## Why

結果ページの経路図で、乗車区間の線に使っている`secondary`は、cupcakeでは地色`base-300`とのコントラストが1.11:1しかなく、ほぼ見えない。停留所と時刻だけが浮いて、どの停留所からどの停留所まで乗るのかが線で追えない。cupcakeの`secondary-content`は地色とのコントラストが6.29:1あり、線として読める。

## What Changes

- 乗車区間の線（`SecondaryEdge`）の色を、cupcakeでは`secondary-content`、darkでは従来どおり`secondary`にする。ダークテーマの見た目は変えない。
- 徒歩区間の線（`accent`）、停留所の丸、路線名の文字は変えない。
- 線が読めることを、テーマごとのクラス契約テストで保つ。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `route-search-results`: 乗車区間の線の色をテーマごとに定め、cupcakeで経路図の線を地色から区別できるようにする要件を追加する。

## Impact

`src/components/features/IntegratedRouteDisplay.tsx`、`src/components/features/__tests__/IntegratedRouteDisplay.test.tsx`。依存パッケージ、データ、URL、APIの変更なし。ダークテーマの描画は変えない。
