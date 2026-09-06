# Issue #79 調査と仕様の入口

- Issue: https://github.com/nawashiro/kazaguruma-transit/issues/79
- 調査日: 2026-09-05
- 起点: `dev`の`8b0ce9649b478b47b72f8ee47ec00c0be74ee8ea`
- 作業ブランチ: `spec/issue-79-uri-pages`
- 仕様正本: [spec.md](../../specs/023-location-pages-route-form/spec.md)
- 品質確認: [requirements.md](../../specs/023-location-pages-route-form/checklists/requirements.md)

## 作業境界

変更前はclean。`git switch dev`と`git pull --ff-only origin dev`で最新化した。今回の依頼は仕様作成と質問まで。アプリの実装、テスト追加、plan/tasks作成、公開操作は行わない。

Spec Kitの連番規約に従い、新規仕様を`specs/023-location-pages-route-form`へ置く。Issue配下では仕様を複製せず、正本へのリンクと調査証拠を保持する。

## 現行実装との照合

| 対象 | 確認した挙動 | 仕様への影響 |
| --- | --- | --- |
| `src/app/page.tsx:25-48` | 目的地のJSONクエリを読み、成功後にURLを消す。優先条件は端末設定から読む。 | 通常の座標クエリと部分入力へ変更する。URLを維持する。 |
| `src/app/page.tsx:78-140` | 目的地、出発地、日時を順次表示する。 | 全項目を初期表示し、個別修正で他項目を保持する。 |
| `src/app/locations/page.tsx:60-110` | ブラウザで施設と町字分類を読み込む。カテゴリは一時状態。 | ビルド時の表示準備とカテゴリURLを定義する。 |
| `src/app/locations/page.tsx:143-245` | 現在地・住所を基準に距離順表示する。 | 静的化に伴う機能の存廃を質問する。 |
| `src/app/location-detail/[id]/page.tsx:24-35,65-75,229-241` | 詳細は既にサーバー側のページ。「ここへ行く」も既にリンク。ただしビルド時の全件生成指定はなく、戻り先は一覧固定。 | 未実施項目だけを定義する。旧Issueの「JSボタン」を現状として扱わない。 |
| `src/components/features/LocationSuggestions.tsx:31-46,95-134` | `main_facilities.json`をブラウザで取得し、カテゴリボタンから候補ボタンを表示する。 | 静的化と選択導線の方式を分けて確認する。 |
| `src/utils/addressLoader.ts:40-75,145-163` | トップ候補と詳細付き一覧は異なるデータ。設定の更新版を使う。取得失敗を空配列にする旧ローダーもある。 | データ集合を維持し、ビルド時失敗を成功扱いしない。 |
| `src/lib/location/location-detail-resolver.ts:64-119` | 全カテゴリを通じた施設識別子の重複をエラーにする。 | 所属カテゴリを一意に定める既存契約を維持する。 |
| `src/lib/transit/route-search-query.ts:68-109` | `origin,destination,time,isDeparture,prioritizeSpeed`を解釈する。 | 入力URLでも名前と値の形式を揃える。ただし部分入力を許可する。 |
| `src/components/features/DateTimeSelector.tsx:24-27,119-145` | 日時ラベルと説明を選択状態で変更する。 | 日時ラベルを固定する。 |

## 関連Issueと憲章

- Issue #77はOPEN。サイト全体のカード整理は別件。
- Issue #80はOPEN。座標から地名への変換サービス置換は別件。
- `.specify/memory/constitution.md:160-164`は後方互換の追加実装と旧経路の温存を禁止する。
- `specs/016-bookmarkable-route-results/spec.md`の入力と結果の分離を維持する。
- `resolve-template.sh spec-template --json`は成功。ローカルの仕様テンプレートを解決した。
- `.specify/extensions.yml`は存在しない。前後フックは対象外。

## ユーザー確認結果

2026-09-05に3点を確認し、仕様へ反映した。

- Q1: 距離順表示を残す。町字別一覧は静的に用意し、明示操作後だけ動的に並べ替える。
- Q2: トップページ内にカテゴリ別の標準選択欄を残す。全候補をビルド時に用意し、他の入力を保持する。
- Q3: 確定した地点だけ「住所＋なおす」にする。他のセクションを表示し続け、該当地点だけ再入力する。

仕様品質チェックは全項目を確認済み。実装の動作確認とは区別する。

## T022 テスト移行の調査記録（2026-09-06）

### 旧production参照の検索範囲

`src/app` と `src/components` 配下の `.ts` / `.tsx` を対象にし、パスに `__tests__` を含むファイルを除外した96ファイルを走査した。次の旧削除経路をliteral文字列で検索した結果はすべて0件だった。

- `@/app/location-detail/[id]/page`
- `src/app/location-detail/[id]/page`
- `@/app/location-detail/[id]/loading`
- `src/app/location-detail/[id]/loading`

テスト・調査資料には旧経路を参照する箇所が残り得るため、T022の書込対象であるアクセシビリティ・レイアウトテストだけを移行した。旧ローダー自体（`src/utils/addressLoader.ts`）の削除やproduction変更はこのタスクの対象外である。

### T022で検証する新経路とfixture

- 詳細ページ: `src/app/locations/location-detail/[id]/page.tsx`
- 生成スナップショット: `src/generated/location-data.json`
- カテゴリ: `city_office_and_branch_offices`
- 施設: `5e3b1528-8af6-436a-83af-24ca45b58e12`（`千代田区役所`）
- `accessible-route-pages.test.tsx` と `SidebarLayout.test.tsx` は上記fixtureを生成JSONから読む。旧 `loadKeyLocationsDataResult` mockと架空施設fixtureには依存しない。
- `accessibility-source-contract.test.ts` は新詳細routeのPageHeader/Link/Promise params契約を維持し、OriginSelector/DestinationSelectorの子`<form>`要求だけを削除した。外側のformは`RouteSearchForm`が所有するため、selector側に子formを再要求しない。

### T022 focused verification

実行コマンド:

```text
node_modules/.bin/jest --runInBand src/app/__tests__/accessible-route-pages.test.tsx src/app/__tests__/accessibility-source-contract.test.ts src/components/layouts/__tests__/SidebarLayout.test.tsx
```

結果: 3 suites中2 passed、1 failed。19 tests中18 passed、1 failed。module collection errorはなく、失敗は新詳細routeに `generateMetadata` exportがまだないための意図したRED（`typeof ...generateMetadata` は `undefined`）だけだった。loading testは静的な新routeに対応するloading fileがないため削除した。`git diff --check` は成功した。

この記録はT022のテスト移行とRED境界を示すものであり、production実装、build成功、またはmetadata実装完了を主張しない。

### TypeScript check

```text
node node_modules/typescript/bin/tsc --noEmit --incremental false
```

終了コード2。既存の `.next/types/app/location-detail/[id]/page.ts` が削除済みの `src/app/location-detail/[id]/page.js` を参照している stale type生成物で失敗した。T022のproduction変更によるエラーとは切り分け、`.next`やproductionは変更していない。

## T057〜T066: 既知SSGと統一404方針

初回T057の隔離Next runtimeでは、未知URLがsegment not-found/default 404になり、ページ側の日本語状態へ到達せずFAILだった。T057の単体テストGREENだけでは、Nextの実URL挙動を確認できなかった。

T060では、`dynamicParams = true`と安全なカテゴリID decode（safe decode、二重decode）を修正した。これは当時の未知ページ状態を試す暫定方針であり、既知カテゴリ・詳細を`generateStaticParams`でSSGする契約とT058 focused 12/12 PASSを親が確認した。現在の最終方針では採用しない。

T061は検証スクリプトと設計記録だけを更新した。T060後のfresh isolated Next runtimeは再実行していない。

T063〜T065でユーザーの最終決定を反映し、カテゴリ・詳細へ`dynamicParams = false`、既知パスの`generateStaticParams`、防御的な`notFound()`、グローバル`src/app/not-found.tsx`を採用した。未知カテゴリ・詳細は同じHTTP 404、見出し「ページが見つかりません」、本文「お探しのページは見つかりませんでした。」となり、`/locations`への戻るリンクを設けない。カテゴリ・詳細固有のnot-foundは作らない。

T067/T068の関連17テストは親確認で17/17 PASSだった。T066は検証スクリプトと設計記録をこの最終方針へ揃える作業である。ユーザー修正後のfresh isolated Next runtimeはまだ実行していないため、既知ページのSSG、未知URLのHTTP 404、共通本文、戻るリンクなし、実行時CDN取得0件についてfresh runtime PASSは主張しない。
