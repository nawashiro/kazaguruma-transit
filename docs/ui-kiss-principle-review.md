# UIコンポーネント設計におけるKISS原則レビュー（再評価版）

作成日: 2026-07-14
対象: `src/components/ui`、`src/components/features`、`src/components/discussion`、`src/components/layouts`、主要な `src/app` ページ、PDF出力のUI/API境界

## レビュー方針

前回のレビューを見直し、次のものは「複雑だから」という理由だけではKISS違反と判定しないことにした。

- 009仕様が要求する、段階的Nostr取得、relay候補選択、完了理由、既知データ、partial/unknown状態、重複排除
- ルビ外部ライブラリとの接続処理
- PDFのように、ブラウザUIとサーバー側HTML/Puppeteerという異なる実行環境をまたぐ処理
- アクセシビリティのためのキーボード操作や状態表示

KISS違反とは、仕様上必要な複雑性ではなく、同じ責務の重複、不要な状態、境界の不整合、利用側を複雑にする抽象化を指す。

## 結論

009仕様に関するNostrの複雑さと、ルビ処理そのものは、今回の主な改善対象ではない。一方で、次の問題は仕様を守りながら縮小できる。

1. 共通 `Button` が利用側のクラス文字列やルビ処理まで解釈する過剰なラッパーになっている。
2. 出発地・目的地のジオコーディング処理が重複している。
3. 画面用のルート表示、PDF UI、PDF API、PDF HTML生成で同じルート型・時刻計算・表示ロジックが分散している。
4. BusStop系の共通snapshot後の投影処理が `BusStopDiscussion`、`BusStopMemo`、PDF用取得関数に重複している。
5. 大規模ページと一部の機能コンポーネントが、状態管理・操作処理・表示を一つに抱えている。
6. 共通UIがある一方で、ボタン・カード・モーダルの直接記述も多く、抽象化の境界が曖昧である。

## 指摘一覧

### 1. `Button` が利用側の実装を解釈する過剰なラッパーになっている — 高

対象: [`src/components/ui/Button.tsx`](../src/components/ui/Button.tsx#L6-L85)

- `secondary`、`fullWidth`、`loading`、`iconOnly`、複数のARIA属性、`testId` を一つのPropsに集約している。
- `className` を文字列解析して `join-item` の有無を判定し、内部の角丸ルールを変えている（45〜48行目）。見た目の指定がコンポーネントの挙動を決めるため、利用側からはルールが見えにくい。
- `useId()` でIDを常に生成しているが、外部から参照するPropsがない（41〜42、67行目）。このIDは現在の設計では不要である。
- フォーカス表示を `outline: none` と `boxShadow: none` で無効化している（79〜83行目）。コメントの意図と実装が一致せず、利用側の追加クラスに依存する。
- `iconOnly` のARIA要件をログ警告にとどめている（60〜63行目）。警告だけでは不正な状態を防げない。
- 子要素を常に `ruby-text` のspanで包むため、アイコンやレイアウト用の子要素にも共通処理が介入する（85行目）。ルビの事情は理解できるが、ボタンの基本責務とは分離できる。

DaisyUIのボタンを薄くラップし、`join-item` は利用側が明示的に指定するか、別の `JoinButton` にする方が単純である。ルビのspanが必要な場合も、ボタン全体の責務にせず、テキスト表示側へ限定するのが安全である。

### 2. 出発地・目的地セレクターが同じジオコーディング処理を複製している — 高

対象: [`OriginSelector.tsx`](../src/components/features/OriginSelector.tsx#L27-L86)、[`DestinationSelector.tsx`](../src/components/features/DestinationSelector.tsx#L25-L86)

- 入力検証、千代田区の接頭辞付与、`/api/geocode` 呼び出し、429処理、レスポンス判定、エラーメッセージ、ローディング状態がほぼ同じである。
- 出発地側にGPS処理があることを除くと、主な違いは選択結果のコールバックと文言である。
- `InputField`、検索ボタン、`RateLimitModal` の組み立てもそれぞれに存在する（Origin 143〜202行目、Destination 92〜131行目）。

共通の `useGeocodingSearch` または `LocationSearchField` に検索処理と表示をまとめ、出発地固有のGPS処理だけを `OriginSelector` に残すのが妥当である。

### 3. ルート表示とPDF生成で同じドメインロジックが分散している — 高

対象: [`IntegratedRouteDisplay.tsx`](../src/components/features/IntegratedRouteDisplay.tsx#L8-L148)、[`RoutePdfExport.tsx`](../src/components/features/RoutePdfExport.tsx#L8-L135)、[`src/app/api/pdf/generate/route.ts`](../src/app/api/pdf/generate/route.ts#L264-L587)

- 画面表示とPDF HTML生成の両方で、出発時刻取得、到着時刻の概算、時刻表示、乗換区間、ルートカードを別々に実装している。
- PDF側の `generateRouteHTML` は日付、時刻、メモ、画像存在確認、Google Directions、HTMLテンプレート、乗換描画を一つの関数に抱えている（265〜680行目付近）。
- `RouteInfo`、`RouteDetailInfo`、`NextRouteInfo`、`GeneratePdfRequest` のルート構造が複数ファイルに分散している（画面側8〜37行目、PDF API 10〜75行目）。
- PDF APIは `departures` と `message` を受け取れる型にしているが、現在の `generateRouteHTML` では参照していない（API 65〜75行目）。一方、クライアントの `RoutePdfExport` もそれらをリクエスト本文に送っていない（81〜93行目）。互換性として意図的なら契約に明記すべきである。

PDF HTMLをReact画面と直接共有する必要はないが、まず「ルートを表示用セグメントへ変換する処理」と「時刻計算」を共通の純粋関数へ切り出せる。PDF専用のHTMLレンダリングはその結果を受け取る薄い層にし、型は `src/types` の正規モデルからDTOへ明示変換する方が単純である。

### 4. `RoutePdfExport` に不要または重複した状態がある — 中

対象: [`src/components/features/RoutePdfExport.tsx`](../src/components/features/RoutePdfExport.tsx#L56-L219)

- `error` は宣言されているが、`setError` が呼ばれておらず、137〜159行目の分岐は到達しない状態である。
- `pdfGenerating` と `pdfLoading` は同じ処理開始時に `true`、終了時に `false` となり、ボタンの無効化・表示条件も同じである（58〜68、131〜134、194〜196行目）。
- PDF生成失敗時のエラー表示は二つのalert構造に分かれ、片方は死んだ状態に依存している。

`isGenerating` と `pdfError` の二つに整理し、エラー表示は一つの薄い `ErrorAlert` に寄せるだけでよい。これはPDFの外部実行環境を単純化する指摘ではなく、クライアント側状態の重複に限定した指摘である。

### 5. 009仕様は必要な複雑性だが、BusStop系の投影処理は重複している — 高

対象: 009仕様 [`specs/009-coracle-style-sync/spec.md`](../specs/009-coracle-style-sync/spec.md#L1-L20)、実装 [`useBusStopModeration.ts`](../src/components/discussion/useBusStopModeration.ts#L30-L127)、[`BusStopDiscussion.tsx`](../src/components/discussion/BusStopDiscussion.tsx#L68-L104)、[`BusStopMemo.tsx`](../src/components/discussion/BusStopMemo.tsx#L50-L109)、[`BusStopMemo.tsx`](../src/components/discussion/BusStopMemo.tsx#L154-L210)

009では、画面目的別read、relay候補、completion、partial/unknown、承認イベントの `e` タグ結合、既知データ利用が明示的に要求されている。したがって `useBusStopModeration` が共通snapshotを利用し、readをdeduplicateしていること自体はKISS違反ではない（30〜65行目）。

ただしsnapshot取得後の処理は重複している。

- `BusStopDiscussion` と `BusStopMemo` がそれぞれ承認イベントのparse、投稿のparse、バス停によるfilterを行っている（Discussion 73〜80行目、Memo 56〜65行目）。
- 両方が評価イベント取得・parse・`combinePostsWithStats` を別々に行っている。
- `BusStopMemo` の画面用 `updateFromEvents` とPDF用 `getBusStopMemoData` が、承認付き投稿抽出、評価取得、スコア順ソート、バス停ごとの先頭投稿選択を重複実装している（50〜95、154〜205行目）。

read境界は009どおり維持しつつ、snapshotから `PostWithStats` や「バス停ごとの代表メモ」へ変換する純粋関数を共通化するのが適切である。これにより、承認状態の仕様を壊さずにUIとPDFの重複だけを減らせる。

### 6. 大規模ページが状態管理・操作・表示を一つに抱えている — 高

対象: [`src/app/locations/page.tsx`](../src/app/locations/page.tsx#L57-L90)、[`src/app/page.tsx`](../src/app/page.tsx#L120-L180)

- `LocationsPage` は782行あり、施設データ、位置情報、距離計算、GeoJSON、カテゴリ、住所検索、レート制限、モーダル、カルーセルを保持している。冒頭から状態が多数並ぶ（58〜88行目）。
- ホームページは729行あり、URL復元、localStorage、出発地・目的地、経路検索、日時、優先順位、メモデータを一つのページに持つ（121〜133行目）。
- 非同期処理の結果と表示分岐が同じファイルに集まり、状態の組み合わせを読むコストが高い。

ページコンポーネントを「状態／データ取得フック」「検索・選択フォーム」「結果表示」「空・エラー状態」に分けると、見た目を変えずに責務を縮小できる。行数だけで分割するのではなく、状態遷移の境界で分割すべきである。

### 7. `BusStopDiscussion` が通信操作・フォーム・プレビュー・評価UIを兼務している — 中

対象: [`src/components/discussion/BusStopDiscussion.tsx`](../src/components/discussion/BusStopDiscussion.tsx#L35-L322)

共通snapshotを使っている点は009に沿っているが、同一コンポーネントが次の責務を併せ持つ。

- snapshotからの投稿・評価表示用データへの変換
- ユーザー評価の取得
- 投稿イベントと評価イベントの作成・署名・公開
- 投稿フォーム、入力エラー、プレビュー、ログインモーダルの状態管理
- 評価一覧と投稿UIの描画

投稿／評価のイベント送信は操作フックまたはサービスへ、投稿フォームとプレビューは子コンポーネントへ分けられる。009のread戦略を変更する必要はない。

### 8. 共通UIを定義しているのに、同じUIを直接記述している — 中

対象: [`Button.tsx`](../src/components/ui/Button.tsx)、[`Card.tsx`](../src/components/ui/Card.tsx)、各ページ・機能コンポーネント

- 共通 `Button` がある一方、直接の `button` と `btn ... rounded-full dark:rounded-sm` が多数ある（例: [`BusStopDiscussion.tsx`](../src/components/discussion/BusStopDiscussion.tsx#L291-L299)、[`DiscussionTabLayout.tsx`](../src/components/discussion/DiscussionTabLayout.tsx#L380-L393)）。
- `Card` がある一方、議論投稿フォームでは `bg-white ... border ... rounded-lg p-4` を直接組み立てている（[`BusStopDiscussion.tsx`](../src/components/discussion/BusStopDiscussion.tsx#L216-L223)）。
- 一方で共通 `Button` 自体が `join-item` やルビを特別扱いするため、共通化しているのに利用側の記述ルールも残っている。

共通部品を必須にする必要はないが、「DaisyUIの薄いクラス記述を許容する部品」と「状態・アクセシビリティを保証する部品」を区別すべきである。中途半端なラッパーは削除するか、責務を明確にする方がKISSである。

### 9. モーダルとエラー表示の共通境界が曖昧である — 中

対象: [`settings/page.tsx`](../src/app/settings/page.tsx#L429-L448)、[`edit/page.tsx`](../src/app/discussions/[naddr]/edit/page.tsx#L1057-L1077)、[`RateLimitModal.tsx`](../src/components/features/RateLimitModal.tsx#L1-L90)、[`LocationDetailModal.tsx`](../src/components/features/LocationDetailModal.tsx#L1-L140)

- `dialog`、`modal modal-open`、`modal-box`、キャンセル／破壊的操作ボタンの構造が複数画面に現れる。
- `RoutePdfExport` ではエラーアイコン、エラー文、閉じるボタンも重複している（137〜187行目）。
- すべてを一つの巨大な汎用モーダルへ統合する必要はない。タイトル、本文、開閉、アクションだけを受け取る薄い `Modal`／`ConfirmModal` 境界が適切である。

### 10. `LoginModal` がモーダル、認証モード切替、アカウント作成フォームを兼務している — 中

対象: [`src/components/discussion/LoginModal.tsx`](../src/components/discussion/LoginModal.tsx#L13-L357)

- 開閉・背景クリック、ログイン／アカウント作成タブ、パスキー名、規約同意、送信中、認証エラーを一つで管理している。
- モード切替のタブ、アカウント作成専用の説明・規約フォーム、ログイン専用フォームが同じファイルに混在する。
- `area-selected` という属性名の重複記述もあり、タブ状態の表現を一箇所で管理できていない（80〜100行目）。これはKISSだけでなくアクセシビリティ上の確認対象でもある。

モーダルの殻、認証モードタブ、作成フォーム／ログインフォームを分離すると、各部の状態が減る。認証処理そのものを変える必要はない。

## 今回はKISS違反として扱わないもの

### ルビ処理

[`RubyWrapper.tsx`](../src/components/ui/RubyWrapper.tsx) の `observe?: any`、タイマーのクリーンアップ、未使用 `className` は保守上の改善候補ではある。しかし、外部ライブラリの検出・遅延起動・再処理を担っているため、今回これを主要なKISS違反として追及しない。修正する場合も、外部ライブラリの起動契約を確認し、専用フックへ移す小さな変更に限定すべきである。

### 009仕様のNostr read設計

`DiscussionTabLayout` のread計画、既知データ、relay選別、completion-aware read、段階表示は、009のFR-001〜FR-023および実装タスクT021、T042に対応する必要な複雑性である。467行というサイズだけを理由に分割を要求しない。

ただし、009が共通化を要求している承認snapshot後の投影処理や、画面間で同じデータを変換する処理まで重複させてよい、という意味ではない。今回の指摘5はこの境界に限定する。

### PDFの外部実行環境

Puppeteer、Google Maps API、画像fallback、PDF用HTMLを持つこと自体は、ブラウザUIとサーバー生成物が異なるため避けられない。指摘3・4は、外部環境をなくす提案ではなく、共有可能な純粋なルート変換とクライアント状態の整理に限定する。

## 優先対応順

1. `RoutePdfExport` の死んだ `error` 状態と重複する生成状態を整理する。
2. ルートの型・時刻計算・表示用セグメント変換を共通のドメイン層へ移す。
3. ジオコーディング検索処理を共通化する。
4. BusStop系のsnapshot後の投影処理を純粋関数へ集約する。
5. `Button` を薄いDaisyUIラッパーへ戻すか、状態保証を担う部品としてAPIを絞る。
6. 大規模ページ、`BusStopDiscussion`、`LoginModal` を状態境界で分割する。
7. モーダル／エラー表示の共通境界を決める。

## 留保

本レポートはソースコード、009仕様、PDF APIとの静的照合に基づく。ルビ外部ライブラリの実行契約、Nostr relayの実測、PDFの実際のレンダリング結果までは検証していない。したがって、これらの領域については「複雑だから削る」のではなく、仕様上必要な部分と重複・未使用部分を分けて段階的に扱うべきである。
