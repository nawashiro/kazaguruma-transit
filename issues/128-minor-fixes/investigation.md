# Issue #128 調査記録

- Issue: [#128](https://github.com/nawashiro/kazaguruma-transit/issues/128)
- タイトル: `chor: 細かい修正`
- 状態: open、コメント0件、ラベルなし、担当者なし
- 対象リポジトリ: `nawashiro/kazaguruma-transit`
- 基準ブランチ: `dev`
- 調査時点の基準SHA: `0215274d7f642a609a9ae0a26db56aadbd189564`
- 実装ブランチ: 調査後に `dev` から作成する

## 1. リポジトリ状態と関連作業

作業開始時の `/opt/data/kazaguruma-transit` は `fix/issue-126-card-title-ruby` 上で clean だった。`git fetch origin --prune` 後に `dev` へ切り替え、`git pull --ff-only origin dev` を実行して `origin/dev` と同一の `0215274d7f642a609a9ae0a26db56aadbd189564` へ更新した。調査終了時も `git status --short --branch` は `## dev...origin/dev`、`git diff --check` は終了コード0だった。

Issue番号と症状の重複作業を確認した。

- `gh pr list --search '#128' --state all`: 該当PRなし
- `gh pr list --search '"text-balance"' --state open`: 該当PRなし
- `gh pr list --search 'returnTo' --state open`: 該当PRなし
- `gh pr list --search 'card-title' --state all`: #127 と #117 はMERGED。#127は #126 の限定修正で、現在の `dev` に取り込まれている
- Issue #128 のコメントは0件で、追加のメンテナー指示はない

調査時点の実行環境は Node `v26.5.1`、npm `11.17.0` だった。リポジトリの `engines` と過去の検証記録に合わせ、テスト実行には `/opt/data/toolchains/node-v22.23.2/bin` をPATHの先頭へ指定した。

## 2. Issue本文と現行実装の対応

| # | Issueの要望 | 現行箇所 | 調査結果 |
|---|---|---|---|
| 1 | 評価中の投稿カード内の意味のない隙間を除去 | `src/components/discussion/EvaluationComponent.tsx:122-129` | 投稿本文の`p`に `text-balance` が付いている。日本語本文へ不要な均等割付を適用しているため削除する。 |
| 2 | 検索結果ページの説明を変更 | `src/app/routes/page.tsx:17` | `PageHeader`の説明が `指定した条件の乗換経路`。Issue指定の `自動作成されたスケジュール` へ置き換える。 |
| 3 | 認証理由表示を廃止し、正しい復帰先を渡す | `src/lib/navigation/auth-route.ts`、`src/components/auth/AuthRoutePage.tsx`、投稿系ページ | `buildAuthRoute`が任意の`reason`をクエリへ付加し、`AuthRoutePage`が表示する。`BusStopDiscussion`はログイン・評価とも復帰先を`/`に固定している。認証操作の直前の相対パスを共通関数から取得し、`reason`生成・表示経路を削除する。 |
| 4 | 3フォームの入力をブラウザへ自動保存・復元・成功後削除 | `src/app/discussions/create/page.tsx`、`src/app/discussions/[naddr]/page.tsx`、`src/components/discussion/BusStopDiscussion.tsx` | いずれもReact stateだけで、下書き保存はない。認証遷移直前に入力を失う。`sessionStorage`を使う共通の型付き下書き処理を追加し、タイトル・説明・モデレーター入力、投稿本文・タグを保存対象にする。 |
| 5 | 検索結果の読み込み表示の崩れを修正 | `src/components/features/RouteSearchResults.tsx:170-174` | `role=status`の親全体へ `ruby-text` を付与し、DaisyUI `loading`要素と読み上げテキストを同じRubyful処理境界へ入れている。Ruby対象をテキスト要素だけへ限定し、スピナーの親から`ruby-text`を外す。 |
| 6 | バス停メモの用語を利用者向けに変更 | `src/components/discussion/BusStopDiscussion.tsx:206,213` | `このバス停メモは役に立ちますか？` と `バス停メモを投稿` を、それぞれ `このアドバイスは役に立ちますか？` と `利用者へのアドバイスを投稿` へ変更する。 |
| 7 | 投票ボタンを投稿カードの外・下、プログレスバーの上へ移動 | `src/components/discussion/EvaluationComponent.tsx:103-178` | 現在は`role=article`の投稿カード内に評価ボタンがある。投稿本文カードを閉じた直後に評価ボタン群を置き、その後に`progress`を置く。 |
| 8 | プログレスバーのARIAラベルからコロンを除去 | `src/components/discussion/EvaluationComponent.tsx:177` | 現在は `評価進捗: 0%完了`。`評価進捗 0%完了`へ変更する。 |
| 9 | テーマ切り替えをPC・スマホとも右上へ配置 | `src/components/layouts/SidebarLayout.tsx:85-98` | ヘッダーは`justify-between`で、PCでは左側のメニューボタンが`lg:hidden`により消えるため、残ったテーマ切り替えが左寄せになる。`lg:justify-end`を追加してPCでも右寄せにする。スマホの既存の左右配置は維持する。 |
| 10 | 会話説明と投稿本文の上限を各1000文字へ拡張 | `src/app/discussions/create/page.tsx`、`src/app/discussions/[naddr]/edit/page.tsx`、`src/lib/discussion/user-creation-flow.ts`、`src/lib/nostr/nostr-utils.ts`、投稿2画面 | 会話作成・会話編集の説明は500文字、投稿本文は280文字だった。会話タイトルの100文字上限は維持する。レビュー指摘を受け、会話作成・編集の説明上限を共有定数で1000文字へ統一し、投稿本文も1000文字へ統一する。 |
| 11 | 評価文言・新規投稿の説明・例を改善 | `src/components/discussion/EvaluationComponent.tsx`、`src/app/discussions/[naddr]/page.tsx` | 評価タイトル既定値は `この論点は参考になりますか？`、補足文は過剰な説明文。タイトルを `この論点は妥当だと思いますか？` にし、補足文を削除する。`新しい投稿`直下へ `不足している論点や、課題へのアイデアを投稿してください。` を追加し、プレースホルダーへIssue本文の投稿例を入れる。`/beginners-guide`は既に風ぐるま自体の説明とサイト説明を別段落で表示しているため、同ページの追加改修は行わない。 |
| 12 | 設定画面の作成済み会話説明を一覧相当へ短縮 | `src/app/settings/page.tsx:257-259`、`src/app/discussions/page.tsx:114-118` | `/discussions`は70文字を超える説明を`...`付きで切り詰めるが、`/settings`は全量表示している。同じ70文字の表示ヘルパーへ統一する。 |
| 13 | 全 `.card-title` のRubyful/DaisyUI崩れを修正 | `src`配下のproduction `.tsx` | production上の`card-title`は21箇所。`Card`、`CarouselCard`、会話一覧は既に`inline`済みで、18箇所が未対応（モデレーター、設定、ライセンス、表彰、場所、Ko-fi等）。全21箇所へ既存の`inline`ユーティリティを適用する。新規CSSやDaisyUI全体の上書きは行わない。 |

## 3. 根因の整理

### 表示・文言

- `text-balance`、DaisyUI `.card-title { display: flex }`、RubyfulのRuby変換が日本語の通常のインライン折り返しを妨げる。
- 検索結果ローディングは`ruby-text`の適用範囲がスピナーを含む親要素まで広く、ローディング要素と表示テキストの責務が分離されていない。
- 評価ボタンは投稿カードの内部に配置されており、カードの情報とカードに対する操作が同じ境界に混在している。

### 認証・入力保持

- `reason`は認証画面に情報を追加する過剰な表示経路であり、`AuthRoutePage`、`buildAuthRoute`、各アクション呼び出しにまたがっている。
- `BusStopDiscussion`の認証遷移だけが復帰先を`/`へ固定している。経路検索結果のクエリを含む現在の相対URLを取得する共通関数がない。
- 3フォームとも入力状態はReact stateのみで、ページ遷移・再訪時に再構築される。下書きはrelayへ送信せず、同一ブラウザタブの`sessionStorage`へ限定するのが、要求を満たしつつ追加永続化を避ける最小境界である。

### 制限値・表示長

- 文字数の検証値とUIの`maxLength`／カウンターが複数ファイルに重複している。定数を共有しないと、クライアントUIだけ変更してイベント検証を置き去りにする。
- 設定画面に一覧用の短縮処理がなく、同じドメインの一覧表示で異なる表示長になる。

## 4. 変更境界

### 変更するproduction

- 評価表示: `src/components/discussion/EvaluationComponent.tsx`
- バス停メモ投稿: `src/components/discussion/BusStopDiscussion.tsx`
- 経路検索結果: `src/app/routes/page.tsx`、`src/components/features/RouteSearchResults.tsx`
- 認証導線: `src/lib/navigation/auth-route.ts`、`src/components/auth/AuthRoutePage.tsx`、`src/app/discussions/create/page.tsx`、`src/app/discussions/[naddr]/page.tsx`
- 下書き／現在URL／制限値／短縮ヘルパー: `src/lib/forms/`、`src/lib/navigation/`、`src/lib/discussion/`、`src/lib/nostr/nostr-utils.ts`
- 下書き対象フォーム: `src/app/discussions/create/page.tsx`、`src/app/discussions/[naddr]/page.tsx`、`src/components/discussion/BusStopDiscussion.tsx`
- 配置: `src/components/layouts/SidebarLayout.tsx`
- 設定一覧: `src/app/settings/page.tsx`、`src/app/discussions/page.tsx`
- 全`card-title`未対応箇所（調査表に列挙した21行）

### 変更しないproduction

- Nostr relayのread/write契約、Prisma/SQLite、GTFS import、認証情報そのもの、会話タイトル100文字上限、Rubyful外部スクリプト、DaisyUIの共通CSS。
- `/beginners-guide`の段落構造（既に要求どおり分離済み）。
- `reason`というドメイン用語を持つモデレーター申請データや権限理由。今回削除するのは認証URLの`reason`だけである。

## 5. 変更前の検証

次の関連9 suiteを Node `v22.23.2` / Jest `--runInBand`で実行し、9 suite / 64 testsが成功した。

```text
PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npm test -- --runInBand --runTestsByPath \
  src/components/discussion/__tests__/EvaluationComponent.test.tsx \
  src/components/discussion/__tests__/BusStopDiscussion.streaming.test.tsx \
  'src/app/discussions/[naddr]/__tests__/page.streaming.test.tsx' \
  src/app/discussions/create/__tests__/page.test.tsx \
  src/app/routes/__tests__/page.test.tsx \
  src/app/login/__tests__/page.test.tsx \
  src/app/signup/__tests__/page.test.tsx \
  src/app/settings/__tests__/page.streaming.test.tsx \
  src/app/discussions/__tests__/page.streaming.test.tsx \
  --silent

Test Suites: 9 passed, 9 total
Tests:       64 passed, 64 total
```

DaisyUI `node_modules/daisyui/components/card.css`の実定義は `.card-title` を `display:flex` とし、`node_modules/daisyui/components/loading.css`の`.loading`は`display:inline-block`・`aspect-ratio`等を持つ。Issue #126で確認済みのとおり、Rubyful対象見出しには既存の`inline`を付与することで、見出し内部のflexコンテナ化を解除できる。

## 6. 実装方針の結論

13項目を、次の4つの小さな責務へ分けて実装する。

1. **評価・投稿UI**: 文言、`text-balance`、投票ボタンの順序、ARIA、投稿例、バス停用語を変更する。
2. **認証・下書き**: 認証URLの`reason`経路を破壊的に除去し、現在の相対URLを共通取得する。3フォームの下書きを`sessionStorage`へ保存・復元・成功後削除する。
3. **制限値・共通表示**: 会話説明／投稿本文の1000文字定数と、会話説明70文字短縮ヘルパーを共有する。
4. **レイアウト契約**: ローディングのRuby境界、テーマ切替のPC右寄せ、全`card-title`への既存`inline`を回帰テストで固定する。

実装前にテストを先に変更し、意味のあるREDを確認する。テスト変更後は別のfresh read-only reviewerへ委任し、`SUBAGENT_STATUS: COMPLETE` と `VERDICT: PASS`、`modified: false`、開始・終了SHA一致を確認してからproduction codeを変更する。

## 7. 実装後の検証

### TDDゲートと実装

- T003は7 suite / 33 tests中11 failed・22 passedの意味あるREDだった。初回T004 reviewはFAILとなり、RouteSearchResultsのspinnerがRuby境界の子孫にならない検証、card-title AST収集のfail-closed化、RoutesPage追加テストの`act`警告を指摘した。
- T003Rで上記3点とSidebarの`lg:hidden`／DOM順を補正した。親の再実行は7 suite / 33 tests中11 failed・22 passed、collection/setup/runtime/act/open-handle failureなしだった。T004Rは`SUBAGENT_STATUS: COMPLETE`、`VERDICT: PASS`、`modified: false`、開始・終了SHA一致だった。
- T005は8 suite / 60 tests中27 failed・33 passedの意味あるREDだった。T006 reviewは、詳細画面のquery付きreturnToとnaddr／bus-stop key分離の検証不足を指摘した。T005Rで補正した後も、T006Rは失敗時payloadの内容検証不足を指摘した。T005RRで3フォームの失敗後payloadを厳密化し、T006RRは`SUBAGENT_STATUS: COMPLETE`、`VERDICT: PASS`、`modified: false`、開始・終了SHA一致でproduction gateを開けた。
- T007は6 suite / 77 tests中33 failed・44 passedの意味あるREDだった。T008は`SUBAGENT_STATUS: COMPLETE`、`VERDICT: PASS`、`modified: false`、開始・終了SHA一致で、1000文字境界・70文字短縮・UI属性契約を承認した。
- 共通helper、認証reason除去、評価UI、会話作成、会話詳細、バス停投稿、検索loading、テーマ配置、一覧短縮、全`card-title`を実装した。T010Rでは認証builderを1引数署名へ完全にした際、個別モデレーター画面の旧reason付き呼び出し2箇所がstrict TypeScriptで検出された。T010RRでその2引数だけを削除し、モデレーター申請フォームのdomain `reason` stateは維持した。

### 親側の品質ゲート

- 横断focused Jest: Node `v22.23.2`で20 suite / 161 tests PASS。評価、loading、card-title 21件、routes、theme、auth、current route、sessionStorage、create/detail/bus-stop、limits、display、settings、moderatorを含む。
- Strict TypeScript: `PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npx tsc --noEmit --incremental false` は終了コード0。
- Lint: `PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npm run lint` は終了コード0。`next lint`廃止予定通知、既存の`any`、`<img>`、Hook依存、今回のテスト追加に伴う既存warningのみでerrorなし。
- 全Jest: `PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npm test -- --runInBand` は終了コード0、144 suites passed / 2 skipped、899 tests passed / 13 skipped、snapshot 0。`act`、open handle、Jest終了警告による失敗なし。
- Build: `PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npm run build` は終了コード0。Prisma Client生成、SQLite schema同期、Next.js production build、27ページ生成が成功した。`transit-config.json`不在による既存GTFS import設定エラー表示はbuildの終了コード・Next build成功と分離した。
- Source audit: productionの`card-title`は21件、`inline`欠落0件。認証productionには`reason` queryの読み取り／生成がなく、旧`text-balance`・旧評価文言・旧バス停文言・旧投稿280文字・旧会話作成／編集500文字は対象productionに残っていない。会話タイトル100文字上限は維持した。
- `git diff --check`は終了コード0。作業ツリーはfeature branch上で、Issue docs、test、helper、productionの計画済み変更だけが未commitで存在し、stage／commit／pushはこの時点で未実行だった。

### ブラウザ相当確認の制約

- 開発サーバーは`curl http://127.0.0.1:3000/award`でHTTP 200を返した。
- Hermesの`browser_exec`は専用自動化Chromeが`BU_CDP_URL=http://127.0.0.1:9222`で到達不能となり、利用できなかった。
- 代替Puppeteer probeは、外部Rubyful scriptの通信継続による`networkidle0` timeout、Puppeteer headless launchのWS endpoint timeoutを経た。`/usr/bin/chromium`単体は後からDevTools endpointを出したが、診断時はD-stateで応答せず、loading／computed style／viewport位置の実測値は取得できなかった。
- したがって、ブラウザprobeを成功扱いにはしない。loadingのRuby境界、DaisyUI spinner、card-titleの`inline`、PC／mobile theme配置は、実ブラウザ未実測であることを明記したうえで、RTL／TypeScript AST契約、installed CSS確認、production buildの結果で検証した。

## 9. PRレビュー指摘への追補

PR #129のレビューで、`src/app/discussions/[naddr]/edit/page.tsx`だけが説明の検証・`maxLength`・カウンターを500文字に固定し、会話作成と投稿フォームで導入済みの共有定数を参照していないことが指摘された。これはIssue #128の「会話説明を1000文字へ拡張」という受入条件と、計画のDRY方針に反するため、編集画面も同じ`DISCUSSION_DESCRIPTION_MAX_LENGTH`へ接続する。

追補では、既存の会話タイトル100文字、モデレーター管理、NIP-72のdTag、Nostrイベント生成を変更しない。`src/app/discussions/[naddr]/edit/__tests__/page.test.tsx`へ1000文字ちょうどの受入れ、1001文字の拒否、`maxLength`・カウンターの回帰テストを先に追加し、旧500文字実装に対するREDを確認してからproductionを変更する。

## 10. 配送後確認

- 実装commit: `910426ab6b7c43a68a8f3c63792aab5c9d2042c7`（`fix: Issue #128の細かい修正を反映`）。`origin/fix/issue-128-minor-fixes`のremote SHAと一致し、作業ツリーはcleanだった。
- Pull Request: [#129](https://github.com/nawashiro/kazaguruma-transit/pull/129)。GitHubから読み戻したbase=`dev`、head=`fix/issue-128-minor-fixes`、head SHA=`910426ab6b7c43a68a8f3c63792aab5c9d2042c7`、state=`OPEN`、変更45ファイルを確認した。mergeは行っていない。
- Quality Gate: run `33635483405` / job `100265180658` は上記exact SHAに対して`success`。ESLint、strict TypeScript、Jestの全stepがsuccessだった。

## 11. PRレビュー追補の検証

- 編集画面の追補テストを先に実行し、旧実装では`説明は500文字以内で入力してください`および`maxLength="500"`となる意味あるREDを確認した。その後、`DISCUSSION_DESCRIPTION_MAX_LENGTH`接続後に9 tests全てがGREENとなった。
- 追補後のfocused JestはNode `v22.23.2`で2 suite / 35 tests PASS。編集画面の1000文字境界・`maxLength`・カウンターと、既存の会話作成validationを確認した。
- 追補後の全Jestは`PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npm test -- --runInBand`で終了コード0、144 suites passed / 2 skipped、900 tests passed / 13 skippedだった。strict TypeScript（`npx tsc --noEmit --incremental false`）と`npm run lint`も終了コード0だった。
- 追補後の`npm run build`は終了コード0で、Next.js production buildと27ページ生成が成功した。`transit-config.json`不在による既存GTFS import設定エラー表示は前回と同様にbuild成功とは分離した。`git diff --check`も終了コード0だった。
- `DISCUSSION_DESCRIPTION_MAX_LENGTH`は会話作成、会話編集、会話作成flowで共通参照され、対象productionに説明の500文字リテラル・`maxLength={500}`・`/500文字`は残っていない。会話タイトル100文字と投稿本文用`POST_CONTENT_MAX_LENGTH`は別の契約として維持した。
- 修正commit: `91deacf79fe12b91cd0d0e66ef48392f77a33b5e`（`fix: 会話編集の説明上限を1000文字へ統一`）。`origin/fix/issue-128-minor-fixes`のremote SHAと一致し、編集画面の追補コード・テスト・仕様書・Issue文書を含む6ファイルを配送した。
- PR #129の追補headをGitHubから読み戻し、base=`dev`、head=`fix/issue-128-minor-fixes`、head SHA=`91deacf79fe12b91cd0d0e66ef48392f77a33b5e`、state=`OPEN`、merge state=`CLEAN`を確認した。mergeは行っていない。
- Quality Gate: run `33696574312` / job `100466608402` は上記exact SHAに対して`success`。ESLint、strict TypeScript、Jestの全stepがsuccessだった。
