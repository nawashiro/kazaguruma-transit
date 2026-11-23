# Spec Delta

## Purpose

経路検索の実行回数と、利用者がどこで迷って離脱したかを、Google Analytics 4のイベントとして観測できるようにする。運営者自身のアクセスは識別して除外でき、位置情報を含む値は送らない。

## ADDED Requirements

### Requirement: 経路検索の実行計測

入力画面から経路検索を送信し、結果ページに検索結果が表示されたとき、`route_search`イベントを1回だけ送らなければならない（MUST）。`elapsed_ms`には入力画面を表示してから結果が表示されるまでの経過ミリ秒を含める。結果URLを直接開いた場合や再読み込みした場合は送らない（MUST NOT）。

#### Scenario: 入力画面から検索する

- **WHEN** 利用者が地点と日時を確定して検索し、結果ページに経路が表示される
- **THEN** `route_search`が1回送られ、`elapsed_ms`に入力画面からの経過時間が含まれる

#### Scenario: 結果URLを直接開く

- **WHEN** 利用者が結果URLをブックマークから開く、または結果ページを再読み込みする
- **THEN** `route_search`を送らない

### Requirement: 入力過程の計測

住所検索の結果、地点の確定、GPS取得の結果、地点未確定での送信を、それぞれ識別可能なイベントで送らなければならない（SHALL）。イベントはどの項目の・どの結果かを表すパラメーターを持ち、送信の成否は利用者の操作を妨げてはならない（MUST NOT）。

- `place_search`: `field`（`origin`または`destination`）と`outcome`（`found`、`not_found`、`failed`、`rate_limited`）
- `place_select`: `field`と`source`（`address`、`catalog`、`gps`、`detail`）
- `gps_result`: `outcome`（`granted`、`denied`、`timeout`、`unsupported`）
- `validation_failed`: `missing`（`origin`、`destination`、`both`）

#### Scenario: 住所検索に失敗する

- **WHEN** 利用者が目的地を名前で検索し、住所が見つからない
- **THEN** `place_search`が`field=destination`、`outcome=not_found`で送られ、画面には既存のエラー表示が出る

#### Scenario: GPSを拒否する

- **WHEN** 利用者が位置情報の利用を拒否する
- **THEN** `gps_result`が`outcome=denied`で送られ、出発地は未確定のまま名前検索を続けられる

#### Scenario: 地点を確定せずに送信する

- **WHEN** 目的地を確定せずに検索ボタンを押す
- **THEN** `validation_failed`が`missing=destination`で送られ、ページ遷移せず該当項目にエラーが出る

### Requirement: 結果後の行動の計測

結果ページでPDF出力またはカレンダー出力を開始したとき、`result_action`イベントを`action`（`pdf`または`calendar`）付きで送らなければならない（SHALL）。自動で読み込まれる停留所の議論・メモの表示は、利用者の操作ではないため送らない（MUST NOT）。

#### Scenario: PDFを出力する

- **WHEN** 利用者が結果ページでPDF出力を開始する
- **THEN** `result_action`が`action=pdf`で送られる

#### Scenario: 結果ページを開いただけ

- **WHEN** 利用者が結果ページを表示し、何も操作しない
- **THEN** `result_action`を送らない

### Requirement: 運営者トラフィックの識別

`?owner=1`を付けたページを開いた場合、そのブラウザに印を保存し、以後のページビューとイベントに内部トラフィックであることを示す`traffic_type=internal`を付けなければならない（MUST）。`?owner=0`で解除でき、どちらの場合もアドレスバーから`owner`パラメーターを除去する。この印は画面表示、検索結果、共有URLを変えてはならない（MUST NOT）。

#### Scenario: 運営者のブラウザを識別する

- **WHEN** 運営者が`?owner=1`付きのページを開き、同じブラウザで経路検索する
- **THEN** 以後のページビューとイベントに`traffic_type=internal`が付き、アドレスバーから`owner`が消える

#### Scenario: 識別を解除する

- **WHEN** 運営者が`?owner=0`付きのページを開く
- **THEN** 以後の送信に`traffic_type=internal`が付かない

### Requirement: 計測失敗時の操作継続

計測の読み込みや送信が失敗しても、住所検索、GPS、経路検索、PDF・カレンダー出力は通常どおり完了しなければならない（MUST）。開発環境と測定ID未設定の環境では送信しない。

#### Scenario: 測定IDが未設定の環境

- **WHEN** 測定IDが空のまま入力画面で検索する
- **THEN** 計測の送信は行われず、検索と結果表示は通常どおり完了する
