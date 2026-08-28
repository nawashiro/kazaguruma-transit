# Issue #108 調査記録

- Issue: [#108](https://github.com/nawashiro/kazaguruma-transit/issues/108)
- タイトル: `chor: 雑多なアイコンライブラリ・svg残存をLucideに統一する`
- 調査日: 2026-08-28
- 対象リポジトリ: `nawashiro/kazaguruma-transit`
- 対象ブランチ: `chore/issue-108-lucide`
- 対象ベース: `dev`
- ベースSHA: `616610daa08f73f473f776dc7d46827896d7b888`
- 作業ツリー: `/opt/data/work/kazaguruma-transit-issue-108`

## 1. Issue と既存作業の状態

- Issue #108 は open、コメントなし、担当者なし、ラベルなし。
- `gh pr list --search "#108" --state all`、`issue 108`、`accessibility OR error` の検索で関連する既存PRは見つからなかった。
- `dev` は調査開始時の `9be674d62af5db40723d324a2f6ca2db666bce83` から `origin/dev` の `616610daa08f73f473f776dc7d46827896d7b888` へ fast-forward した。
- `chore/issue-108-lucide` は更新済み `origin/dev` から作成した。
- worktree 作成時に `src/app/apple-icon.png` が Git LFS pointerとの差分として dirty になった。これはIssue作業の変更ではなく、最後まで変更・復元・stageしない。
- `npm install` は最初 Node v26.5.1 で `better-sqlite3` のビルドに失敗した。リポジトリ指定のNode 22.xに合わせ、既存の `/opt/data/toolchains/node-v22.23.2`（v22.23.2 / npm 10.9.8）で再実行し、1380 packagesを導入できた。

## 2. 憲章・リポジトリ規約

`AGENTS.md` と `.specify/memory/constitution.md` を読み合わせた。今回直接適用する規約は次のとおり。

- 作業言語は日本語。
- 変更は TDD。テストを先に書き、意味のあるREDを確認してから本番コードを変更する。
- 本番実装タスクは親が受入条件と書込境界を定義し、サブエージェントへ委任する。
- テスト実装直後に、別の読み取り専用サブエージェントによるテストレビューを置く。
- 本番実装後のレビュータスクは置かない。親が実変更、SHA、focused test、TypeScript、Lint、diffを検証する。
- UIアイコンは `lucide-react` のアイコンコンポーネントだけを使用する。Heroicons、react-icons、手書きのインラインSVGは禁止する。
- 不要な旧実装は残さず、旧ライブラリを依存関係から削除する。
- TypeScript strict、2-space indentation、既存の画面挙動・アクセシブルな名前・`aria-hidden`を維持する。
- 完了前に `npm test`、`npm run lint`、`npm run build` を実行する。

## 3. 現状の証拠

### 3.1 依存関係

`package.json` と `package-lock.json` の直接依存関係は次の状態だった。

```text
@heroicons/react: ^2.2.0
react-icons: ^5.7.0
lucide-react: 未導入
```

`node_modules` 導入後も `npm ls @heroicons/react react-icons lucide-react --depth=0` は旧2ライブラリのみで、Lucideは未導入だった。

### 3.2 旧アイコン import

production code（`src/app` と `src/components`、テストを除外）94ファイルを走査した結果、20ファイルに23件の旧ライブラリ import がある。

| 範囲 | ファイル |
|---|---|
| feature | `src/components/features/RoutePdfExport.tsx`, `OriginSelector.tsx`, `DestinationSelector.tsx`, `RouteCalendarExport.tsx`, `LocationSuggestions.tsx` |
| shared UI | `src/components/ui/NpubDisplay.tsx`, `ThemeToggle.tsx`, `InputField.tsx`, `CarouselCard.tsx` |
| layout | `src/components/layouts/Sidebar.tsx`, `SidebarLayout.tsx` |
| app route | `src/app/locations/page.tsx`, `settings/page.tsx`, `discussions/create/page.tsx`, `discussions/manage/page.tsx`, `discussions/[naddr]/approve/page.tsx`, `discussions/[naddr]/edit/page.tsx` |
| discussion | `src/components/discussion/DiscussionRoleCard.tsx`, `DiscussionTabLayout.tsx`, `EvaluationComponent.tsx` |

旧ライブラリの内訳は、Heroiconsが outline/solid 合計、react-iconsが `fi`/`md` 合計である。対象コンポーネントは装飾アイコンの `aria-hidden`、既存のアイコン付き操作、状態表示を持つため、単純削除ではなくLucide相当アイコンへ置換する。

### 3.3 SVG残存

TSX production codeに実行される `<svg>` 要素はない。既存のアイコン置換時に残された手書きSVGの属性・`<path>`断片をコメントとして、次の4ファイルが保持している。

- `src/app/discussions/create/page.tsx`
- `src/app/locations/page.tsx`
- `src/components/features/LocationSuggestions.tsx`
- `src/components/discussion/EvaluationComponent.tsx`

Issueの「svg残存」を再発させないため、Lucide置換時にこれらの死んだSVGコメントも削除する。既存の `src/app/__tests__/accessibility-source-contract.test.ts` は JSX コメントを除去してから `<svg>` を検査するため、現在はGREENでも死んだ断片は検出しない。このIssue用の契約テストでは、旧importとSVG markup断片の両方を検出する。

### 3.4 静的 app icon

`src/app/icon.svg` は Next.js App Router の静的アプリ用アイコンであり、画面内に描画するUIアイコンではない。Lucide React componentへ機械的に置き換える対象ではなく、今回の本番変更から除外する。テストも `src/app/icon.svg` をUI source scanへ含めない。除外理由をこの記録とtasksへ残し、ブランド用静的資産を誤って削除しない。

### 3.5 既存履歴

- `544c6cf` は一部の手書きSVGをアイコンへ置換した。
- `5867b69` は絵文字やSVGをHeroiconsへ置換した。
- `df4200a` 以降、PDF・検索・カレンダーでreact-iconsが追加された。
- Issue #107 に伴う憲章3.0.0で「UIのアイコンはLucideだけ」と明文化された。

したがって今回のIssueは、既存の部分的なHeroicons移行をLucideへ完了し、後発のreact-iconsと死んだSVG断片を整理する作業である。データ層、画面遷移、認証、Nostr、GTFS、DBは変更理由がないため対象外とする。

## 4. 受入条件

1. production codeに `@heroicons/react` と `react-icons` の importがない。
2. production codeに手書きSVGの実装・残存コメント断片（`xmlns="http://www.w3.org/2000/svg"`、`<path`等）がない。
3. `package.json` と `package-lock.json` に `lucide-react` があり、`@heroicons/react` と `react-icons` が直接依存関係から削除されている。
4. 既存アイコンの意味、操作のaccessible name、装飾アイコンの `aria-hidden`、サイズ・色・classNameを可能な限り保持する。
5. `src/app/icon.svg`、LFS pointer差分の `src/app/apple-icon.png`、既存の非対象ファイルを変更しない。
6. Issue専用静的契約テストが、変更前に旧ライブラリまたはSVG残存を理由としてREDになり、変更後にGREENになる。
7. Node 22.23.2環境で focused test、strict TypeScript、Lint、全Jest、buildを実行し、既存warning・環境制約・失敗を成功と混同しない。

## 5. 実装方針

- Lucideの名称対応は意味を優先する。例: `HomeIcon`→`House`、`InformationCircleIcon`→`Info`、`ExclamationCircleIcon`→`CircleAlert`、`FiSearch`→`Search`、`MdMyLocation`→`LocateFixed`、`FiDownload`→`Download`。
- LucideのSVG出力はライブラリコンポーネントの内部実装であり、手書きSVG禁止の対象ではない。production sourceには手書き要素を書かない。
- React componentには必要な `className`、`aria-hidden`、`height`、`width` を移し、見た目と支援技術向け意味を保つ。
- 依存追加は最初の本番実装タスク、旧2ライブラリの削除は全import移行後の最終整理タスクで行う。途中状態をGREENと報告しない。
- 各writerは指定pathだけを書き、commit・push・reset・clean・他タスクのpath編集をしない。親は各返却後にstatus、diff、対象テスト、SHAを再確認する。

## 6. 調査時点の検証

| コマンド | 結果 |
|---|---|
| `git fetch origin dev` | 成功。`origin/dev=616610daa08f73f473f776dc7d46827896d7b888` |
| `git rev-list --left-right --count dev...origin/dev` | 更新前 `0 5`。ローカル `dev` をorigin/devへfast-forward |
| `npm install --no-audit --no-fund` (Node 26) | 失敗。`better-sqlite3` native buildがNode 26 API差分で停止 |
| Node 22.23.2で同コマンド | 成功。1380 packages added |
| `npm test -- --runInBand --runTestsByPath src/app/__tests__/accessibility-source-contract.test.ts --silent` | 1 suite / 6 tests PASS。旧import・死んだSVG断片は未検査 |
| `npx tsc --noEmit --incremental false` | PASS |
| `npm run lint` | exit 0。既存warningと`next lint` deprecation noticeのみ |
| `git diff --check` | PASS。LFS pointer差分はwhitespace対象外 |

## 7. 結論

Issue #108の原因は、憲章がLucide限定へ更新された後も、production codeと直接依存関係がHeroicons/react-icons混在のまま残り、過去の置換で不要なSVGコメントも残っていることである。修正境界は、旧アイコン利用20ファイル、依存関係2ファイル、死んだSVGコメント4ファイル、Issue専用契約テスト1ファイルに限定する。静的 `src/app/icon.svg` とLFS pointer差分は変更しない。

## 8. 実装後検証

T005〜T009で、旧アイコンをLucideへ置換し、既知の死んだSVGコメントを削除した。最終状態は次のとおりである。

- `package.json` / `package-lock.json`: `lucide-react@1.35.0` を追加し、`@heroicons/react` と `react-icons` を削除。
- production code: 旧ライブラリ参照0件、手書きSVG断片0件。`src/app/icon.svg`は静的app iconとして保持。
- Issue契約: 1 suite / 5 tests PASS。
- slice focused tests: shared UI/layout 5 suites / 29 tests、feature 5 suites / 31 tests、app route 6 suites / 51 tests、discussion 3 suites / 25 testsがすべてPASS。
- strict TypeScript: `npx tsc --noEmit --incremental false` exit 0。
- Lint: `npm run lint` exit 0。既存の`any`、`<img>`、Hook dependency warningと`next lint` deprecation noticeのみ。
- build: `npm run build` exit 0。`transit-config.json`不在でGTFS importがエラーを表示したが、既存scriptはexit 0で継続し、Prisma生成・Next production buildは完了した。
- 初回 full Jest: 139 suites中136 PASS、1 FAIL、2 skipped。862 tests中848 PASS、1 FAIL、13 skipped。失敗は`color-compliance.test.ts`の5件で、クラス値自体は旧sourceから存在していたが、今回Heroicons名からLucide名へ変更したことで、color auditの「末尾`Icon`を装飾要素として除外する」判定から外れて検出可能になった。PR #114 head `1e207b8`とその直前のdev tip `9be674d`では同じテストがPASSしているため、Issue #108が導入した監査境界の回帰である。
- T016〜T018後の full Jest: 139 suites中137 PASS、2 skipped。862 tests中849 PASS、13 skipped、FAIL 0。color auditにLucide runtime named importのprovenance認識を追加し、旧sourceの装飾アイコン色を通常テキストとして誤検出しない回帰を修正した。
- 凍結対象: `src/app/icon.svg`は変更なし。`src/app/apple-icon.png`はworktree作成時から存在するGit LFS pointer差分を保持し、Issue作業では変更していない。

実装commit `14bb9b77bfb8101e8987a0f802ec548374573f67` を作成し、`origin/chore/issue-108-lucide` へpushした。ローカルとremoteのSHAは一致し、PR #115（base=`dev`）を作成した。

PR #115のQuality Gate run `33182440600`（head `d398c5f43f8afde8e49fb1d78ee0d50e1cf7ca27`）は終了し、ESLintとstrict TypeScriptは成功したが、Jestがcolor auditの5件でexit 1となった。PR #114のQuality Gate run `33170956429`（head `1e207b803ebb0be6b0a96a9a02bdb4911d8d59ff`）はPASSしており、pre-#114 dev tip `9be674d`でもcolor testはPASSだった。したがって、初回CI failureは今回のLucide名への移行でcolor auditのアイコン識別境界が崩れたことが原因である。

T016で実際のLucide import fixtureを追加し、T017のfresh read-only test reviewで`VERDICT: PASS`を取得した。T018で`lucide-react`のruntime named importをTypeScript ASTから収集し、local binding名とJSX tagの完全一致だけを装飾アイコンとして扱うtest-only修正を実施した。現行local full JestはFAIL 0であり、次の追補commit/push後に新しいexact SHAのQuality Gateを確認する。
