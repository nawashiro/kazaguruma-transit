# Data Model: 後続ページ責務分離

本機能では新規永続化を行わない。以下は、ページ内の責務間で受け渡す一時状態と表示契約である。

## 1. RouteSearchState

経路検索ページの利用者向け状態。既存の入力・APIレスポンス・表示モデルを置き換えるのではなく、責務間の境界を明示する。

| State | Required data | Meaning |
|---|---|---|
| `input` | origin, destination, dateTime, isDeparture, prioritizeSpeed | 検索可能な入力状態 |
| `loading` | request sequence | 最新の検索要求を処理中 |
| `success` | route display data, memo data | 経路表示とPDFに渡せる結果 |
| `empty` | message | 経路なし。成功経路と混同しない |
| `rate-limited` | user-facing message | レート制限モーダルへ接続 |
| `error` | Japanese message | 再試行可能な通信・API失敗 |
| `reset` | default input | 入力と結果を初期状態へ戻す |

### Rules

- 必須入力がない場合は通信を開始しない。
- 最新要求の結果だけが現在の状態を更新する。
- `RouteDisplayModel`、PDF入力、BusStop memoの意味は既存013契約を再利用する。
- URLの目的地ディープリンク読み込みと履歴処理は、既存の外部挙動を維持する。

## 2. LocationListState

場所一覧ページのデータ・選択・位置処理の状態。

| State/field | Type | Meaning |
|---|---|---|
| categories | category groups | 読み込んだカテゴリと場所一覧 |
| activeCategory | string or null | 現在表示するカテゴリ |
| locations | location list | 現在カテゴリの表示対象 |
| sortMode | `default` or `distance` | 表示順 |
| position | coordinates or null | 現在地または住所検索で得た位置 |
| loading | boolean | データ・位置・検索の処理中状態（責務ごとに混同しない） |
| error | Japanese message or null | 一覧を継続利用できる範囲のエラー |
| selectedLocation | location or null | 詳細モーダルの対象 |
| selectedArea | string or null | GeoJSONに基づくエリア名 |

### Rules

- カテゴリ選択はカテゴリデータと独立して更新できる。
- 位置取得・住所検索の失敗は、既存一覧を表示できる場合に一覧全体を壊さない。
- 最新の位置要求・詳細要求だけが現在の選択を更新する。
- 距離計算は既存の単位・丸め・並べ替え順を維持する。

## 3. DiscussionMetaReadState

会話タブが表示するメタデータ取得結果。009仕様の意味を保持する。

| Field | Type | Meaning |
|---|---|---|
| discussion | Discussion or null | 最新の会話メタデータ |
| isLoading | boolean | 取得中。known-data表示時は既存契約に従う |
| error | Japanese message or null | 取得失敗 |
| completionReason | existing completion reason or null | EOSE、timeout等の完了理由 |
| reload | async action | 同じread契約で再取得 |
| source/known metadata | existing cache data | 暫定表示と取得実績 |

### Rules

- naddrから得た会話識別条件を既存のread planへ渡す。
- relay選択、known-data cache、completion、partial/unknown、重複排除の規則は変更しない。
- `unknown`や未観測を不在・未承認として確定しない。
- 古い読み込み結果は新しい読み込み状態へ混入させない。

## 4. ResponsibilityBoundary

責務間の受け渡しを表す設計概念。永続化エンティティではない。

| Boundary | Input | Output | Must not do |
|---|---|---|---|
| Data acquisition | user/query parameters | typed raw result or error | UIレイアウトを決めない |
| State transition | event/result/error | current state | relayやDBへ直接アクセスしない |
| User operation | user event, current state | command/state event | 外部取得結果を直接描画しない |
| Presentation | current state, typed display data | accessible UI | 新しい取得・永続化を開始しない |

## 5. Lifecycle

```text
Route: input -> loading -> success/empty/rate-limited/error -> input/reset
Locations: loading -> ready -> category/position/detail action -> ready/error
Discussion: known/initial -> loading/partial -> complete/error -> reload -> loading
```

各状態遷移は公開URL、ブラウザ履歴、既存の画面文言・表示、アクセシビリティ属性を維持する。
