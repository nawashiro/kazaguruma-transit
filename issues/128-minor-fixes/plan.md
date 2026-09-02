# Issue #128 細かいUI・認証・入力保持修正計画

- Issue: [#128](https://github.com/nawashiro/kazaguruma-transit/issues/128)
- 基準ブランチ: `dev`
- 基準SHA: `0215274d7f642a609a9ae0a26db56aadbd189564`
- 実装ブランチ: `fix/issue-128-minor-fixes`
- 調査資料: `issues/128-minor-fixes/investigation.md`

## 目的

Issue #128 の13項目を、既存のNext.js／React／DaisyUI／Nostr構成を維持したまま修正する。対象は利用者が見る評価・投稿・検索結果・認証・設定UIと、認証遷移で失われる入力の同一タブ内下書き保持である。新規のサーバー永続化、Prisma/SQLite変更、relay契約変更は行わない。

## 方針

- **KISS:** 既存のクラス・画面境界・`sessionStorage`だけを使い、汎用フォーム基盤、DBテーブル、認証アクション再実行機構を追加しない。
- **DRY:** 現在URLの取得、文字数上限、会話説明の一覧短縮、下書きの保存・復元・削除を共通の小さなヘルパーへ集約する。評価・認証の既存責務を別の共通UIへ無理に抽象化しない。
- **意味論の維持:** 見出しレベル、リンク、Nostrイベント、承認・評価の判定、既存のローディング／エラー状態は維持する。文言変更はIssueに指定された範囲だけ行う。
- **後方互換性を目的とする旧経路は追加しない:** 認証URLの`reason`生成・表示を削除し、旧アクション再実行やクエリへ本文を詰める経路は作らない。
- **下書き境界:** 3フォームの下書きはJSONとして同一ブラウザタブの`sessionStorage`へ即時保存する。relay、URL、localStorage、サーバー、認証情報へは保存しない。投稿／会話作成の公開成功後に該当キーを削除する。失敗時は下書きを残す。

## 憲章ゲート

根拠は`AGENTS.md`と`.specify/memory/constitution.md` Version 4.0.0である。憲章は`AGENTS.md`を実務上の正本とし、次のゲートを計画・実装・レビューで確認する。

| 原則・制約 | 本Issueでの適用 | 判定 |
|---|---|---|
| Clear Naming | `getCurrentRoute`、`useSessionDraft`、`DISCUSSION_DESCRIPTION_MAX_LENGTH`、`POST_CONTENT_MAX_LENGTH`、`truncateDiscussionDescription`など、動作とドメインを表す名前を使う。 | PASS |
| Simple Logic | 評価表示の順序変更、`reason`経路の削除、`lg:justify-end`追加、既存`inline`再利用に限定する。下書き処理もロード→保存→削除の単純なhookにする。 | PASS |
| Structured Organization | UIは`src/app`／`src/components`、共通ナビゲーションは`src/lib/navigation`、フォーム下書きは`src/lib/forms`、ドメイン表示・制限値は`src/lib/discussion`へ置く。UIからDBへ直接アクセスしない。 | PASS |
| Type Safety | `unknown`からの型ガードで`sessionStorage` JSONを検証し、`any`を導入しない。既存のTypeScript strictを維持する。 | PASS |
| Test-First Development | 仕様回帰テストを先に変更し、production変更前にcollection/setupではないREDを確認する。直後にfresh read-only test reviewを実施し、PASS後にproductionを書く。 | PASS |
| Accessibility & UX | nativeの現在URL復帰、明確な日本語見出し・説明・placeholder、`role=status`のRuby境界、評価ボタンの読み上げ可能な順序、既存44pxタッチ領域、progressのARIAラベルを確認する。WCAG 2.2 1.3.1、2.4.4、2.4.6、2.5.8、4.1.2／4.1.3に関係する。 | PASS |
| Documentation & Comments | Issue本文、根因、非対象、受入条件、RED/GREEN、検証結果を本ディレクトリへ日本語で記録する。コメントは保存境界など理由が必要な箇所だけに置く。 | PASS |
| 文字サイズ・UIアイコン | 新規テキストを16px未満にしない。既存Lucideアイコンを維持し、手書きSVGや別アイコンライブラリを追加しない。 | PASS |
| 永続化・範囲 | 新規永続化なし。`sessionStorage`はIssueが要求するブラウザ一時下書きだけに限定する。Nostr、SQLite、GTFS、rate limitは変更しない。 | PASS |

**事前ゲート結論:** 違反なし。Phase 0の追加調査は不要で、現行実装・依存CSS・既存テストの証拠に基づいて実装へ進める。

## 技術コンテキスト

- **Language/Version:** TypeScript 5 strict、Node.js 22.x
- **Framework:** Next.js 15 App Router、React 19
- **UI:** Tailwind CSS 4、DaisyUI 5、Rubyful v2
- **Storage:** 既存Nostr／SQLiteを維持。今回の下書きのみブラウザ`sessionStorage`
- **Testing:** Jest、React Testing Library、既存のTypeScript AST/source contract tests
- **Target:** desktop／mobileのレスポンシブWebブラウザ
- **Performance:** API p95 200ms以内という既存制約を変更しない。下書き保存は小さなJSONの同期書き込みのみ。
- **Security:** 認証復帰先は既存`resolveSafeReturnTarget`を通し、外部URL・危険なqueryを許可しない。下書きをURLやrelayへ送らない。

## 設計

### A. 評価・投稿UI

1. `EvaluationComponent`の既定タイトルを `この論点は妥当だと思いますか？` に変更する。
2. 過剰な補足文 `論点が妥当だと思う、賛成できるなどの投稿は「はい」を押してください。` を削除する。
3. 投稿本文の`p`から`text-balance`を削除する。
4. `role="article"`のカードにはタグと本文だけを残す。評価ボタン群をカードの直後、`progress`の直前へ移動する。
5. progressのARIAラベルを `評価進捗 ${Math.round(progressPercentage)}%完了` にする。
6. `BusStopDiscussion`のタイトルを `このアドバイスは役に立ちますか？`、投稿見出しを `利用者へのアドバイスを投稿` にする。
7. 詳細ページの`新しい投稿`直下へ `不足している論点や、課題へのアイデアを投稿してください。` を追加し、textarea placeholderを次のIssue指定例へ変更する。

```text
例「はじめての方へ」の説明が読みにくいです。段落を風ぐるま自体の説明と、サイトの説明で分けるのはどうでしょう。
```

### B. 認証・現在URL・下書き

1. `src/lib/navigation/current-route.ts`に、ブラウザの`window.location.pathname`と`window.location.search`からhashを含めない相対現在URLを返す`getCurrentRoute()`を追加する。SSRでは`/`を返す。
2. `buildAuthRoute`／`buildLoginRoute`／`buildSignupRoute`から`reason`引数と`reason` query生成を削除する。`resolveSafeReturnTarget`は再利用する。
3. `AuthRoutePage`から`reason`の読み取り・alert/status表示を削除する。直接アクセス時の認証説明、returnTo付きのログイン／アカウント作成切替は維持する。
4. 会話作成、会話詳細投稿、経路検索のバス停投稿は、ログインが必要な操作で`buildLoginRoute(getCurrentRoute())`を使う。現在の経路検索queryも安全な`returnTo`へ含める。
5. `src/lib/forms/use-session-draft.ts`に、次の責務だけを持つ型付きhook／storage helperを追加する。
   - JSONの読み込みと型ガード
   - `sessionStorage`への保存（入力変更後すぐに保存）
   - 成功時のキー削除
   - storage unavailable／壊れたJSONは無視し、ページを壊さない
6. 3フォームの下書きキーを分離する。
   - 会話作成: 固定キー。タイトル、説明、モデレーター一覧、入力途中のモデレーターIDを保存
   - 会話詳細投稿: `naddr`ごとのキー。本文、バス停タグ、選択中ルートを保存
   - 経路検索の投稿: バス停集合ごとのキー。本文、バス停タグを保存
7. 初回マウント後に有効な下書きを復元し、投稿／会話作成のrelay公開成功後に該当下書きを削除する。認証失敗・validation失敗・publish失敗では削除しない。

### C. 制限値・一覧表示

1. `src/lib/discussion/limits.ts`へ`DISCUSSION_DESCRIPTION_MAX_LENGTH = 1000`と`POST_CONTENT_MAX_LENGTH = 1000`を置く。
2. 会話作成ページと`validateDiscussionCreationForm`の説明上限を共通定数へ置き換える。タイトル100文字は維持する。
3. `validatePostForm`と会話詳細／バス停投稿textareaの`maxLength`・カウンターを共通の投稿本文上限へ置き換える。
4. 会話編集ページの既存500文字仕様はIssueの明示対象外として変更しない。
5. `src/lib/discussion/display.ts`へ70文字＋`...`の`truncateDiscussionDescription`を置き、`/discussions`と`/settings`で同じ処理を使う。

### D. DaisyUI／レイアウト契約

1. `RouteSearchResults`のloading status親から`ruby-text`を外し、検索文だけをRuby対象の子要素へ置く。DaisyUI公式Loadingの`span.loading.loading-spinner`構造を維持する。
2. `SidebarLayout`のヘッダーへ`lg:justify-end`を追加し、メニューボタンが非表示になるPC幅でもテーマ切替を右寄せにする。スマホは`justify-between`で左右配置を維持する。
3. production上の21個の`.card-title`すべてへ既存`inline`を適用する（未対応18箇所）。新規CSS、DaisyUI全体上書き、Rubyful改修は行わない。

## 受入条件と検証対応

| ID | 受入条件 | 主な検証 |
|---|---|---|
| AC-01 | 評価タイトルが妥当性を尋ねる文言で、過剰な補足文がない | `EvaluationComponent.test.tsx` |
| AC-02 | `text-balance`が評価本文にない | `EvaluationComponent.test.tsx`、source確認 |
| AC-03 | 投票ボタンが投稿`article`の外・下、progressの上にある | `EvaluationComponent.test.tsx` |
| AC-04 | progressのARIAラベルがコロンなし | `EvaluationComponent.test.tsx` |
| AC-05 | バス停メモがアドバイス用語になっている | `BusStopDiscussion`関連test |
| AC-06 | 検索結果説明、詳細新規投稿の説明・placeholderがIssue指定値である | `routes`／detail関連test |
| AC-07 | 認証URLに`reason`がなく、現在の安全な相対URLとqueryを`returnTo`へ渡す | auth route／login／signup／投稿関連test |
| AC-08 | 3フォームが入力変更後に保存し、再訪で復元し、成功後に削除する | hook／create／detail／bus-stop関連test |
| AC-09 | 会話説明と投稿本文の上限が1000で、検証・属性・カウンターが一致する | limits／creation／nostr utils／UI tests |
| AC-10 | 検索結果loadingのRuby境界がスピナーを包まず、statusに直接テキストを置かない | `RouteSearchResults` test、layout boundary contract |
| AC-11 | テーマ切替ヘッダーがPC・スマホとも右寄せ可能なクラス構造を持つ | `SidebarLayout.test.tsx` |
| AC-12 | `/settings`の会話説明が`/discussions`と同じ70文字＋`...`になる | display／settings test |
| AC-13 | production全21箇所の`.card-title`が`inline`を持つ | `card-title-style-contract.test.ts` |
| AC-14 | 既存の表示、認証、Nostr、loading/error、ARIA、データ取得に回帰がない | focused／full Jest、strict TypeScript、lint、build、browser probe |

## 変更予定ファイル

### 新規

- `src/lib/navigation/current-route.ts`
- `src/lib/forms/use-session-draft.ts`
- `src/lib/discussion/limits.ts`
- `src/lib/discussion/display.ts`
- `src/lib/navigation/__tests__/current-route.test.ts`
- `src/lib/forms/__tests__/use-session-draft.test.tsx`
- `src/lib/discussion/__tests__/display.test.ts`
- `src/app/__tests__/card-title-style-contract.test.ts`
- 必要に応じた`RouteSearchResults`のloading回帰テスト

### production変更

- `src/components/discussion/EvaluationComponent.tsx`
- `src/components/discussion/BusStopDiscussion.tsx`
- `src/components/features/RouteSearchResults.tsx`
- `src/components/layouts/SidebarLayout.tsx`
- `src/lib/navigation/auth-route.ts`
- `src/components/auth/AuthRoutePage.tsx`
- `src/app/routes/page.tsx`
- `src/app/discussions/create/page.tsx`
- `src/app/discussions/[naddr]/page.tsx`
- `src/app/settings/page.tsx`
- `src/app/discussions/page.tsx`
- `src/lib/discussion/user-creation-flow.ts`
- `src/lib/nostr/nostr-utils.ts`
- `.card-title`未対応箇所を含む`src/components/discussion/DiscussionManagementModeratorPage.tsx`、`ModeratorManagementSection.tsx`、`src/components/ui`以外の対象ページ群（調査資料の一覧に限定）

### test変更

- `src/components/discussion/__tests__/EvaluationComponent.test.tsx`
- `src/components/discussion/__tests__/BusStopDiscussion.streaming.test.tsx`
- `src/app/discussions/[naddr]/__tests__/page.streaming.test.tsx`
- `src/app/discussions/create/__tests__/page.test.tsx`
- `src/app/routes/__tests__/page.test.tsx`
- `src/app/login/__tests__/page.test.tsx`
- `src/app/signup/__tests__/page.test.tsx`
- `src/app/settings/__tests__/page.streaming.test.tsx`
- `src/app/discussions/__tests__/page.streaming.test.tsx`
- `src/lib/navigation/__tests__/auth-route.test.ts`
- `src/app/__tests__/layout-boundary-contract.test.ts`
- `src/components/layouts/__tests__/SidebarLayout.test.tsx`
- `src/lib/discussion/__tests__/user-creation-flow.test.ts`
- `src/app/discussions/[naddr]/edit`配下は、Issueの非対象仕様を固定する既存テストを維持する

## 検証計画

### TDDゲート

1. 上記test pathだけを変更し、すべての新規・変更契約を追加する。
2. Node `v22.23.2`でfocused Jestを実行する。
3. REDは、collection/setupエラーではなく、旧production挙動に対する期待値不一致として記録する。
4. 別fresh read-only subagentがtestの仕様適合性、vacuous assertion、既存契約の保持をレビューする。`SUBAGENT_STATUS: COMPLETE`、`VERDICT: PASS`、`modified: false`、開始・終了SHA一致を親が確認する。
5. PASS後にproductionをタスク単位で実装し、focused GREENを親が再実行する。

### 最終ゲート

```bash
PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npm test -- --runInBand
PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npx tsc --noEmit --incremental false
npm run lint
npm run build

git diff --check
git status --short --branch
```

必要に応じて、開発サーバーまたは既存のPuppeteer環境で次を確認する。

- `/routes?...`のloading statusでDaisyUI spinnerのcomputed styleが維持され、`ruby-text`がstatus親やspinnerへ付かない
- `card-title inline`の全対象がDaisyUIのflex title境界を解除する
- PC幅・モバイル幅でテーマ切替が右上にあり、メニューボタンとの左右関係が崩れない
- 認証遷移後に3フォームのsessionStorage下書きが復元され、成功後に削除される

buildで既存の`transit-config.json`不足・GTFS取得・Prisma noticeが出た場合は、終了コードと今回の差分由来の失敗を分離して記録する。

## リスクと対策

- **下書きの型不正／古いデータ:** 型ガードで破棄し、空フォームで継続する。任意JSONをそのままstateへ入れない。
- **認証復帰先の危険化:** 現在URLをそのまま遷移せず、`buildLoginRoute`内で既存safe-return検証を通す。`reason`やaction-like queryは生成しない。
- **経路検索queryの欠落:** `getCurrentRoute`はpathnameだけでなくsearchも返し、focused testで具体的なqueryを確認する。
- **DaisyUI／Rubyful回帰:** `ruby-text`をsemantic textの最小要素だけへ置き、spinnerの公式構造を変更しない。既存layout boundary contractとsource／browser確認を併用する。
- **カード見出しの過剰変更:** `card-title`に既存`inline`を追加するだけにし、共通CSSやカード構造を変更しない。
- **文字数上限の不整合:** validation、`maxLength`、counterを同じ定数から生成し、1000文字ちょうどを受け入れ、1001文字を拒否するテストを置く。
- **既存仕様の混入:** 会話タイトル100、会話編集500、モデレーター申請の`reason`は変更しない。認証URLの`reason`だけを削除する。

## 実装完了の条件

AC-01〜AC-14を満たし、TDDのRED／review／GREEN証跡、全Jest、strict TypeScript、lint、build、browser相当確認、diff/status確認を記録する。変更は本計画のmanifest内に限定し、日本語の短いprefix commitでfeature branchへcommit・pushする。PRを作成する場合はbaseを`dev`とし、GitHubからhead/base/files/CIを読み戻す。mergeは行わない。
