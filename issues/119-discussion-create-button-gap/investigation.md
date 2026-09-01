# Issue #119 調査記録

- Issue: [#119](https://github.com/nawashiro/kazaguruma-transit/issues/119)
- タイトル: `fix: 会話作成完了ページのボタンがgap-0付与を忘れている`
- 調査日: 2026-09-01
- 対象リポジトリ: `nawashiro/kazaguruma-transit`
- 対象ベース: `dev` / `origin/dev`
- ベースSHA: `b1e722ee339d0eb77942dc23a5fa07c74a08e58c`
- 作業ツリー: `/opt/data/work/kazaguruma-transit-issue-119`
- 作業ブランチ: `fix/issue-119-discussion-create-button`

## 1. 作業開始時の状態

本体ツリー `/opt/data/kazaguruma-transit` は `fix/issue-87-app-config` 上で未コミット変更があった。ユーザーの明示指示により、tracked/untracked の未コミット変更を `git reset --hard HEAD` と `git clean -fd` で破棄した。破棄前後の一覧は親エージェントの実行ログに残し、Issue #119 用 worktree は別に作成して保全した。

`git fetch origin --prune` 後の `git rev-list --left-right --count dev...origin/dev` は `0 0` であり、ローカル `dev` と `origin/dev` は同一SHAだった。Issue worktree作成時にGit LFS対象の次の2ファイルについて、pointerではないという警告が出たが、作業ツリーに差分は発生していない。

- `public/images/map_placeholder.png`
- `src/app/apple-icon.png`

## 2. Issueの内容と重複作業

Issue本文は次のとおり。

> https://kazaguruma-transit.nawashiro.dev/discussions/create 作成完了後画面
>
> btnにgap-0をつけるのを忘れている。あと、このボタン抽象化は過剰な気もする。トラブルが多い。

確認結果:

- 状態: `OPEN`
- コメント: 0件
- 担当者: なし
- ラベル: なし
- 作成日時: `2026-09-01T08:13:15Z`
- 更新日時: `2026-09-01T09:23:03Z`
- `gh pr list --search "#119" --state all`: 対応PRなし
- `119 transit`、`route issue 119` の open PR検索: 対応PRなし

## 3. 現行ソースのデータ・表示経路

### 作成完了状態

`src/app/discussions/create/page.tsx:159-186` が `successMessage && createdNaddr` のときの完了画面を返す。CTAは次の2つである。

- `会話を開始する`: `handleGoToDiscussion` を呼び、`/discussions/${createdNaddr}` へ `router.push` する
- `会話一覧に戻る`: `/discussions` へ `router.push` する

両方とも `src/components/ui/Button.tsx` を使用している。

### Buttonのクラス契約

`src/components/ui/Button.tsx:42-44` の `baseClasses` は、primary/secondaryのいずれでも次を含む。

```text
ruby-text gap-0
```

同ファイルは #106 の `cbeb9ae` で次の変更を受け、`dev` にマージ済みである。

- `Button` 自身を `ruby-text gap-0` のレイアウト境界にする
- 子の自動生成 `span` を撤去する

したがって、現行 `dev` の作成完了CTAは実行時に `btn ... ruby-text gap-0` を持つ。`page.tsx` の完了画面だけが `gap-0` を欠落している状態は、現行ソースでは確認できない。

### テスト経路

`src/app/discussions/create/__tests__/page.test.tsx:80-107` は、作成処理を `processDiscussionCreationFlow` のモックで成功させ、完了見出しを確認し、「会話を開始する」のクリックが `/discussions/naddr1created` へ遷移することを確認している。外部Nostrへの発行は行わない。

## 4. 公開URLの観測

ユーザーの指定URLを Chromium 151 で開き、フォームへの入力・送信を行わずにDOMを観測した。

- URL: `https://kazaguruma-transit.nawashiro.dev/discussions/create`
- HTTP: `200`
- title: `🐴 会話を作成 - 風ぐるま`
- 画面幅: 780px
- 観測した公開DOM:
  - `追加`: `btn btn-primary ... join-item h-11 rounded-r-full dark:rounded-r-sm text-base`
  - `会話を作成する`: `btn btn-primary rounded-full dark:rounded-sm ... w-full text-base`
  - いずれにも `gap-0` は含まれない
  - 戻るリンクにも `gap-0` は含まれない

これは公開中ビルドが、現行 `dev` の #106 取り込み前の実装である可能性を示す。ただし、作成完了状態を表示するために会話を実際に発行することは禁止したため、公開URL上の完了CTA自体は直接観測していない。公開画面のスクリーンショットは、入力フォームの観測証拠としてのみ扱う。

`web_extract` はバックエンド応答形式エラーで利用できず、最初の browser-use 呼び出しはCDP未起動で失敗した。その後、ユーザー許可のもとで Debian 13 に Chromium 151 と chromedriver を導入し、headless Chromium のCDPを起動してDOM観測を完了した。

## 5. ベースライン検証

Issue worktreeで Node 22.23.2 を使用し、依存関係を `npm install --no-audit --no-fund` で導入した。初回の focused test は依存未導入のため `jest: not found` だった。依存導入後、次を実行した。

```bash
PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npm test -- --runInBand --runTestsByPath src/app/discussions/create/__tests__/page.test.tsx src/components/ui/__tests__/Button.test.tsx --silent
```

結果: **2 suites / 18 tests PASS**。

## 6. 原因仮説と判定

| 順位 | 仮説 | 予測 | 現時点の判定 |
|---|---|---|---|
| 1 | 公開ビルドが `dev` より古く、#106の `Button` 修正を含まない | 公開DOMのButtonに`gap-0`がなく、現行devのButton実装にはある | 公開フォームで一致。最有力 |
| 2 | 完了画面だけが共有Buttonの契約を迂回している | `page.tsx` の完了CTAにnative buttonまたは別抽象化がある | 現行devでは両CTAとも`Button`。棄却 |
| 3 | Button抽象化が`className`を捨て、画面側の`gap-0`指定が効かない | page側のgap指定がruntimeで消える | 完了CTAはpage側指定なしでもButton既定値によりgap-0。今回の直接原因ではない |
| 4 | DaisyUIの親レイアウト`flex gap-4`を、ボタン内部のgapと混同している | 親の2ボタン間隔だけを変えると解消する | Issueの「btnにgap-0」と一致せず、採用しない |

## 7. 実装境界

今回の最小対応は、作成完了状態の2つのCTAが `gap-0` を持つことを回帰テストで固定し、現行 `dev` で既に満たしていることを証明することである。

- 対象: `src/app/discussions/create/__tests__/page.test.tsx`
- 条件: 成功状態をモックで再現し、2つのCTAの`gap-0`と既存の遷移を確認する
- 現行 `dev` のproduction source: 追加修正不要の見込み
- 公開ビルドの更新/デプロイ: 今回のローカルIssue対応の範囲外
- Button抽象化全体の撤去: 具体的な移行要件がないため範囲外
- 実際の会話作成、Nostrイベント発行、productionデータ変更: 実施しない

テスト追加後に、親が現行bytesとfocused testを再確認する。テストが現行契約を満たさない場合に限り、最小のproduction修正を再計画する。

## 8. 変更状況

Issue #119用worktreeでは、回帰テストとして`src/app/discussions/create/__tests__/page.test.tsx`へ6行を追加した。production source、package、凍結pathは変更していない。Issue文書3ファイルは親エージェントが作成・更新した。

T004のテストは現行devで即時GREENだった。fresh read-only reviewは`SUBAGENT_STATUS: COMPLETE` / `VERDICT: PASS`であり、レビュー中のbytes変更はなかった。親側の最終検証結果は次のとおり。

- focused Jest: 2 suites / 18 tests PASS
- 全Jest: 139 suites PASS / 2 skipped、856 tests PASS / 13 skipped
- strict TypeScript: exit 0
- Lint: exit 0（既存warningのみ）
- Build: exit 0（Prisma/Next成功。`transit-config.json`不在のGTFS import表示は環境要因）
- `git diff --check`: PASS
- Issue worktree: test 1 pathのtracked diffとIssue文書3件のuntrackedのみ
- production/package/frozen path: 不変
- 公開環境での会話作成・Nostr発行: 未実施
