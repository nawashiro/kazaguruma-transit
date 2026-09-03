# Issue #131 投票時DOMエラー修正 実装計画

> **For Hermes:** `subagent-driven-development` skillを使い、tasks.mdをタスク単位で実装する。

**Goal:** `/discussions/[naddr]` で「はい / いいえ」を押したときに、Rubyful v2のDOM置換とReactの再描画が衝突して `removeChild` 例外になる問題を解消する。

**Architecture:** Rubyful v2が `innerHTML` を所有する `.ruby-text` 境界を、評価操作で更新されるDOMから分離する。評価ボタンはLucideアイコンと固定ラベルのReact要素を常に保持し、固定ラベルだけを安定した子要素としてRubyfulへ渡す。評価対象本文はReactが更新する通常のテキストとして描画する。Nostrの生成・署名・publish・楽観更新の責務は変更しない。

**Tech Stack:** TypeScript 5 strict、React 19、Next.js 15 App Router、DaisyUI 5、Tailwind CSS 4、Rubyful v2、Jest、React Testing Library

---

## Issueと基準

- Issue: [#131 fix: 投票操作時にDOMエラー発生](https://github.com/nawashiro/kazaguruma-transit/issues/131)
- 基準ブランチ: `dev`
- 基準SHA: `b2d28b0347309725c6eac29b06a3d06c7ac420a1`
- 実装ブランチ: `fix/issue-131-vote-dom-error`
- 調査資料: `issues/131-vote-dom-error/investigation.md`
- 実装時の作業言語: 日本語

## 目的と非対象

### 目的

1. Rubyfulが評価ボタンのSVG・テキストを置換した後でも、投票開始時のReact更新がDOM例外を起こさない。
2. publish成功後に評価対象が次の投稿へ切り替わる際、評価本文の差し替えがDOM例外を起こさない。
3. 「はい」「いいえ」のcallback引数、disabled/loading表示、評価順序、進捗表示、NIP-25イベント経路を維持する。
4. Rubyful v2の対象範囲を、動的DOMを壊さない安定したテキスト境界へ限定する。

### 非対象

- Rubyful v2外部スクリプト、API、設定値、`SidebarLayout`の初期化変更
- Nostr relay、署名、評価イベント、評価分析、Prisma、SQLite、GTFS
- 共通Buttonの抽象化、全画面のRuby境界の一括移行
- 新規永続化、URL・sessionStorage・認証処理
- Issue #131に直接関係しないスタイル・文言・レイアウト整理

## 憲章ゲート

根拠は `AGENTS.md` と `.specify/memory/constitution.md` Version 4.0.0である。憲章では `AGENTS.md` を実務上の正本とし、計画・実装・レビューで次を確認する。

| 原則・制約 | Issue #131での適用 | 判定 |
|---|---|---|
| Clear Naming | `isEvaluating`など動作を表す名前を使い、評価・Rubyful・DOMの用語を混同しない | PASS |
| Simple Logic | 既存callbackと評価順序を維持し、Rubyful対象の境界とloading時のclass切替だけを小さく修正する | PASS |
| Structured Organization | `EvaluationComponent`とその隣接テストだけを変更し、UIからNostr／DBへ直接アクセスしない | PASS |
| Type Safety | 既存のTypeScript strictを維持し、`any`を追加しない。DOM検証は標準DOM型で記述する | PASS |
| Test-First Development | 外部DOMの `innerHTML` 置換を模した回帰テストを先に追加し、意味のあるREDを確認してからproductionを変更する | PASS |
| Accessibility & UX | `aria-label`、`aria-live`、disabled、loading、44px以上の操作領域、ボタンの可読なaccessible nameを維持する。WCAG 2.2 1.3.1、2.4.6、2.5.8、4.1.2に関係する | PASS |
| Documentation & Comments | 調査根因、DOM所有権境界、RED/GREEN、検証結果を本ディレクトリへ日本語で記録する。コメントは必要な理由だけに限定する | PASS |
| Rubyful DOM境界 | `innerHTML`を外部が置換する要素をReactが投票更新で削除・本文更新する要素にしない | PASS |
| 範囲・永続化 | `EvaluationComponent`とテストのみ。Nostr、SQLite、GTFS、rate limit、認証、永続化は変更しない | PASS |

## 受入条件と検証対応

| ID | 受入条件 | 主な検証 |
|---|---|---|
| AC-01 | Rubyful相当の `innerHTML` 置換後に「はい」を押しても `removeChild` 例外が発生しない | `EvaluationComponent.test.tsx` の外部DOM置換回帰テスト |
| AC-02 | 評価本文の動的 `<p>` と評価ボタン自身が `.ruby-text` になっていない | 同テストのDOM境界assertion、production source確認 |
| AC-03 | 評価ラベルは安定した子 `span.ruby-text` として常時マウントされ、loading時もReactがその子を削除しない | DOM境界assertion、loading遷移assertion |
| AC-04 | 評価対象が次の投稿へ移り、本文が正しく表示される | 2投稿のwrapper再描画テスト |
| AC-05 | 「はい」は`(postId, "+")`、「いいえ」は`(postId, "-")`をcallbackへ渡す | 既存callbackテスト、focused Jest |
| AC-06 | 既存の評価可能投稿判定、unknown保留、progress ARIA、アクセシブルなボタン名を維持する | 既存 `EvaluationComponent` suite、focused Jest |
| AC-07 | Nostr／認証／DB／Rubyful初期化の変更がなく、変更pathがmanifest内に限定される | `git diff`、path確認、typecheck |
| AC-08 | リポジトリのlint、全Jest、strict TypeScript、buildが成功する | `npm run lint`、`npm test -- --runInBand`、`npx tsc --noEmit --incremental false`、`npm run build` |

## 実装設計

### 1. 評価本文の境界

`currentPost.content`から生成する各段落は、評価対象が切り替わるたびにReactが更新する。したがって段落から `.ruby-text` を外し、`p`のkey、改行分割、空行のNBSP、既存の表示classは必要最小限で維持する。

### 2. 評価ボタンの境界

評価ボタン全体から `.ruby-text` を外す。ボタン全体にはLucide SVGとラベルが含まれるため、ここをRubyfulの `innerHTML` 置換対象にしない。

各ボタンは次の要素を常時保持する。

- Lucideアイコン。評価中は既存のloading表示を壊さないclass切替で視覚的に隠す。
- 固定文字列を含む子 `span.ruby-text`。評価中もspan自体とその内容を削除せず、classだけを切り替える。
- ボタンの `type="button"`、disabled、既存のARIA名、44px以上の領域。

`loading` classによるDaisyUIの表示は既存挙動を維持し、アイコン・ラベルのReact要素を条件レンダーで削除しない。

### 3. 回帰テスト

`EvaluationComponent.test.tsx`へ、次の実DOMシナリオを追加する。

1. 2件の承認済み投稿をwrapperでrenderし、callback成功時に評価済みIDをstateへ追加する。
2. 初回render後、Rubyful v2の実挙動を模した関数で `.ruby-text` 要素の `innerHTML` を `<ruby>...</ruby>`へ置換する。ボタン全体が対象ならアイコンも失われるため、旧実装の衝突を再現できる。
3. 「はい」をclickし、`removeChild`例外が発生しないことを確認する。
4. 次の投稿本文が表示され、評価ボタン自身に `.ruby-text` がなく、ボタン直下のラベルspanだけが安定境界であることを確認する。
5. 既存のcallback・unknown・タイトル・progressテストは保持する。

テストはproduction未変更の基準checkoutで、collection/setupではないDOM境界またはReact commitの失敗としてREDになることを確認する。

## 変更manifest

### 変更許可

- `src/components/discussion/EvaluationComponent.tsx`
- `src/components/discussion/__tests__/EvaluationComponent.test.tsx`
- `issues/131-vote-dom-error/investigation.md`
- `issues/131-vote-dom-error/plan.md`
- `issues/131-vote-dom-error/tasks.md`

### 変更禁止

- `src/app/discussions/[naddr]/page.tsx`
- `src/components/layouts/SidebarLayout.tsx`
- `src/components/ui/RubyWrapper.tsx`
- `src/app/globals.css`
- `package.json`、lockfile、Prisma、Nostr、設定、外部Rubyful script
- 他のfeature、Issue文書、既存stash

## 検証計画

### TDDゲート

1. test writerがtest pathだけを変更する。
2. 親がNode／Jestでfocused suiteを実行し、期待した意味のあるREDを記録する。
3. 別fresh read-only reviewerへtest pathを渡し、仕様適合性、旧実装での失敗、vacuous assertion、外部DOM置換の再現性、既存assertion維持をレビューさせる。
4. reviewerがPASSするまでproduction writerを開始しない。
5. production writerは `EvaluationComponent.tsx` だけを変更し、親がcurrent worktreeでfocused GREENを再実行する。

### 最終ゲート

```bash
npm test -- --runInBand --runTestsByPath src/components/discussion/__tests__/EvaluationComponent.test.tsx
npx tsc --noEmit --incremental false
npm run lint
npm test -- --runInBand
npm run build
git diff --check
git status --short --branch
```

`npm run build` は最終検証で一度だけ実行する。GTFS取得、Prisma、環境変数、外部ネットワークに起因する失敗が出た場合は、今回の差分由来の失敗と分離して記録する。

### Regression testの感度確認

focused GREEN後、テスト対象の境界修正を一時的に旧状態へ戻した隔離確認を行い、回帰テストが失敗することを確認する。確認後は必ず修正済み状態へ戻し、差分とfocused GREENを再確認する。共有作業ツリーのproduction／test bytesは親が管理する。

## リスクと対策

- **Rubyfulの処理タイミング差:** 実ライブラリの `innerHTML` 置換をテストで再現し、ボタン全体・動的本文を対象外にする。実ブラウザ確認ではRuby ON/OFFと投票を確認する。
- **loading表示の退行:** アイコンとラベルのhost要素を常時保持し、loading時は既存classと視覚状態だけを確認する。
- **Ruby表示の範囲縮小:** 固定ラベルのspan境界は維持し、評価本文はReact外部DOM置換との衝突回避を優先する。動的本文へのRuby適用拡張は別Issueとする。
- **Nostr経路への混入:** production writerのmanifestを `EvaluationComponent.tsx`だけに固定し、親がdiffで確認する。
- **テストの見かけ上の成功:** 旧実装でのRED、Rubyful相当mutation後のclick、次投稿への切り替えを一つのシナリオで検証する。

## 実装後の検証結果

- TDD RED: 旧productionではRubyful相当の`innerHTML`置換後の投票で`NotFoundError` 4件が発生し、9 tests中8 pass・追加1件のみfailした。
- Fresh review: T006RRが`VERDICT: PASS`、`modified: false`、開始／終了SHA一致。テストの実DOM再現性、loading／disabled、固定label境界、2投稿切り替え、callback、既存テスト維持に指摘なし。
- TDD GREEN: 修正後focused Jest `1 suite / 9 tests passed`。
- 感度確認: production差分のみ旧状態へ戻すと同じ回帰テストが`NotFoundError` 4件でfailし、修正復元後のfocused GREENを再確認した。
- Full Jest: `144 passed / 2 skipped` suites、`901 passed / 13 skipped` tests。
- Strict TypeScript: `npx tsc --noEmit --incremental false` exit 0。
- Lint: `npm run lint` exit 0。今回の差分由来のwarning/errorなし。既存warningと`next lint`非推奨表示は残る。
- Build: `npm run build` exit 0。PrismaとNext buildは成功。環境に`transit-config.json`がなくGTFS importが設定不足を表示したが、既存chainは継続してbuildを完了した。
- `git diff --check`: exit 0。実ブラウザ／relay publishは送信回避方針と設定不足により未実測とし、RTL/JSDOMの実DOM回帰で補完した。

## 完了条件

AC-01〜AC-08を満たし、TDDのRED・fresh review PASS・GREEN、focused/full Jest、strict TypeScript、lint、build、diff/statusを実測記録する。feature branchへ日本語prefixのcommitを作成してpushし、base=`dev`のPRを作成した場合はGitHubからhead/base/files/CI状態を読み戻す。mergeは行わない。
