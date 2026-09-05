# Issue #121 調査記録

- Issue: [#121](https://github.com/nawashiro/kazaguruma-transit/issues/121)
- タイトル: `chor: 受賞は抽象化が必要ないはず`
- 状態: `OPEN`（`REOPENED`）、コメント0件、ラベルなし、担当者なし
- 対象リポジトリ: `nawashiro/kazaguruma-transit`
- 基準ブランチ: `dev`
- 基準SHA: `74d26f189f5db683a2cefae5d5fdc576c3a9638f`
- 実装ブランチ: `fix/issue-121-award-data-kiss`
- 作業言語: 日本語
- 調査日: 2026-09-05 UTC

## 1. 開始状態と基準の確認

`origin/dev`をfetchして最新化し、`fix/issue-121-award-data-kiss`を`origin/dev`から作成した。作業開始時の状態は次のとおりである。

```text
branch=fix/issue-121-award-data-kiss
HEAD=74d26f189f5db683a2cefae5d5fdc576c3a9638f
tracking=origin/dev
status=## fix/issue-121-award-data-kiss...origin/dev
git diff --check=exit 0
```

リポジトリの実務上の規約は`AGENTS.md`、Spec Kit互換の憲章は`.specify/memory/constitution.md` Version 4.0.0である。実装前に両方を読み、作業言語、KISS、TypeScript strict、TDD、Jest・lint・build検証、既存UIとアクセシビリティ維持を適用する。

Node.jsはリポジトリ指定の22.xとして、環境内の`v22.23.2`を使用する。

## 2. Issueと重複作業

GitHub API/CLIでIssue本文・状態・コメント・ラベル・担当者を読み戻した。

- 本文: `https://kazaguruma-transit.nawashiro.dev/award 必要のない抽象化が行われているかもしれません。受賞データというロジックとしては必要ないものがあるようです。受賞を主張するのは文書の都合であって、ロジックの都合ではありません。除去する必要があるかもしれません。`
- コメント: 0件
- Issueはopenで、現在のstate reasonはreopened

次のPR検索を実行した。

```bash
gh pr list --repo nawashiro/kazaguruma-transit --search '121' --state all --limit 100
gh pr list --repo nawashiro/kazaguruma-transit --search 'award data' --state all --limit 100
gh pr list --repo nawashiro/kazaguruma-transit --search 'award' --state all --limit 100
```

Issue #121を対象とするPRはない。「award data」には該当PRがなく、「award」では#117（Issue #106の不要span整理）と#135（Issue #122のルート告知）が見つかったが、今回の共有データモジュール削除とは別件である。Issue #122のPR #135はmerge済みであり、現在の利用状況を確認するうえで関連する。

## 3. 現行コードとデータフロー

### 3.1 `/award`の利用経路

`src/app/award/page.tsx`は静的なNext.js App Routerページである。現行の経路は次のとおり。

1. `next/image`と共通の`PageHeader`をimportする。
2. `@/lib/award/award-data`から受賞名、賞名、選出区分、授与日、発行者、3つのURLをimportする。
3. `PageHeader`、受賞バッジカード、評価された取組カードを描画する。
4. 受賞データは表示文字列、画像URL、外部リンクの値としてのみ使われる。
5. API、状態管理、DB、Nostr、GTFS、認証、計算処理は経由しない。

`PageHeader`は他の多数のページでも使われる正当な共通UIであり、今回削除対象ではない。

### 3.2 `award-data.ts`のconsumer数

基準SHAでproduction sourceを検索した結果は次のとおりである。

```text
git grep -n 'award-data\|AWARD_' -- ':!issues/*' ':!specs/*'
```

該当するimportは次の1箇所だけである。

```text
src/app/award/page.tsx:12:} from "@/lib/award/award-data";
```

`src/lib/award/award-data.ts`自体は、受賞に関する8つの静的定数をexportするだけで、ロジック、変換、検証、取得、共有可能なドメイン型を持たない。#122のPR #135でホーム側の`AwardRecognition`が運営告知へ置き換えられたため、現在はページ1枚のためだけに`src/lib`のデータモジュールが存在している。

なお、過去の基準ではホーム側にもconsumerが存在したが、最新`origin/dev`ではその経路は削除済みである。古い作業記録やstashの前提を現在のconsumer数として再利用しない。

### 3.3 既存ページとの比較

`src/app/beginners-guide/page.tsx`や`src/app/usage/page.tsx`は、静的な案内文と外部URLをページ自身のJSXへ直接記述している。受賞ページも同じ文書ページとして扱える。`award-data.ts`を残す理由となる別consumerや動的処理は、基準コードにはない。

## 4. 履歴と設計意図

関連履歴を確認した。

- `1ed1b7c add: showcase hackathon award`: 受賞ページと`award-data.ts`を追加した。
- `d5378fe refactor: unify page DOM and alignment`: 受賞ページを`PageHeader`利用へ変更した。これは共通UIとして合理的であり、今回の対象外である。
- `e865502 fix: remove redundant award badge`以降: 受賞ページ内の表示整理を行った。
- `cbeb9ae fix: Issue #106の不要なspanとDaisyUI gapを整理`、`910426a fix: Issue #128の細かい修正を反映`: 現在の見出し・ルビ・クラス構造を整理した。
- `74d26f1 1.5.4`: #122の統合後の最新`dev`であり、ホーム側の受賞専用表示は既に運営告知へ移行している。

履歴上、`award-data.ts`は初回受賞ページ実装時の表示値の切り出しとして追加されたが、現在の要件では共有ロジックではない。Issue #121は受賞の表示内容を削除する要求ではなく、文書専用の値を`src/lib`の再利用可能そうなデータ構造として切り出していることを簡素化する要求と解釈する。

## 5. 基準テスト

Issueに直接関係する現行テストをNode.js 22.23.2で実行した。

```bash
PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npm test -- --runInBand --runTestsByPath src/app/award/__tests__/page.test.tsx --silent
```

結果:

```text
Test Suites: 1 passed, 1 total
Tests:       3 passed, 3 total
```

最初に、過去に存在した`src/components/features/__tests__/AwardRecognition.test.tsx`も指定したが、#122統合後の基準コードにはそのファイルがなく、`ENOENT`で失敗した。これは実装失敗ではなく、古いテストパスを指定したprobeの誤りである。正しい現行テストパスへ修正して上記の3テストが通ることを確認した。未実施のテストを成功扱いにはしない。

既存テストは受賞内容、画像・リンク先、見出し、スタイル契約を検証するが、`award-data.ts`が不要な専用構造であることや、ページがそのmoduleをimportしないことは検証していない。

## 6. 根因

根因は、動的ロジックも共有consumerもない静的な受賞文書の値を、`src/lib/award/award-data.ts`という別moduleへ抽象化していることである。最新`origin/dev`ではconsumerが`src/app/award/page.tsx`の1箇所だけなので、この抽象化は再利用性を提供せず、文書内容とページの対応箇所を分散させている。

`PageHeader`の使用は別問題である。`PageHeader`は多くのページで共通のsemantic header構造を提供しているため、維持する。`award/layout.tsx`のmetadataもroute固有の責務であり維持する。

## 7. 実装境界

### 変更するファイル

- `src/app/award/page.tsx`
  - `@/lib/award/award-data`のimportを削除する。
  - 受賞名、賞名、選出区分、授与日、発行者、作品紹介URL、バッジ画像URL、バッジ確認URLを静的文書のJSXへ直接記述する。
  - `PageHeader`、カード構造、画像属性、リンクの`target`/`rel`、見出し、文章、metadataの表示結果を維持する。
- `src/lib/award/award-data.ts`
  - 1 consumerのため不要となるので削除する。
- `src/app/award/__tests__/page.test.tsx`
  - ページが`award-data`をimportせず、専用moduleが残っていないことを検証するsource contractを追加する。
  - 既存の表示・外部リンク・スタイル契約は維持する。
- `issues/121-award-data-kiss/`配下の調査・仕様・計画・タスク・実測記録

### 変更しないファイル・経路

- `src/components/layouts/PageHeader.tsx`および他ページの利用箇所
- `src/app/award/layout.tsx`のmetadata
- `src/app/page.tsx`、運営告知、Sidebar、sitemap
- `src/components/features`、app-config、package.json、lockfile
- Nostr、Prisma/SQLite、GTFS、認証、API、永続化、外部URLの値
- 共通Card、CSS、Ruby処理

## 8. 結論

Issue #121の最小かつ正確な修正は、`PageHeader`を維持したまま、受賞ページだけで使う`award-data.ts`を削除し、静的文書の内容を`src/app/award/page.tsx`へ戻すことである。値の表示結果と既存のアクセシビリティ・外部リンク契約は変えず、別の共有抽象化やfallbackは追加しない。

## 9. 実装後の検証

T003で`src/app/award/__tests__/page.test.tsx`へ、pageの`award-data` importと専用moduleの存在を検出する2つのcontractを追加した。旧productionに対しては`2 failed / 3 passed`で、collection/setup errorではない意味のあるREDだった。T004のfresh read-only reviewは`SUBAGENT_STATUS: COMPLETE`、`VERDICT: PASS`、`modified: false`、開始／終了SHA一致だった。

T005で`src/app/award/page.tsx`からimportと`AWARD_*`参照を削除し、8つの静的値をJSXへ直接記述した。`PageHeader`、既存のカード、画像alt、リンク属性、文章は維持した。`src/lib/award/award-data.ts`は削除した。親のfocused testは次の結果でGREENだった。

```text
Test Suites: 1 passed, 1 total
Tests:       5 passed, 5 total
```

旧productionのpageとdata moduleを一時復元した感度確認では2 failed / 3 passedとなり、修正版へ復元後は5 passedとなった。修正前後でpageのSHA-256が一致し、data moduleは不在、旧状態はworktreeに残っていない。

最終品質ゲートはNode.js `v22.23.2`で実行した。

- strict TypeScript: exit 0
- lint: exit 0。`next lint`のdeprecated表示と既存の`any`、`<img>`、Hook依存関係などのwarningあり
- full Jest: 2 skipped / 145 passed suites、13 skipped / 916 passed tests、929 tests total、exit 0
- production build: exit 0。Prisma生成・schema同期・Next.js buildは成功。`transit-config.json`不在による既存GTFS importエラー表示、Prisma update notice、既存lint warningは終了コード0と分離
- `git diff --check`: exit 0
- 最終status: `src/app/award/__tests__/page.test.tsx`、`src/app/award/page.tsx`の変更、`src/lib/award/award-data.ts`の削除、Issue文書4件だけ。buildによるtracked変更はない

production source全体の`award-data`／`AWARD_`検索は、凍結した回帰テスト内の検証文字列を除き0件である。`PageHeader`、`award/layout.tsx`、ホーム運営告知には差分がない。
