# Responsibility Boundary Contract

## Purpose

013仕様で延期した3領域の責務分離について、外部から観測できる振る舞いと、変更してはならない境界を定義する。内部のファイル分割方法そのものはこの契約で固定しない。

## Contract 1: Route search page

### Inputs and external behavior

- 出発地、目的地、日時、出発/到着指定、はやさ優先の入力を従来どおり受け取る。
- 目的地ディープリンクを従来どおり読み取り、既存の履歴処理を維持する。
- 検索、再検索、リセット、PDF出力の既存操作名・遷移・表示を維持する。

### States

- 入力前、入力済み、検索中、成功、経路なし、429、通信/API失敗を区別する。
- 新しい検索やリセット後に、古い検索結果が表示されない。
- 経路の直通・乗換・時刻不明・徒歩区間・メモの意味は画面とPDFで一致する。

### Protected contracts

- `/api/transit`の既存入力・出力・レート制限意味を変更しない。
- PDF生成の入力契約・エラー契約を変更しない。
- 画面の見た目は原則変更しない。
- 公開ページ入口は `/api/transit` の呼び出しと応答変換を直接持たず、状態境界の結果を表示へ接続する。

## Contract 2: Location list page

### Inputs and external behavior

- カテゴリ選択、現在地取得、住所検索、距離順表示、場所カード、詳細モーダル、戻る遷移を維持する。
- 既存の場所データ、GeoJSON分類、距離計算、地域名表示を同じ意味で扱う。

### States

- 初期読み込み、表示可能、カテゴリ切替、位置情報処理、空結果、位置情報拒否/失敗、レート制限、詳細取得失敗を区別する。
- 位置処理や詳細処理の失敗で、継続可能な一覧操作を無効化しない。
- 最新のカテゴリ・位置・詳細要求だけが現在表示を更新する。
- `/api/geocode`、施設データ、GeoJSONの取得は状態境界側で行い、公開ページ入口は状態・イベント接続だけを担当する。

## Contract 3: Discussion tab metadata

### Inputs and external behavior

- `baseHref`、明示または動的なnaddr、ナビゲーション表示、子コンテンツの既存契約を維持する。
- 会話、監査、管理のタブURL、選択状態、戻るリンク、子コンテンツ表示を維持する。
- Arrow/Home/Endを含むキーボード操作、ARIA状態、44px以上の操作領域を維持する。

### Protected Nostr behavior

- `specs/009-coracle-style-sync/contracts/discussion-read-contract.md`を正本とする。
- relay選択、known-data cache、completion、partial/unknown、重複排除、source relayの意味を変更しない。
- 取得中でもタブと戻る操作を維持し、未観測を不在として表示しない。
- `RubyWrapper`、認証、Nostrイベント形式、永続化はこの機能で変更しない。

## Contract 4: Shared UI boundary

- 分割対象で変更するButton、Input、Tabs、Modal、Error表示は既存の共通UI契約に従う。
- `className`文字列を解析して状態を変えない。
- 直接DaisyUI記述を残す場合は、ページ固有のレイアウト・操作上の理由を記録する。
- 全画面の既存直接UIを一括移行しない。

## Verification matrix

| Boundary | Automated verification | Manual verification |
|---|---|---|
| Route | page test、transit/PDF contract、URL initialization、race/error cases | desktop/mobile search, reset, PDF |
| Locations | page test、loader/geo mock、category/position/detail error cases | category, location permission, address, modal |
| Discussion | layout test、009 read/cache tests、partial/unknown/reload | tabs, keyboard, partial relay behavior |
| UI | RTL role/label/ARIA/focus tests、lint、font-size checks | 44px target、responsive layout、visible Japanese errors |
