# Issue #126 調査記録

- Issue: [#126](https://github.com/nawashiro/kazaguruma-transit/issues/126)
- タイトル: `fix: card-titleスタイルが崩れている`
- 状態: open、コメント0件、ラベルなし、担当者なし
- 関連PR: `gh pr list --search '126'` の結果は0件
- 対象リポジトリ: `nawashiro/kazaguruma-transit`
- 基準ブランチ: `dev`
- 実装ブランチ: `fix/issue-126-card-title-ruby`
- 基準SHA: `d5d85b2c779dfa494ecf381f4429a219ac2b9f6a`

## 1. リポジトリ状態と最新化

作業開始時の作業ツリーは clean だった。`origin/dev` を fetch したところ、ローカル `dev` は `db92947` から `d5d85b2` へ3コミット fast-forward できた。現在の実装ブランチは、その `origin/dev` と同一の `d5d85b2c779dfa494ecf381f4429a219ac2b9f6a` から作成している。

Node/npm の調査時点の実行環境は Node `v26.5.1`、npm `11.17.0`。変更前の対象テストは次のとおり成功した。

```text
npm test -- --runInBand --runTestsByPath src/app/discussions/__tests__/page.streaming.test.tsx --silent

Test Suites: 1 passed, 1 total
Tests:       10 passed, 10 total
```

## 2. Issue本文と観測症状

Issue本文は、DaisyUI の `h3.card-title` がルビ付きのタイトルで崩れ、開発者ツールで `.card-title { display: flex; }` を解除すると改善する、と報告している。

添付画像では、カードタイトル内の通常文字列とルビ付き文字列が横方向の別要素として扱われ、見出しが不自然に分割されている。ルビは通常のインライン文字列として前後の文字と一緒に折り返されるべきである。

## 3. 現行実装の確認

`src/app/discussions/page.tsx:109-113` の一覧カードは次の構造である。

- 外側の `card`
- `card-body`（DaisyUIにより `display: flex; flex-direction: column`）
- `h3.card-title.text-lg.ruby-text.gap-0`
- `{discussion.title}`

`src/app/discussions/page.tsx:111` の `h3` には、DaisyUIの `.card-title` が付与する `display: flex` を解除する既存ユーティリティ `inline` がない。

一方、同じリポジトリの共通カード見出しは次のとおり既に `inline` を使用している。

- `src/components/ui/Card.tsx:56`: `card-title inline ruby-text gap-0`
- `src/components/ui/CarouselCard.tsx:42`: `card-title inline gap-0`

## 4. DaisyUIとブラウザ計算値

DaisyUI公式の Card ドキュメント（<https://daisyui.com/components/card/>）では、`card-title` は Card の Title part として定義され、標準例も `h2.card-title` である。リポジトリにインストールされた DaisyUIの `node_modules/daisyui/components/card.css` では、`.card-title` に次が定義されている。

```css
.card-title {
  align-items: center;
  gap: .5rem;
  display: flex;
}
```

同じカード構造を Chromium の実ブラウザで検証した。

- 現行クラス `card-title text-lg ruby-text gap-0`: `display=flex`, `gap=0px`
- `inline` 追加後のクラス `card-title inline text-lg ruby-text gap-0`: `display=block`, `gap=0px`

後者の `display=block` は `card-body` が flex container であるため inline flex item が blockify された計算値であり、重要なのは `h3` 自体が flex container ではなくなった点である。これにより、Rubyful が後から挿入する `ruby` と前後の文字列が通常のインライン書字方向・折り返しで処理される。

## 5. 根因

根因は、Rubyful の対象である `h3.ruby-text` に、DaisyUI `.card-title` の `display:flex` がそのまま残っていることである。Rubyful がルビ要素を挿入すると、見出しのテキストと `ruby` が flex item として分離され、画像の崩れが発生する。

これはデータ取得、タイトルの解析、リンク、ARIA、カード構造の問題ではない。既存の共通カードで採用済みの `inline` によって、表示境界だけを修正できる。

## 6. 実装境界と除外

変更対象は次の5ファイルに限定する。

- `src/app/discussions/page.tsx`
- `src/app/discussions/__tests__/page.streaming.test.tsx`
- `issues/126-daisyui-card-title-ruby/investigation.md`
- `issues/126-daisyui-card-title-ruby/plan.md`
- `issues/126-daisyui-card-title-ruby/tasks.md`

実装では `h3.card-title` に `inline` を追加する。新規CSS、`.card-title` の全体上書き、Rubyfulの動作変更、共通コンポーネントの改変、データ・認証・Nostr read・リンク先・ARIA・カード以外の表示変更は行わない。

他の `card-title` の網羅的なリファクタリングは今回のIssue本文にないため、KISSの観点から行わない。共通 `Card` / `CarouselCard` で既に同じ対策が済んでいるため、新しい抽象化や重複CSSも導入しない。

## 7. 受入条件

1. 会話一覧カードの `h3.card-title` が既存の `inline` ユーティリティを持つ。
2. Rubyful が生成する `ruby` と通常文字列が、DaisyUIの flex item 分割を受けずにレイアウトされる。
3. タイトル文字列、カードリンク、説明、参加中バッジ、モデレーター数、loading/partial/error/empty状態は変わらない。
4. 実装前に追加回帰テストが意味のあるREDとなり、実装後にGREENとなる。
5. テスト、strict TypeScript、lint、全Jest、build、ブラウザ相当のcomputed style確認、diff/status確認を行う。
6. 指定外のproduction path、データ層、設定、憲章は変更しない。

## 8. 実装後検証

- TDD RED: `npm test -- --runInBand --runTestsByPath src/app/discussions/__tests__/page.streaming.test.tsx --silent` は、実装前に1 suite / 11 tests中10 passed・1 failed、終了コード1。唯一の失敗は実レンダーされた`h3.card-title`の`inline`不足で、collection/setup failureはなかった。
- Test review: 独立fresh read-only reviewは`SUBAGENT_STATUS: COMPLETE` / `VERDICT: PASS` / `modified: false`。テストは実ページrenderと`getByRole("heading", { level: 3, name })`を使い、既存classと`inline`を検証している。開始・終了SHAは一致した。
- Production実装: `src/app/discussions/page.tsx`の`h3`へ`inline`を1トークン追加した。production差分は1 insertion / 1 deletionのみで、他の表示・操作・データ経路は変更していない。
- Focused GREEN: Node `v22.23.2` / npm `11.17.0`で1 suite / 11 tests PASS。
- Strict TypeScript: `PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npx tsc --noEmit --incremental false` は終了コード0。
- Lint: `npm run lint` は終了コード0。`next lint`のdeprecated noticeと、既存の`any`、`<img>`、Hook依存、React test warningは既存warningとして分離した。
- 全Jest: `PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npm test -- --runInBand` は終了コード0、139 suites passed / 2 skipped、858 tests passed / 13 skipped。既存のReact `act`、unknown prop、SVD関連console出力は失敗ではないwarningとして記録した。
- Build: `PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npm run build` は終了コード0。Prisma生成・DB同期・Next production buildは成功した。`transit-config.json`不在による既存GTFS importエラー表示、Prisma update notice、既存lint warningはbuild成功と分離した。
- Browser probe: 現行`page.tsx`から取得したclassとDaisyUI stylesheetをChromiumで検証し、`card-title inline text-lg ruby-text gap-0`、`display=block`、`flexContainer=false`、`gap=0px`、`rubyDisplay=ruby`を確認した。`display:block`は`card-body`のflex子要素としてのblockifyであり、見出し自身がflex containerでないことを示す。
- Build後status: 変更は指定したtest、production、Issue docs 3件だけ。`git diff --check`は終了コード0、HEADは基準SHAのまま、staged pathなし。

## 9. 配送後確認

- commit: `a1403a9ea6c8cf1d459ee012267fa024b3028f01`
- remote branch: `origin/fix/issue-126-card-title-ruby`へpushし、`git ls-remote`でremote SHAがcommit SHAと一致した。
- Pull Request: [#127](https://github.com/nawashiro/kazaguruma-transit/pull/127)、base=`dev`、head=`fix/issue-126-card-title-ruby`、state=`OPEN`。本文、head/base、変更5ファイルをGitHubから読み戻した。mergeは行っていない。
- Quality Gate: run `33596996309` / job `100142347007` はexact SHA `a1403a9ea6c8cf1d459ee012267fa024b3028f01`に対してsuccess。ESLint、strict TypeScript、Jestを含む全job stepが成功し、Node.js 20 deprecation annotationのみが付いた。
