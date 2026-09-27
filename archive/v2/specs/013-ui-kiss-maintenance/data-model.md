# Data Model: UI KISS観点の整備

本機能では新規永続化を行わない。以下は、複数の表示面が共有する一時的な意味モデルと変換結果である。

## RouteDisplayModel

画面表示とPDF出力が共有する経路の意味モデル。

| Field | Type | Required | Description |
|---|---|---:|---|
| originStop | StopDisplayInfo | yes | 出発側の停留所 |
| destinationStop | StopDisplayInfo | yes | 到着側の停留所 |
| segments | RouteSegment[] | yes | 直通または乗換を表す順序付き区間 |
| routeType | `direct` | `transfer` | `none` | yes | 経路の有無と形態 |
| walkingLinks | WalkingLink[] | no | 出発地・目的地と停留所間の徒歩区間 |
| selectedDateTime | string | no | 利用者が選択した日時 |
| memosByStop | Map/string-keyed memo map | no | 停留所に紐づく表示用メモ |

### StopDisplayInfo

停留所名、ID、距離、利用可能な緯度経度を持つ。緯度経度がない場合も表示は継続し、徒歩リンクだけを省略する。

### RouteSegment

| Field | Type | Required | Description |
|---|---|---:|---|
| routeId | string | yes | 路線識別子 |
| routeName | string | yes | 表示路線名 |
| fromStopName | string | yes | 区間出発停留所 |
| toStopName | string | yes | 区間到着停留所 |
| departureTime | string | no | 不明なら不明状態として扱う |
| arrivalTime | string | no | 不明なら不明状態として扱う |
| transferStop | StopDisplayInfo | no | 次区間への乗換停留所 |

### RouteDisplayModel state rules

- `none` は経路なし表示であり、空配列と成功経路を同一視しない。
- 到着時刻の概算は、既存の直通・乗換ルールを共通変換で適用する。
- 画面とPDFは、同じ区間・時刻・メモの意味を表示するが、HTML/CSSレイアウトは共有しない。

## GeocodingSearchState

出発地・目的地が共有する検索状態。

```text
idle
├── submitting
├── success(Location)
├── empty(message)
├── rate-limited
└── error(message)
```

- 空入力は通信前に検証エラーとする。
- 地域補完は既存の千代田区ルールを維持する。
- 429は一般エラーと混同せず、既存のレート制限モーダルへ接続する。
- GPS取得はこの状態モデルの検索部分を再利用するが、出発地固有の副作用として分離する。

## BusStopProjection

009のmoderation snapshotを表示用に変換した結果。

| Field | Type | Description |
|---|---|---|
| posts | DiscussionPost[] | BusStopで絞り込んだ投稿。承認状態はsnapshotの判定を使用 |
| evaluations | PostEvaluation[] | approved投稿に対する評価 |
| postsWithStats | PostWithStats[] | 投稿と評価統計の結合結果 |
| topPostByStop | Map<stopName, PostWithStats> | 各停留所の代表メモ |
| approvalState | `approved` \| `unapproved` \| `unknown` | 009のsnapshot状態を保持 |

### BusStopProjection rules

- primary eventを投稿の正本とし、approval eventは対象投稿IDの結合結果だけで承認状態を決める。
- `unknown` は未承認として確定除外せず、評価・集計の扱いは既存009契約に従う。
- 同じsnapshotから画面表示とPDF用代表メモを生成し、relay readを投影関数内で追加しない。

## Button contract state

共通UIの一時表示状態。

| State | Meaning |
|---|---|
| default | 通常操作可能 |
| disabled | 利用者操作不可 |
| loading | 処理中。disabledとbusy表示を伴う |
| iconOnly | 可視テキストなし。アクセシブルな名前を必須とする |
| joined | 結合UI内で角丸を変更する。利用側クラスの文字列解析ではなく明示指定とする |
