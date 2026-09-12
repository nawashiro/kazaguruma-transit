# Issue #131 調査記録

- Issue: [#131 fix: 投票操作時にDOMエラー発生](https://github.com/nawashiro/kazaguruma-transit/issues/131)
- Repository: `/opt/data/kazaguruma-transit`
- 調査基準ブランチ: `dev`
- 調査基準SHA: `b2d28b0347309725c6eac29b06a3d06c7ac420a1`
- 実装ブランチ: `fix/issue-131-vote-dom-error`
- 調査日: 2026-09-03 UTC

## 1. 開始状態とIssueの状態

作業開始時のcheckoutは `chore/issue-121-award-page-kiss` で、次の未コミット変更がありました。

- `M src/app/award/__tests__/page.test.tsx`
- `?? issues/121-award-page-kiss/`

既存作業を上書きしないため、`git stash push --include-untracked -m "wip: Issue #121 before Issue #131"` で退避した。その後、`dev`へ切り替え、次を実行した。

```bash
git fetch origin dev
git pull --ff-only origin dev
```

`dev`は `origin/dev` と一致し、作業ツリーは clean になった。Issue対応用ブランチはこのSHAから作成した。

GitHubの現在状態は次のとおりである。

- State: `OPEN`
- Title: `fix: 投票操作時にDOMエラー発生`
- Comments: 0
- Labels: なし
- Assignees: なし
- 報告されたエラー: `Failed to execute 'removeChild' on 'Node'. The node to be removed is not a child of this node.`
- 発生箇所: `/discussions/[naddr]` の「はい / いいえ」投票操作後、Reactのcommit deletion処理
- Next.js: `15.5.20`

## 2. 重複作業の確認

次のPR検索を実行したが、いずれも該当するopen PRはなかった。

```bash
gh pr list --search "#131" --state all --limit 100
gh pr list --search "vote DOM error" --state open --limit 100
gh pr list --search "removeChild discussions" --state open --limit 100
```

Issue #131を参照する既存PR、同じ症状を扱うopen PR、Issue #131対応の既存コミットは確認できなかった。

## 3. 現行のデータ・制御フロー

1. `src/app/discussions/[naddr]/page.tsx` が `postsWithStats` と `userEvaluations` を作り、`EvaluationComponent`へ渡す。
2. `src/components/discussion/EvaluationComponent.tsx` は `filterUnevaluatedPosts()`で先頭の評価対象投稿を `currentPost` として表示する。
3. 「はい」または「いいえ」を押すと、同コンポーネントの `handleEvaluate()` がまず `evaluatingPost` を更新し、親の `onEvaluate(postId, rating)`を呼ぶ。
4. 親ページの `handleEvaluate()` は NIP-25評価イベントを生成・署名・relayへpublishする。
5. publish成功後、親ページは `optimisticUserEvaluationIds` と `optimisticEvaluations` を更新する。
6. `userEvaluations`の更新で `filterUnevaluatedPosts()`の結果が変わり、現在の投稿が次の投稿へ切り替わる。
7. 評価ボタン自身も、`evaluatingPost`の更新時に子要素をアイコン＋文字列から空文字列へ切り替える。

## 4. 外部DOM変更の確認

`src/components/layouts/SidebarLayout.tsx` はRubyful v2を次の設定で初期化している。

```ts
window.RubyfulV2?.init({
  selector: ".ruby-text",
  defaultDisplay: savedPreference,
  observeChanges: true,
  ...
});
```

実際に参照した固定URLのRubyful v2スクリプトは、対象要素の内容を非同期処理後に次のように置換する。

```js
const text = element.textContent || "";
const processed = await apiClient.processText(text);
element.innerHTML = sanitize(processed);
```

また、`MutationObserver`が `characterData` と `childList` の変更を監視し、`.ruby-text`を再処理する。したがって `.ruby-text`を付けた要素は、Reactが管理する子ノードを外部スクリプトが置き換えるDOM境界になる。

現行の `EvaluationComponent` では、投票操作で更新・置換される要素へ `.ruby-text` が付いている。

- 評価対象本文の各 `<p>`: `currentPost`の切り替えで本文テキストが変わる
- 評価ボタン全体: `evaluatingPost`の切り替えで子要素が変わる
- 評価ボタンにはLucideのSVGとテキストが同居しており、Rubyfulがボタン全体へ `innerHTML` を設定するとSVGも失われる

Rubyfulが評価ボタン全体を置換した後、Reactがloading遷移で元のSVG／テキスト構造を削除しようとすると、Reactの仮想DOMと実DOMが不一致になり、報告された `removeChild` が発生する。publish処理やNostr解析より前の同期的なDOM commitで説明できるため、Issue本文のスタックトレースとも整合する。

## 5. 履歴との照合

関連する履歴を確認した。

- `4f6d8f2 fix: ルビフルによるDOM削除エラーを修正`
  - 動的な管理画面の大きなコンテナから `.ruby-text` を外し、個別の表示テキストへ境界を移している。
- `f30db5d fix: RubyWrapperをDOM変更ベースに`
  - RubyfulがReactツリーのラッパーを直接変更しない構成へ移行している。
- `a6b34f7 fix: isolate moderator loading ruby DOM`
  - loading statusの親ではなく、削除対象にならないテキスト要素だけへ `.ruby-text` を付ける契約を追加している。
- `cbeb9ae fix: Issue #106の不要なspanとDaisyUI gapを整理`
  - `EvaluationComponent`のボタン内テキストspanを削除し、ボタン全体へ `ruby-text` を付けた。この変更は、今回の外部DOM置換境界をボタンのSVGまで拡張している。
- `910426a fix: Issue #128の細かい修正を反映`
  - 評価対象本文に `.ruby-text` が残った状態で、評価カードとボタンを分離した。

以上から、Issue #131はIssue #128の文言・レイアウト変更そのものではなく、RubyfulのDOM所有権境界を評価操作の動的ツリーへ持ち込んだ回帰として扱う。

## 6. 仮説の順位

| 順位 | 仮説 | 根拠 | 判定 |
|---|---|---|---|
| 1 | Rubyfulが投票ボタンと評価対象本文のReact管理子ノードを `innerHTML` 置換し、投票時のReact commitが実DOMと衝突する | Rubyfulの実装、現行class配置、Reactの更新タイミング、報告スタックが一致 | 最有力 |
| 2 | `observeChanges`による非同期再処理が、評価状態更新との競合を増幅する | MutationObserverとAPI処理が非同期で動作する | 1の増幅要因 |
| 3 | Nostr publish、評価データの重複、または分析処理が直接DOM例外を出している | スタックがReact DOMのcommit deletionであり、外部通信層の例外ではない | 低い |

## 7. 実装境界の提案

Issueに必要な最小変更は次のとおりとする。

- `src/components/discussion/EvaluationComponent.tsx`
  - Reactの再描画で内容が変わる評価本文の段落から `.ruby-text` を外す。
  - 評価ボタン全体から `.ruby-text` を外す。
  - ボタンのLucide SVGと評価ラベルは常に同じReact要素を保持し、loading時はclassで視覚的に隠す。固定ラベルだけを常時マウントした子 `span.ruby-text` に置き、Rubyfulが変更してもReactの子削除と競合しない境界にする。
  - 評価対象の切り替え、callback、NIP-25、progress、ARIA、44px以上の操作領域は変更しない。
- `src/components/discussion/__tests__/EvaluationComponent.test.tsx`
  - Rubyfulの `innerHTML` 置換を模した外部DOM変更後に投票してもReactのDOM例外が発生しないことを固定する。
  - 同時に、動的本文とボタン自身がRubyful対象でなく、固定ラベルだけが対象となるDOM境界を確認する。

新規永続化、Nostr／Prisma／GTFS変更、Rubyfulスクリプト変更、共通Button抽象化、全画面のRuby境界移行は行わない。

## 8. 既存検証

基準SHAの既存テストを実行した。

```bash
PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npm test -- --runInBand --runTestsByPath src/components/discussion/__tests__/EvaluationComponent.test.tsx
```

結果: `1 suite passed / 8 tests passed`。このテストはRubyful v2の実スクリプトや外部DOM置換をロードしていないため、Issueの回帰を否定する証拠ではない。今回のTDD REDで外部置換後の再描画を追加して検証する。

基準checkoutで `git diff --check` は終了コード0、作業ツリーは clean だった。

## 9. 調査結論

Issue #131の根因は、Rubyful v2が `innerHTML` を所有する `.ruby-text` 境界と、投票操作でReactが子ノードを差し替える境界が重なっていることである。評価操作の動的DOMをRubyfulの対象から分離し、固定ラベルのみを安定した子要素として対象にするのが、既存機能とRuby表示を維持しながらの最小修正である。

## 10. 実装後の検証

TDDの回帰テストは、旧production差分を一時的に復元する感度確認を含めて検証した。

- T005/T006R: `EvaluationComponent.test.tsx`へRubyful相当の`textContent`→`innerHTML`置換シナリオを追加し、未使用引数を除去、loading class assertionを追加した。旧productionでは9 tests中8 pass、追加テストのみ`NotFoundError` 4件でREDになった。
- T006RR: fresh read-only reviewerが`SUBAGENT_STATUS: COMPLETE`、`VERDICT: PASS`、`modified: false`、開始／終了SHA一致を返し、テストの再現性・非vacuous性・既存契約をPASS判定した。
- T007: `EvaluationComponent.tsx`だけを変更し、動的本文の`p`とbutton自身から`.ruby-text`を外し、Lucide SVGと固定label spanを常時保持して評価中は`sr-only`で隠す構造へ変更した。
- T008: 修正後focused Jestは9/9 pass。production diffだけを一時的に旧状態へ戻した隔離確認では追加テストが再び`NotFoundError` 4件で失敗し、修正を復元した後のfocused Jestは9/9 passだった。
- 全Jest: 144 suites passed、2 skipped、901 tests passed、13 skipped。
- strict TypeScript: `npx tsc --noEmit --incremental false` exit 0。
- lint: `npm run lint` exit 0。既存の`any`、`<img>`、hook依存配列、`next lint`非推奨に関するwarningだけで、今回の差分由来のwarning/errorはない。
- build: `npm run build` exit 0。Prisma generate／schema sync／Next buildは完了した。`transit-config.json`が環境にないためGTFS importが設定不足を表示したが、既存のbuild chainが後続処理を継続し、Next buildは完了した。
- `git diff --check`: exit 0。変更pathはproduction 1件、test 1件、Issue文書3件の許可manifest内にある。

実relayを使う投票、外部Rubyful APIを使う実ブラウザ操作、実ユーザーのpublishは行っていない。RubyfulのDOM所有権とReact更新は、実DOMを使うRTL/JSDOM回帰テストで送信なしに検証した。実ブラウザでのrelay依存確認は、`transit-config.json`不足と実データ送信回避のため未実測として扱う。
