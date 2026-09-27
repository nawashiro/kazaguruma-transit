# Data Model: ブックマーク可能な経路検索結果

## RouteSearchQuery

| Field | Type | Validation |
|---|---|---|
| origin | Location | lat -90..90、lng -180..180 |
| destination | Location | lat -90..90、lng -180..180 |
| time | string | 有効な既存local datetime文字列 |
| isDeparture | boolean | `true` / `false` |
| prioritizeSpeed | boolean | `true` / `false` |

住所文字列、loading、エラー、結果は検索再現に不要なのでURLへ含めない。

## RouteSearchUrlState

- valid: 検証済み`RouteSearchQuery`を持ち、検索を開始できる。
- invalid: 日本語の理由を持ち、API呼び出しを禁止する。

## RouteResultViewModel

既存APIの最良journeyとstopsを、`IntegratedRouteDisplay`、PDF、カレンダーが共有する表示モデルへ一度だけ変換する。結果なしも`type: none`の明示状態として扱う。
