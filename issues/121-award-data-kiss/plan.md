# Issue #121 受賞データの不要な抽象化削減 計画

- Issue: [#121](https://github.com/nawashiro/kazaguruma-transit/issues/121)
- 基準ブランチ: `dev`
- 基準SHA: `74d26f189f5db683a2cefae5d5fdc576c3a9638f`
- 実装ブランチ: `fix/issue-121-award-data-kiss`
- 仕様: [`spec.md`](./spec.md)
- 調査: [`investigation.md`](./investigation.md)
- 憲章: `.specify/memory/constitution.md` Version 4.0.0、実務上の正本は`AGENTS.md`

## Goal

受賞ページだけで使われる`src/lib/award/award-data.ts`を削除し、静的な文書内容を`src/app/award/page.tsx`へ直接戻す。共通`PageHeader`、受賞ページの表示、外部リンク、metadata、アクセシビリティ契約は維持する。

## Architecture

新しいデータ層は作らない。`AwardPage`が文書として必要な固定文字列とURLをJSXに直接持ち、`PageHeader`だけは横断的なUIとして既存componentを利用する。現在1つしかないconsumerのための`src/lib`データmoduleを除去し、データ取得・変換・状態管理は追加しない。

## Tech Stack

TypeScript 5 strict、React 19、Next.js 15 App Router、Tailwind CSS 4、DaisyUI 5、Jest、React Testing Library、Node.js 22.23.2。

## Constitution Check（設計前）

| 原則・制約 | 本Issueへの適用 | 判定 |
|---|---|---|
| Clear Naming | 共有されない受賞データのmoduleとexport名を削除し、既存のページ固有文書へ戻す。新しい意味不明なwrapperを作らない。 | PASS |
| Simple Logic | import削除、固定値のmarkupへの移動、不要module削除だけ。条件分岐、取得、fallback、永続化を追加しない。 | PASS |
| Structured Organization | 文書固有の表示は`src/app/award/page.tsx`、横断UIは`src/components/layouts/PageHeader.tsx`に残す。 | PASS |
| Type Safety | `unknown`、`any`、public API、schemaを追加せず、既存のstrict TypeScriptを維持する。 | PASS |
| Test-First Development | module削除／非importのsource contractを先に追加し、旧実装で意味のあるREDを確認してからproductionを変更する。 | PASS |
| Accessibility & UX | `PageHeader`、h1、説明、画像alt、linkのaccessible name、`target`/`rel`、既存classを変更しない。 | PASS |
| Documentation & Comments | 調査・仕様・計画・タスク・実測結果を`issues/121-award-data-kiss/`へ日本語で記録する。 | PASS |
| 範囲・KISS | 受賞ページ1枚の静的内容だけを対象にし、PageHeader、ホーム告知、metadata、共通CSS、設定を触らない。 | PASS |
| 永続化・外部作用 | 新規永続化、API、外部送信、DB、Nostr、GTFS変更なし。 | PASS |

**Gate Result (Pre-Design): PASS**

## 受入条件

| ID | 条件 | 証拠 |
|---|---|---|
| AC-01 | `award/page.tsx`が`award-data`をimportしない | 構造回帰テスト、source search |
| AC-02 | `award-data.ts`を削除する | ファイル存在確認、diff |
| AC-03 | 静的な受賞ページの表示値と外部リンクを維持する | 既存AwardPage test、full Jest |
| AC-04 | `PageHeader`、metadata、ARIA、レスポンシブclassを維持する | diff review、focused test |
| AC-05 | Issue #122後のホーム告知や他の共有componentを変更しない | hard write boundary、diff/status |
| AC-06 | RED→fresh read-only review→GREENを実施する | T003〜T006の実測記録 |
| AC-07 | strict TypeScript、lint、全Jest、build、diff checkを通す | 最終品質ゲート |

## 変更manifest

### 許可

- `src/app/award/page.tsx`
- `src/app/award/__tests__/page.test.tsx`
- `src/lib/award/award-data.ts`（削除）
- `issues/121-award-data-kiss/investigation.md`
- `issues/121-award-data-kiss/spec.md`
- `issues/121-award-data-kiss/plan.md`
- `issues/121-award-data-kiss/tasks.md`

### 変更禁止

- `src/components/layouts/PageHeader.tsx`とそのテスト・利用ページ
- `src/app/award/layout.tsx`
- `src/app/page.tsx`、運営告知、Sidebar、sitemap
- `package.json`、`package-lock.json`、設定、環境変数、CSS、画像、Nostr、Prisma/SQLite、GTFS、認証
- 旧branchのstash、他Issueの文書、無関係なsource/test

## 実装方針

1. 既存`page.test.tsx`へ、`award-data` importがないことと、専用moduleが存在しないことを検証するsource contractを追加する。
2. Node 22で、旧productionに対してそのテストがcollection/setup以外の理由でREDになることを確認する。
3. 別fresh read-only reviewerがテストの仕様適合性、非形骸性、既存assertion維持、REDの意味、無変更境界を確認する。PASS前にproductionを変更しない。
4. production writerが`page.tsx`のimportを削除し、8つの静的値をJSXへ直接移し、`award-data.ts`を削除する。PageHeaderと表示構造は維持する。
5. 親が現行bytes、scoped diff、focused GREEN、禁止pathの不変性を再確認する。
6. 旧productionを一時的に復元して新規構造テストが再び失敗することを確認し、修正状態へ必ず戻す。

## 実装上の注意

- `PageHeader`の使用を削除しない。今回の対象は受賞データmoduleだけである。
- static document contentとしてJSXへ直接記述し、別のlocal object、shared helper、JSON、fallbackは追加しない。
- `AWARD_BADGE_URL`は画像リンクとボタンの2箇所に必要だが、データmoduleを再作成せず静的URLを各markupへ記述する。
- `AWARD_PRIZE`などの表示値は既存テストの期待値と一致させる。
- 既存の`aria-label`、`alt`、`target="_blank"`、`rel="noopener noreferrer"`を保持する。

## 検証コマンド

```bash
PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npm test -- --runInBand --runTestsByPath src/app/award/__tests__/page.test.tsx --silent
PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npx tsc --noEmit --incremental false
PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npm run lint
PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npm test -- --runInBand
PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npm run build
git diff --check
git status --short --untracked-files=all
```

`npm run build`はGTFS importとNext.js production buildを含むため最終品質ゲートで一度だけ実行する。`transit-config.json`不足など既存環境由来の表示と、終了コード・build結果を分離して記録する。

## リスクと対策

- **表示値の欠落・変更:** 既存の全表示テストを維持し、仕様へ値とURLを固定する。
- **PageHeaderの誤削除:** production writerのhard boundaryを`page.tsx`と削除対象moduleだけに限定し、PageHeader本体を禁止pathにする。
- **別consumerの見落とし:** 実装前後にproduction source全体を`award-data`と`AWARD_`で検索し、consumerが0件になることを確認する。
- **テストの形骸化:** 旧実装でREDを記録し、旧production復元の感度確認を行う。
- **無関係な#122変更の混入:** `src/app/page.tsx`とannouncement関連を禁止pathにし、差分を親が再確認する。

## Constitution Check（設計後）

- [x] 受賞データの共有moduleだけを削除し、合理的な`PageHeader`は維持した。
- [x] static document contentをpage componentへ戻し、別のデータ抽象化を作らない。
- [x] 既存表示、ARIA、外部リンク、metadata、ホーム告知の境界を受入条件へ記録した。
- [x] test writer→fresh read-only review→production writer→親検証の順序を定義した。
- [x] `issues/121-award-data-kiss/`へ日本語資料を集約する。

**Gate Result (Post-Design): PASS**

## 実装後の検証結果

- T003のtest writerは、`page.tsx`の`award-data` importと`award-data.ts`の存在を検出する2 assertionを追加した。旧productionで2 failed / 3 passedの意味あるREDになった。
- T004のfresh read-only reviewは`VERDICT: PASS`、`modified: false`、開始／終了SHA一致だった。`PageHeader`を誤って対象にせず、既存表示assertionも維持していることを確認した。
- T005/T006で`page.tsx`へ静的値を戻し、`award-data.ts`を削除した。親のfocused Jestは1 suite / 5 tests passed。production sourceの旧module参照は0件で、PageHeader・metadata・ホーム告知は不変である。
- T007の旧production復元確認は2 failed / 3 passed、修正版復元後は5 passed。page hashは復元前後で一致し、旧data moduleは残っていない。
- T008はstrict TypeScript exit 0、lint exit 0、全Jestは2 skipped / 145 passed suites・13 skipped / 916 passed tests、build exit 0、`git diff --check` exit 0だった。既存warning、`next lint` deprecated、`transit-config.json`不在のGTFS表示は差分由来のfailureではない。

## 配送後の検証

- 実装commit `0f8b4f2e4f1d94d15147f1632c7dc6c4f06a85bd`をfeature branchへpushし、GitHub/Tangledのremote SHA一致を確認した。
- PR [#137](https://github.com/nawashiro/kazaguruma-transit/pull/137)をbase=`dev`、head=`fix/issue-121-award-data-kiss`で作成した。PRはOPENのまま維持し、merge・Issue closeは行わない。
- 初回head SHAに対するQuality Gate run `33965181559` / job `101303928699`は`success`で、checkout、ESLint、strict TypeScript、Jestを含む全stepが成功した。
