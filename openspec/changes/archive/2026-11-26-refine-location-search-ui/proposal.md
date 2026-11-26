# Proposal

## Why

住所検索の候補一覧は入力欄の直下に並ぶだけで何の一覧か分かる場所にあるのに、「目的地の候補から選ぶ」という見出しと「1件の候補があります」という件数が二重に並び、入力の流れを止めている。さらに候補は押せる場所に見えず、選択肢だと気づかれにくい。見出し相当の「目的地」「出発地」などの文字も本文と同じ16pxで、区切りの強さが伝わらない。

入力欄の補足文「建物名だけでも大丈夫な場合がほとんどです。」は、地点索引が名前と住所の両方で引ける現在の挙動と合っていない。利用者に伝えるべきは何を入れればよいかの一言である。

## What Changes

- 候補一覧の見出しと件数の行を画面から消す。一覧の名前は支援技術向けの `目的地の候補` に、件数は非表示のまま読み上げだけに残す。
- 候補一覧の各項目に、ポインターの形と背景色の変化を付け、押せる場所だと分かるようにする。入力グループの地色と同じ色を指定していたため見えなくなっていたhoverを、地色に対して実際に差が出る色へ変える。
- 「目的地」「出発地」「日時」「優先条件」の見出しを20pxへ、「名前で検索」「よく利用される施設から選択」を18pxへ上げ、本文16pxとの階層を作る。
- 住所欄の補足文を「住所か建物名を入力してください。」へ変える。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `route-search-form`: 候補一覧の見出しと件数の見せ方、候補項目のhoverとポインター、見出しの文字サイズ、住所欄の補足文を規定する。

## Impact

- クライアント: `src/components/features/LocationCandidates.tsx`、`DestinationSelector.tsx`、`OriginSelector.tsx`、`LocationFieldset.tsx`、`DateTimeSelector.tsx`、`LocationSuggestions.tsx`、`HomeRouteForm.tsx`。
- テスト: `DestinationSelector.test.tsx`、`OriginSelector.test.tsx`、`src/app/__tests__/page.test.tsx`。一覧のアクセシブルな名前と件数表示の期待値を更新する。
- 仕様: `route-search-form`。
