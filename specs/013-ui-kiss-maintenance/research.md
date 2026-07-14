# Research: UI KISS観点の整備

## Decision 1: 009 Nostr同期は変更せず、snapshot後の投影だけを共通化する

- **Decision**: `useBusStopModeration`、`loadDiscussionModerationSnapshot`、relay候補選択、completion、partial/unknown、承認イベントの `e` タグ結合を既存の009契約として維持する。共通化対象はsnapshotから投稿・評価統計・代表メモへ変換する処理に限定する。
- **Rationale**: 009はrelayの遅延、重複、既知データ、承認未観測を扱うため、通信境界の単純化は仕様違反や誤った未承認確定につながる。一方、`BusStopDiscussion`、`BusStopMemo`、PDF用取得関数には同じ投影処理の重複がある。
- **Alternatives considered**:
  - 各コンポーネントで独自にreadする: 009の画面間承認整合性を壊すため不採用。
  - `DiscussionTabLayout` を今回全面分割する: 009の段階的readを含むため変更リスクが高く、今回の優先範囲外。

## Decision 2: 画面とPDFは意味モデルを共有し、レイアウトは共有しない

- **Decision**: ルート、区間、時刻、乗換、徒歩区間、メモの意味を共有型・純粋変換で定義し、React画面とサーバーHTMLはそれぞれのレイアウトで描画する。
- **Rationale**: 両者は同じ利用者価値を表示するが、ブラウザとPuppeteerで実行環境・エスケープ・画像・印刷CSSが異なる。markupを直接共有するより、意味の一貫性をテストする方が単純で安全である。
- **Alternatives considered**:
  - React markupをPDFと共有する: サーバーHTML生成とブラウザUIの責務が混ざるため不採用。
  - 画面とPDFを完全独立にする: 時刻・乗換・メモの乖離を検知しにくいため不採用。

## Decision 3: ジオコーディングは共通の状態契約にする

- **Decision**: 出発地・目的地で共通の入力検証、地域補完、fetch、429、空結果、通信失敗、loadingの状態契約を使う。GPS取得は出発地固有の処理として残す。
- **Rationale**: 現在の2コンポーネントは検索処理が重複し、片方だけ修正されるリスクがある。GPSは目的地に存在しないため無理に共通化しない。
- **Alternatives considered**:
  - Origin/Destination全体を一つのコンポーネントに統合する: GPS・候補施設の差分が条件分岐として入り、表示責務が複雑になるため不採用。
  - API routeを今回変更する: 既存のエラー契約とレート制限に不要な変更を加えるため不採用。

## Decision 4: `Button` は薄い明示APIへ整理する

- **Decision**: `className` の `join-item` 文字列解析、不要な自動ID、重複したスタイル責務を除き、状態とARIAを明示的なPropsで指定する。ルビの外部処理自体は変更しない。
- **Rationale**: 共通部品が利用側のスタイル文字列を解釈すると、見た目と挙動の依存が隠れる。薄いラッパーならDaisyUIの既存規約を維持しながら利用側の予測可能性を高められる。
- **Alternatives considered**:
  - 現在のAPIを完全維持する: 暗黙の文字列判定と不要状態が残るため不採用。
  - 共通Buttonを廃止して全て直接記述する: ARIA・loading・フォーカス規約が分散するため不採用。

## Decision 5: PDF APIの未使用項目は互換保持し、廃止予定として明記する

- **Decision**: `departures` と `message` など現時点でHTML生成に使わない入力項目は直ちに削除せず、契約上の互換項目として記録する。新規クライアントからは暗黙に送らない。
- **Rationale**: API境界の即時削除は、未確認の呼び出し元との互換性を壊す可能性がある。保持理由と削除条件を明記すれば、不要な契約の恒久化を防げる。
- **Alternatives considered**:
  - 直ちに削除する: 互換性確認が完了していないため不採用。
  - 何も記録せず保持する: 未使用項目が増え続けるため不採用。

## Decision 6: 移行は対象箇所に限定する

- **Decision**: 今回は上記の重複と不要状態、およびそれに直接関係する利用箇所だけを移行する。ホームページ・場所一覧ページの大規模分割と全画面の一括UI移行は後続に送る。
- **Rationale**: 変更の価値を確保しながら、回帰範囲とレビュー単位を制限できる。新規・変更コードには共通UI境界の契約を適用する。
- **Alternatives considered**:
  - 全画面を一括移行する: 作業量と回帰リスクが今回の目的を超えるため不採用。
  - Buttonの設計だけで終える: ジオコーディング、ルート、BusStopの重複が残るため不採用。
