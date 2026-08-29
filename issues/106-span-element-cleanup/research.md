# Issue #106 調査記録

- Issue: [#106](https://github.com/nawashiro/kazaguruma-transit/issues/106)
- タイトル: `fix: そこら中にあるspan要素を駆逐する`
- 調査日: 2026-08-29
- 対象リポジトリ: `nawashiro/kazaguruma-transit`
- 対象ブランチ: `fix/issue-106-span-gap`
- 対象ベース: `dev`
- ベースSHA: `d4fda9a6f69cc01452fa58eee3b22181eb51d057`
- 作業ツリー: `/opt/data/work/kazaguruma-transit-issue-106`

## 1. Issue・ブランチ・作業ツリー

- Issue #106 は open、コメント0件、担当者なし、ラベルなし。
- `gh pr list --search '106' --state all`、`discussion title`、`relay discussion`、`Nostr discussion` の検索で、Issue #106に対応する既存PRは見つからなかった。
- `origin/dev` をfetchした結果、ローカル `dev` は `616610daa08f73f473f776dc7d46827896d7b888` から `d4fda9a6f69cc01452fa58eee3b22181eb51d057` へ8コミット fast-forward した。
- ルートの `dev` は更新後 `origin/dev` と同一SHAでcleanだった。
- 作業は更新済み `dev` から `fix/issue-106-span-gap` worktreeを作成した。
- worktree作成時にGit LFS対象の `src/app/apple-icon.png` と `public/images/map_placeholder.png` について「pointerではない」警告が出た。作業ツリーには `src/app/apple-icon.png` の既存差分が現れており、Issue #106では変更・復元・stageしない凍結対象とする。

## 2. 規約と今回の仕様境界

`AGENTS.md` と `.specify/memory/constitution.md` を確認した。作業言語、日本語の文書、TDD、2-space、strict TypeScript、アクセシビリティ、最終的なtest/lint/build検証などの一般原則は適用する。

Issue #106では、憲章・AGENTS.mdに残っていた「日本語ボタン文字列を必ず子spanの `ruby-text` 内に置く」という過去仕様を削除する。憲章のGovernanceに従い、版を`3.0.0`から`4.0.0`へ更新し、AGENTS.mdの同じ規定も削除する。Issue #106では次を現在の作業契約とする。

- 意味・ARIA・CSSレイアウト・動的コンテンツの境界を持たないspanは削除する。
- ルビ対象の指定が必要な場合は、可能な範囲で見出し・リンク・ボタン・メッセージなどの意味要素へ `ruby-text` を移す。
- `badge`、`loading`、`sr-only`、`truncate`、`label-text`、`id`、`data-*`など、表示・アクセシビリティ・レイアウト・参照の責務を持つspanは残す。
- 既存のNostr通信、認証、画面遷移、フォーム値、ARIA名・状態は変更しない。

過去仕様の削除自体を、Issue #106の文書・実装・検証範囲に含める。憲章とAGENTS.mdには、削除理由と版変更を記録する。

## 3. 現行のspan棚卸し

更新済み `dev` のproduction TSX（`src/app` と `src/components`、テストを除外）を走査した。

- span開始タグを含むファイル: 43ファイル
- span開始タグの行: 221行
- 属性のない `<span>`: 66行
- `className`に `ruby-text` を含むspan: 90行

この件数は「spanが存在する」件数であり、削除対象件数ではない。次のように分類した。

### 3.1 明確に不要な構造ラッパー

- `beginners-guide/page.tsx` と `usage/page.tsx` の目次リンク内の文字列span。
- `license/page.tsx` の `card-title` 内の文字列span。
- `settings/page.tsx` の `card-title` 内の文字列span。
- `discussions/page.tsx` の会話タイトル・参加中ラベルの文字列span。
- `SidebarLayout.tsx` のメニューボタンを囲む外側span。
- `ResetButton.tsx`、`PostPreview.tsx`、`RoutePdfExport.tsx`、`RouteCalendarExport.tsx`、`discussions/create/page.tsx`など、共通 `Button` の子文字列だけを包むspan。
- `RouteSearchResults.tsx`、`OriginSelector.tsx`、静的ページのDaisyUIボタン内で、文字列のためだけに置かれたspan。
- 見出しやタブの文字列だけを包み、親へ移せる `ruby-text` span。

### 3.2 責務があるため保持するspan

- `badge` とライセンス表示のbadge。
- `loading-spinner` と `sr-only`。
- `label-text`、`truncate`、`text-base font-bold`など、特定の表示・レイアウトを担うspan。
- タブのカウントbadge、アイコンとテキストを意図的に分離するフォームラベル等。
- `AuthRoutePage`の見出しID、`ThemeToggle`の読み上げ専用テキスト、`RubyWrapper`の外部ライブラリ連携用のhidden要素。

### 3.3 メッセージspanの置換

エラー・partial・status表示でボタンと同じ親にある文字列spanは、単に削除するとテキスト境界が失われるため、必要に応じて `p` などの意味要素へ置換する。ボタンを含まないアラートは、アラート自身またはメッセージ要素をルビ対象とする。

## 4. DaisyUI確認

DaisyUI公式のButton/Cardドキュメントを確認した。

- Buttonは `btn` を基本クラスとし、アイコン付き・テキスト付きの通常のbutton要素で構成する。
- Cardは `card`、`card-body`、`card-title`、`card-actions`の構造を持つ。
- 本Issueではこの標準構造を保ち、Rubyfulが生成するルビ要素間にDaisyUIのflex gapが介入しないよう、対象の `btn` と `card-title` に `gap-0` を明示する。
- アイコンと文言の間隔を残す箇所は、既存のレイアウトクラスまたはアイコン側のmarginで明示する。DaisyUIの暗黙のgapに依存しない。

参照:

- https://daisyui.com/components/button/
- https://daisyui.com/components/card/

## 5. 既存履歴との関係

- `5a541d3` は経路結果のリセットリンクを、親リンクを `ruby-text` にしたうえでプレーンなspanへ変更していた。
- その変更は「ルビ対象と表示文字列を分ける」過去仕様を示すが、今回のユーザー指示により、さらに親の意味要素へルビ指定を寄せ、不要なspan自体を削除する。
- `docs/ui-kiss-principle-review.md` は共通Buttonの自動 `ruby-text` ラッパーを過剰な責務として指摘している。Issue #106ではこの指摘のうち、既存挙動を壊さない最小境界として、共通Buttonの構造ラッパー撤去と `gap-0` 明示までを扱う。Button API全体の再設計は対象外とする。

## 6. 根本原因と実装境界

根本原因は、Rubyfulへの対象指定、DaisyUIのflexレイアウト、ボタン内のアイコン・文字列配置を、意味を持たないspanの入れ子で調整してきたことである。その結果、次の二重構造が発生している。

1. 共通 `Button` が子全体をspanで包み、利用側も文字列をspanで包む。
2. `card-title`・`btn`の暗黙のgapと、Rubyfulが生成する文字要素の間隔が重なり、不要な空白を生む。

実装は次に限定する。

- production TSXの不要な属性なしspanと、親要素へ移せる文字列専用spanの削除・置換。
- 共通 `Button` の自動span撤去、意味要素への `ruby-text`付与、`gap-0`付与。
- DaisyUIの `btn` / `card-title` の明示 `gap-0`。
- 既存テストのDOM契約を新しい意味要素境界へ更新し、不要spanとgap漏れを検出するIssue専用契約テストを追加。

次は `span-structure-contract` を先にREDで追加し、別subagentのfresh read-only reviewを通過した後に実装へ進む。

## 7. 調査時点の検証

| コマンド・確認 | 結果 |
|---|---|
| `git fetch origin dev --prune` | 成功。`origin/dev=d4fda9a6f69cc01452fa58eee3b22181eb51d057` |
| `git pull --ff-only origin dev` | 成功。ローカル `dev` を8コミット更新 |
| `git status --short --branch`（root `dev`） | `## dev...origin/dev`。変更なし |
| Issue #106 live取得 | open、コメント0件、担当者・ラベルなし |
| 関連PR検索 | Issue番号・3つのキーワード検索で該当PRなし |
| production span棚卸し | 43ファイル / 221行、属性なし66行、ruby-text 90行 |
| DaisyUI公式Button/Card確認 | 標準クラス・構造を確認 |
| `git diff --check`（worktree初期状態） | 成功。既存LFS由来の`src/app/apple-icon.png`差分は凍結 |

## 8. 実装後検証

T004〜T006cの実装と親検証を完了した。変更内容は、不要な文字列専用spanの削除、状態メッセージの意味要素への移行、親のheading/link/buttonへの`ruby-text`移動、DaisyUI `btn` / `card-title`への`gap-0`明示、アイコン間隔の明示である。Nostr通信、認証、router遷移、フォーム値、既存のARIA境界は変更していない。

- production TSX: 81 files、span開始タグ61、属性なしspan 0、`ruby-text`を含むspan 17、badge span 12、loading span 5、sr-only span 4。
- Issue専用契約: 1 suite / 4 tests PASS。属性なしspan、`btn` / `card-title`の`gap-0`漏れ、共通Buttonの自動spanを検出する契約がGREENになった。
- `AGENTS.md`と憲章の本文には、子spanの`ruby-text`を要求する旧規定が残っていない。憲章は`4.0.0`、Last Amendedは`2026-08-29`。
- T004 focused: 11 suites / 59 tests PASS。T005 focused: 10 suites / 63 tests PASS。T006a focused: 8 suites / 47 tests PASS。T006b focused: 13 suites / 110 tests PASS。T006c focused: 3 suites / 14 tests PASS。
- strict TypeScript: `npx tsc --noEmit --incremental false` exit 0。
- Lint: `npm run lint` exit 0。`next lint` deprecation、既存の`any`、`<img>`、Hook依存、今回の変更対象テストに含まれる既存warningを分離記録した。
- 全Jest: 初回は`getNostrServiceConfig is not a function`のsetup failureが1件あったが、単独・ペア・再実行と変更前SHAのclean worktreeで再現しなかった。再実行は138 suites PASS / 2 skipped、853 tests PASS / 13 skipped。
- Build: `npm run build` exit 0。Prisma生成・DB push・Next production build成功。`transit-config.json`不在によるGTFS importエラー表示とPrisma update noticeは既存環境上のwarningとして分離した。
- `git diff --check`: PASS。`src/app/apple-icon.png`のLFS由来差分はIssue変更に含めず、未stageのまま保持している。

## 9. 追加調査: PR #117後のalert/status/menuレイアウト崩れ

### 9.1 網羅的な棚卸し

PR #117の現行production TSX 81ファイルをTypeScript ASTで走査し、`.alert`、`role="status"`、menu内のリンク・`summary`、`label`/`legend`の直接テキストを分類した。

| 対象 | 総数 | 直接テキストあり | 判断 |
|---|---:|---:|---|
| `.alert`要素 | 43 | 13 | `div.alert`の12件はgrid境界として修正対象。`p.alert`は意味要素自身のため許容 |
| `role="status"`要素 | 48 | 15 | `.alert`併用は28件。非`p`のloading/statusは意味要素へ移す |
| Sidebarのmenu項目 | 12 | 12 | すべてRubyful後にgrid列分割が起きる修正対象 |
| `label`/`legend` | 29 | 6 | すべてフォーム・読み上げ用の意味要素であり、今回のgrid崩れ対象外 |

`.alert`の直接テキスト13件のうち、修正対象の`div.alert`は次の12件である。

- `src/app/discussions/page.tsx`: 76、89、150行付近
- `src/app/locations/page.tsx`: 295、313、371行付近
- `src/app/settings/page.tsx`: 272行付近
- `src/components/auth/AuthenticationForm.tsx`: 228行付近
- `src/components/features/LocationSuggestions.tsx`: 80行付近
- `src/components/features/RouteCalendarExport.tsx`: 58行付近
- `src/components/features/RoutePdfExport.tsx`: 140行付近
- `src/components/features/RouteSearchResults.tsx`: 78行付近

`AuthRoutePage.tsx`の`p.alert`は、alert自身がメッセージの意味要素であり、button等の兄弟要素もないため直接テキストを許容する。`label`/`legend`の6件（`住所`、`パスキー名`、同意事項、時間タイプ、検索オプション等）はラベル自身が意味要素であり、span化・置換しない。

### 9.2 DaisyUIとRubyfulの相互作用

DaisyUI 5のmenu項目は次のgridスタイルを持つ。

```css
grid-auto-columns: minmax(auto, max-content) auto max-content;
grid-auto-flow: column;
gap: .5rem;
display: grid;
```

変更前のmenu項目は`svg + span.ruby-text`の2つのgrid itemだった。PR #117では`ruby-text`をmenu項目自身へ移したため、Rubyfulが生成する複数の`ruby`がgrid itemとして扱われる。

Puppeteerで390px幅の実DOMを計測した結果、変更前の「意見交換」は`24px 215px`の2列だったのに対し、現行版は`24px 177.188px 45.8125px`の3列となった。「使い方やサイト情報」のsummaryは、変更前の`24px 217px 6px`から現行版の`24px 46.9375px 16.375px 22.9062px 89.5312px 57.25px 6px`へ分割された。スクリーンショットでもラベルと開閉矢印の分散を確認した。

したがって、menuのgridをflexへ置換する提案2は採用しない。DaisyUIのsummary矢印を含む既存構造を維持し、ラベル全体を1つの子要素へ戻す。

### 9.3 alert/statusの相互作用

DaisyUIの`.alert`は`display: grid`、`grid-auto-flow: column`、`gap: 1rem`を持ち、`:has(:nth-child(2))`で子要素数に応じた列を選択する。直接テキストは匿名grid itemとなり、`span`や`p`のようなelement childとは列計算が異なる。

340px幅の制御probeでは、同じalertに対して次の差が出た。

| 構造 | grid列 | メッセージ領域 | button領域 |
|---|---:|---:|---:|
| `span` + button | `213.609px 58.391px` | 高さ20px | 幅58.39px |
| 直接テキスト + button | `165.344px 106.656px` | 幅156.6px・高さ36px | 幅106.66px |
| `p.ruby-text` + button | `221.672px 50.328px` | 高さ48px | 幅50.33px |

alert/statusの直接テキストは、buttonと同居する場合だけでなく、iconやRubyfulの有無によって列計算が変わるため、`p.ruby-text`等の意味要素へ統一する。非alertのloading statusも、spinnerと文言の責務を別要素にして直接テキストをなくす。ただし`p.alert`自身の本文は、すでに意味要素自身であるため追加ラッパーを作らない。

### 9.4 修正方針

1. Sidebarの`Link`/`summary`/外部`a`は、親の`ruby-text gap-0`を外し、文字列と`ruby`を1つの直接子`span.ruby-text`へ戻す。menuのDaisyUI gridとgapは変更しない。
2. `div.alert`および`p`以外の`role="status"`で、直接テキストを`p.ruby-text`等へ移す。`role`、`aria-live`、メッセージ内容、button callback、既存のloading表示を維持する。
3. label/legendはフォームの意味要素として保持する。DaisyUI自体のgrid/flex実装方式は変更しない。

## 11. 実装後の検証結果

### 11.1 source inventory

F005a〜F005cの実装後、TypeScript AST probeを再実行した。production TSX 81ファイルについて、`.alert`は43件で、直接テキストとして残ったのは意味要素自身である`AuthRoutePage.tsx:49`の`p.alert`だけだった。`role="status"`は48件で、直接テキストとして検出されたのは`location-detail/[id]/loading.tsx:8`の`p`、`AuthRoutePage.tsx:49`の`p.alert`、および安全分類済みの`RouteSearchResults.tsx:171`の`flex + spinner` statusだけだった。したがって、修正対象である`div.alert`と非`p` statusの直接テキストは0件である。

Sidebarはmenu項目12件、単一の直接子`span.ruby-text` 12件、親menu itemの`ruby-text` 0件・`gap-0` 0件となった。`label`/`legend`は29件中6件の直接本文を保持し、フォーム用の意味要素を変更していない。

### 11.2 automated gates

- F004 final fresh test review: reviewer `sa-0-5cdcab3d` が`SUBAGENT_STATUS: COMPLETE` / `VERDICT: PASS`。変更なし、開始終了SHA一致。
- layout contract + Sidebar/status focused: 4 suites / 19 tests PASS。
- alert focused: 8 suites / 43 tests PASS。
- status focused: 7 suites / 54 tests PASS。
- 全Jest: 139 suites PASS、2 suites skipped、856 tests PASS、13 tests skipped。
- strict TypeScript: `npx tsc --noEmit --incremental false --pretty false` exit 0。
- lint: `npm run lint` exit 0。`next lint` deprecation noticeと既存warningのみ。
- build: `npm run build` exit 0。Prisma生成、schema同期、Next production build成功。`transit-config.json`不在によるGTFS importエラー表示は既存環境のwarningとして分離した。
- `git diff --check`: exit 0。

### 11.3 browser evidence

Node 22.23.2の隔離dev serverをport 3108で起動し、Puppeteerで390×844の実ページを確認した。`/`でSidebarを開いた状態は、summaryが`24px 217px 6px`、通常menu itemが`24px 215px`のgrid列となり、Rubyful後もラベルが単一列に収まった。body/documentのscroll widthは390pxでviewportと一致した。

`/discussions`、`/locations`、`/settings`の通常状態ではalert/statusは発火せず、3ページともbody/documentのscroll widthは390pxで横溢れなしだった。さらに現行アプリCSS上で、productionと同じサイズ付きicon + `p.ruby-text` + buttonのalert構造を一時挿入する制御probeを実行した。結果は`display:grid`、`gridTemplateColumns: 24px 181.25px 116.75px`、直接テキスト0件、body/documentのscroll width390pxであった。これは現行CSSのgrid子要素境界を検証する補助証拠であり、挿入DOM自体はリポジトリへ保存していない。

### 11.4 変更範囲

production変更はSidebar 1件、alert 8 path、status 7 pathに限定した。DaisyUIの共通CSS、`.menu`/`.alert`のdisplay方式、Nostr、認証、router、データ取得、凍結PNGは変更していない。テスト・文書の変更と`src/app/apple-icon.png`の既存LFS差分は別扱いで保持している。
