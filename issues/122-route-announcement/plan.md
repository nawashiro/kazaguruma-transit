# Issue #122 ルートページのお知らせ実装計画

> **For Hermes:** `task-list-subagent-coordination` skillを使い、`tasks.md`を1タスク単位で実装する。テスト実装直後にはfresh read-only reviewerを置き、PASS前にproduction codeを変更しない。

**Goal:** ルートページの固定的な受賞カードを、`app-config.json`の`announcement.information`と`announcement.url`からビルド時に生成する、Infoアイコン付きの運営告知カードへ置き換える。

**Architecture:** 公開設定の唯一の読み取り・実行時検証境界である`src/lib/config/app-config.ts`に、2項目だけの`announcement`設定を追加する。新しい`Announcement` componentは静的に`appConfig.announcement`を読み、既存のDaisyUIカード構造の中で見出しとリンクを描画する。`Home`は受賞専用componentを同じ位置で`Announcement`へ置き換え、受賞詳細ページは独立した責務として維持する。

**Tech Stack:** TypeScript 5 strict、React 19、Next.js 15 App Router、DaisyUI 5、Tailwind CSS 4、`lucide-react`、Jest、React Testing Library、Node.js 22.23.2

---

## Issueと基準

- Issue: [#122 add: ルートページの受賞のお知らせを消して、お知らせにする](https://github.com/nawashiro/kazaguruma-transit/issues/122)
- 基準ブランチ: `dev`
- 基準SHA: `380ef8ad956b289d5033e286b19fdfd110ff68fd`
- 実装ブランチ: `fix/issue-122-route-announcement`
- 調査資料: `issues/122-route-announcement/investigation.md`
- 仕様: `issues/122-route-announcement/spec.md`
- 作業言語: 日本語
- 憲章: `.specify/memory/constitution.md` Version 4.0.0、実務上の正本は`AGENTS.md`

## Constitution Check（設計前）

| 原則・制約 | Issue #122への適用 | 判定 |
|---|---|---|
| Clear Naming | `AnnouncementAppConfig`、`Announcement`、`information`、`url`で設定と表示の責務を明示する。Issue本文の`infomation`は誤綴りとして採用しない | PASS |
| Simple Logic | 設定parserを既存境界へ追加し、静的設定を直接リンク表示する。配列・状態・管理画面・fallbackは作らない | PASS |
| Structured Organization | 設定は`src/lib/config`、UIは`src/components/features`、ルート接続は`src/app/page.tsx`に限定する | PASS |
| Type Safety | `AnnouncementAppConfig`を定義し、`unknown`から非空stringを実行時検証する。`any`を追加しない | PASS |
| Test-First Development | config契約とHomeの新表示を先にRED化し、fresh reviewerのPASS後にproductionへ進む | PASS |
| Accessibility & UX | `h2`とsectionを`aria-labelledby`で関連付け、Lucide `Info`を装飾用`aria-hidden`にする。既存カード幅・ルビ・レスポンシブ性を維持する | PASS |
| Documentation & Comments | 調査・仕様・計画・タスク・実装後検証をこのディレクトリへ日本語で記録する | PASS |
| 範囲・永続化 | 新規DB、API、sessionStorage、Nostr、GTFS、認証、外部送信を追加しない | PASS |
| KISS／旧実装削除 | ルートから受賞専用componentと専用テストを削除し、受賞ページだけを残す。誤綴りfallbackや二重経路を作らない | PASS |

**Gate Result (Pre-Design): PASS**

## 要求と受入条件

| ID | 受入条件 | 主な証拠 |
|---|---|---|
| AC-01 | exampleに`announcement.information`と`announcement.url`が定義される | JSON確認、`app-config.test.ts` |
| AC-02 | parserが有効なannouncementを返し、欠落・空文字列を日本語エラーで拒否する | `app-config.test.ts`、strict TypeScript |
| AC-03 | ルートページの同じ位置に既存カード相当の告知カードを表示する | `page.test.tsx`、production diff |
| AC-04 | カードにLucide Info付き`h2`「運営からのお知らせ」があり、sectionと見出しが関連付く | `page.test.tsx`、source確認 |
| AC-05 | `information`が唯一のお知らせ本文として`a`要素の表示テキストになり、`url`が`href`になる | `page.test.tsx` |
| AC-06 | 旧受賞バッジ、受賞名の固定表示、`受賞について詳しく見る`リンクがルートページから消える | `page.test.tsx`、source検索 |
| AC-07 | `/award`ページ、`award-data`、受賞ページの既存テストは維持される | `src/app/award/__tests__/page.test.tsx`、diff境界 |
| AC-08 | お知らせ表示が静的設定読み取りだけで成立し、新規永続化・fetch・Nostr・DB変更がない | component実装、diff境界 |
| AC-09 | focused Jest、全Jest、strict TypeScript、lint、build、`git diff --check`が成功する | 親検証記録 |

## 実装設計

### 1. `app-config`への設定追加

`AnnouncementAppConfig`を次の形で追加する。

```ts
export interface AnnouncementAppConfig {
  information: string;
  url: string;
}
```

`parseAppConfig`は`announcement`がrecordであり、`information`と`url`が非空文字列であることを検証する。既存のエラーメッセージ`app-config.jsonの形式が不正です`を再利用し、parserの責務を増やさない。

`app-config.json.example`には次を追加する。

```json
"announcement": {
  "information": "都知事杯オープンデータ・ハッカソン2025で行政課題解決賞を受賞しました",
  "url": "/award"
}
```

既存のignoredな`app-config.json`は、配布先固有の値を保持したまま`announcement`だけを追加してテスト可能な状態へ移行する。これはローカル生成物であり、commit対象ではない。

### 2. お知らせカード

`src/components/features/Announcement.tsx`を新規作成する。`KoFiSupport`と同じカードの基本クラスを使い、次の構造にする。

- `section.card.card-border.w-full.bg-base-100.shadow-sm`
- `aria-labelledby="announcement-heading"`
- `div.card-body.gap-4.p-4.sm:p-6`
- `h2#announcement-heading.card-title.inline.gap-0`
- `Info` iconは`lucide-react`からimportし、`aria-hidden="true"`を付ける
- 見出し文字列とリンクだけを`ruby-text`境界へ置く
- `appConfig.announcement.information`を`a.link`の表示テキストにし、`appConfig.announcement.url`を`href`にする

見出し全体を外部Rubyfulの書き換え対象にせず、Info SVGを保持するため、見出しテキストは必要な子要素へ`ruby-text`を付ける。URLを相対URL・外部URLのどちらにも使えるよう、targetやURL形式の追加制約は設けない。

### 3. ルートページの置換

`src/app/page.tsx`の`AwardRecognition` importとrenderを削除し、同じカード位置へ`Announcement`を置く。検索フォーム、`aria-live`、URL遷移、注意書き、リセット処理は変更しない。

`AwardRecognition.tsx`と`AwardRecognition.test.tsx`はルートページから不要になるため削除する。`src/app/award/page.tsx`と`src/app/award/__tests__/page.test.tsx`は変更しない。

## 変更manifest

### 変更許可

- `app-config.json.example`
- `src/lib/config/app-config.ts`
- `src/lib/config/__tests__/app-config.test.ts`
- `src/app/page.tsx`
- `src/app/__tests__/page.test.tsx`
- `src/components/features/Announcement.tsx`
- `src/components/features/AwardRecognition.tsx`（削除）
- `src/components/features/__tests__/AwardRecognition.test.tsx`（削除）
- `issues/122-route-announcement/investigation.md`
- `issues/122-route-announcement/spec.md`
- `issues/122-route-announcement/plan.md`
- `issues/122-route-announcement/tasks.md`

### 変更禁止

- `app-config.json`の既存配布先固有値（ローカルignored fileのannouncement追加以外）
- `src/app/award/page.tsx`、`src/app/award/__tests__/page.test.tsx`、`src/lib/award/award-data.ts`
- `src/components/ui/Card.tsx`、`KoFiSupport.tsx`、共通CSS、Rubyful外部script
- `package.json`、lockfile、Docker、環境変数、Prisma/SQLite、GTFS、Nostr、認証
- サイドバーの受賞リンク、license、その他のIssue文書・既存worktree・stash

## TDD・委任ゲート

1. config test writerが`app-config.test.ts`だけを変更し、テンプレートとparserのannouncement契約を先にRED化する。
2. 親がfocused config Jestで、production未変更に起因する意味のあるREDを確認する。
3. 別fresh read-only reviewerがconfig testの過不足、非vacuous性、旧実装での失敗を確認し、`VERDICT: PASS`になるまで進めない。
4. config production writerが`app-config.ts`とexampleだけを変更する。親はignored configへannouncementを追加してfocused GREENを確認する。
5. UI test writerが既存`page.test.tsx`だけを変更し、新カード、見出し、アイコン、リンク、旧受賞カード撤去をHome経由でRED化する。
6. 別fresh read-only reviewerがUI testのDOM・ARIA・リンク契約と既存検索テスト維持を確認し、PASS後に進める。
7. UI production writerが`Announcement.tsx`を作成し、`page.tsx`を置換し、不要になった受賞componentと専用テストを削除する。親がfocused GREENを確認する。
8. 親が旧production差分だけを隔離的に復元して新規UI回帰テストが失敗することを確認し、必ず修正状態へ戻してから全検証する。

## 最終検証コマンド

```bash
PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npm test -- --runInBand --runTestsByPath \
  src/lib/config/__tests__/app-config.test.ts \
  src/app/__tests__/page.test.tsx \
  src/app/award/__tests__/page.test.tsx
PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npx tsc --noEmit --incremental false
PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npm run lint
PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npm test -- --runInBand
PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npm run build
git diff --check
git status --short --branch
```

`npm run build`は最終検証で一度だけ実行する。`transit-config.json`不足など既存環境のGTFS表示と、今回の差分による終了コード・build failureを分離して記録する。

## リスクと対策

- **ignored configの旧形式:** parserを強制的に後方互換化せず、親がローカル`app-config.json`の既存値を保持してannouncementだけを追加する。clean checkoutではnpm準備処理が新exampleから生成する。
- **`information`表記の揺れ:** `infomation` aliasを作らず、example、型、parser、テスト、componentを`information`へ統一する。
- **RubyfulとInfo SVGの衝突:** h2全体ではなく見出しテキスト子要素だけを`ruby-text`にし、アイコンを`aria-hidden`付きの非対象要素として保持する。
- **受賞ページの過剰削除:** `award` routeと`award-data`を変更禁止にし、ルート専用componentとテストだけを削除する。
- **見かけ上のテスト成功:** 旧UI状態で新規Homeテストが失敗するRED、修正後GREEN、旧productionへ戻した感度確認の3点を記録する。

## Constitution Check（設計後）

- [x] `AppConfig`の既存検証境界にannouncementを追加し、設定とUIの責務を分離した。
- [x] 受賞詳細ページを残し、ルート専用の旧componentだけを削除する最小変更にした。
- [x] `information`と`url`の2項目に限定し、誤綴りfallback、複数件、管理状態を追加しない。
- [x] Info SVGはLucideで提供し、sectionとh2のARIA関係を計画した。
- [x] config/UIそれぞれでtest writer→fresh review→production writerの順を定義した。
- [x] `issues/122-route-announcement`へ日本語の調査・仕様・計画・タスク・検証結果を集約する。

**Gate Result (Post-Design): PASS**

## 実装後の検証結果

### TDD・親検証

- T005の設定テストは1 suite / 9 tests中5 failed・4 passedの意味あるRED。T006 fresh reviewは`VERDICT: PASS`、`modified: false`、開始／終了SHA一致。
- T007の設定型・parser・tracked example実装後、親が既存値を保持したままignored `app-config.json`へannouncementを追加し、config focused Jestは1 suite / 9 tests passed。
- T008のHomeテストは1 suite / 11 tests中6 failed・5 passed。T009は任意SVG、旧固定文言、カード構造・位置、section内linkの不足を指摘してFAILした。
- T008Rは中立config mock、`svg.lucide-info`、旧受賞名・賞名、カードクラス・位置、section内linkを追加し、1 suite / 13 tests中8 failed・5 passedのmeaningful RED。T009Rは`VERDICT: PASS`、`modified: false`、開始／終了SHA一致。
- T010のfocused GREENはHome、config、award pageの3 suites / 25 tests passed。`Announcement`は既存KoFiSupport相当のカード、Info icon、named section、linkを実装し、Homeだけを置換した。`AwardRecognition`と専用テストは削除し、`/award`と`award-data`は維持した。
- T010でproduction `card-title`が1件増えたため、全Jest初回では既存の21件固定契約が失敗した。T010Cはテスト名と2つの件数期待値だけを22へ更新し、T010CRは`VERDICT: PASS`、`modified: false`、開始／終了SHA一致。
- 旧AwardRecognition状態へ一時復元した感度確認でHome回帰テストは13 tests中8 failed・5 passed。修正状態へ復元し、ハッシュ一致と`git diff --check`を再確認した。

### 品質ゲート

- focused: Home、app-config、award page 3 suites / 25 tests passed。
- full Jestの初回実行ではcard-title契約1件と、`src/app/discussions/__tests__/page.streaming.test.tsx`の10 testsが一時失敗した。Discussion suite単独は11/11 passedし、全Jest再実行は2 skipped / 145 passed suites、13 skipped / 915 passed testsでGREENとなった。再現性のある今回差分由来のDiscussion失敗とは判定していない。
- strict TypeScript: `PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npx tsc --noEmit --incremental false` exit 0。
- lint: `PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npm run lint` exit 0。既存warningと`next lint` deprecated表示のみ。
- build: `PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH NODE_OPTIONS=--max-old-space-size=1536 NEXT_TELEMETRY_DISABLED=1 npm run build` exit 0。Prisma生成、schema sync、GTFS import chain、Next.js production build、27ページ生成が成功した。`transit-config.json`不在表示は既存環境要因として分離した。
- 静的監査: production sourceの`AwardRecognition`参照と`infomation`は0件。announcement内のkeyは`information`／`url`だけで、fetch・Nostr・Prisma・sessionStorageはない。受賞route/dataは差分なし。
- `git diff --check`: exit 0。配送前のworktreeには計画済みのsource、test、設定例、Issue文書だけが残っている。ignored `app-config.json`は既存の配布値を保持し、announcementだけを追加した。

## 完了条件の判定

AC-01〜AC-09は実装とfocused/full/静的検証で確認済みである。実装commit `b7233e2599fd856e0c048485806c0fa2effecda2`をfeature branchへpushし、PR [#135](https://github.com/nawashiro/kazaguruma-transit/pull/135)をbase=`dev`で作成した。作成時head SHAに対するQuality Gate run `33861246469` / job `100985951169`は`success`である。PRはOPENのまま維持し、mergeは行わない。

## 配送後確認

- PR本文をGitHubから読み戻し、title、body、base、head、head SHA、変更13ファイルが意図どおりであることを確認した。
- `gh pr checks 135 --repo nawashiro/kazaguruma-transit`でQuality Gateの成功を確認した。Node.js 20 action deprecated annotationは既存workflowの警告として残る。
- 記録追補commit `e3598fdb7bc619b97b61ecb683b4b4a927e13dac`をpushし、追補後のheadに対するQuality Gate run `33862080856` / job `100988583033`も`success`であることを確認した。
