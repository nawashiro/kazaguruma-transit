# Proposal

## Why

経路検索と目的地目録は、高齢者の歩行速度3km/hで10分（500m）を超える地点を対象外にしている。しかし、行く必要のある場所には遠くても行くしかなく、科学技術館のように子どもなら区役所から歩ける場所も、一律に対象外となる。さらに、名前で検索した地点には徒歩距離がまったく付かないため、遠い地点を選んでから「経路が見つかりません」と知るしかない。

## What Changes

- 経路検索と目的地目録の徒歩距離上限を10分（500m）から15分（750m）へ広げる。歩行速度3km/hで15分は750mであり、`TRANSIT_PARAMS`の上限と警告線を別の定数に分ける。
- 最寄り停留所までの徒歩距離が500mを超える地点に「バス停から遠い」を警告として示す。地点は消さない。
- 最寄り停留所までの徒歩距離が750mを超える地点を「バス停から遠すぎ」として選択不能にする。地点は消さない。
- 名前索引の検索候補と逆引きの応答に、最寄り停留所までの徒歩距離を加える。出発地と目的地の両方に適用する。
- **BREAKING** 750mを超える地点は、地点候補として選べなくなる。地点詳細のリンクから目的地を渡した場合も、経路検索の結果で理由を示す。
- 結果画面の「徒歩で移動(Googleマップ)」の位置に、その経路で求めた徒歩距離と、500mを超えるときの警告を示す。
- 出発地または目的地の最寄り停留所が750mを超えるとき、結果画面は「経路が見つかりません」ではなく、その地点と徒歩距離を示す。
- 目的地目録は、候補ごとに最寄り停留所までの徒歩距離を記録する。目録の更新と地名索引の再生成を伴う。
- 経路の選択順位は変えない。遠さは情報として示し、到着時刻と総徒歩距離による比較はそのまま保つ。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `stop-candidate-selection`: 徒歩距離の上限を750mへ広げ、上限と警告線を別の定数にする。
- `destination-catalog`: 候補の抽出上限を750mへ広げ、候補ごとに徒歩距離を記録する。
- `location-search`: 名前索引と逆引きの応答に徒歩距離を加え、索引だけでなく徒歩ネットワークも使う。
- `route-search-form`: 遠い候補の警告と、750mを超える候補の選択不能を加える。
- `route-search-results`: 徒歩区間の距離と警告、および停留所から遠い地点による経路なしの説明を加える。

## Impact

`src/lib/transit/transit-params.ts`、`src/lib/transit/stop-selection.ts`、`src/lib/transit/stop-access.ts`（新規）、`src/lib/transit/transit-service.ts`、`src/lib/transit/route-result-model.ts`、`src/lib/location/destination-catalog.ts`、`src/lib/location/geocode-search.ts`、`src/app/api/geocode/route.ts`、`src/components/features/LocationCandidates.tsx`、`LocationFieldset.tsx`、`LocationSuggestions.tsx`、`IntegratedRouteDisplay.tsx`、`src/types/core.ts`、`src/types/route-destinations.ts`、`scripts/update-destinations.ts`、`scripts/generate-location-artifact.ts`、`data/destinations.json`、`docs/how-to/update-destinations.md`。

依存パッケージの追加なし。外部サービスへの問い合わせの追加なし。徒歩ネットワークは既存のartifactを使い、プロセス内に一度だけ距離場を組み立てる。
