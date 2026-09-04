# Issue #122 調査記録

- Issue: [#122 add: ルートページの受賞のお知らせを消して、お知らせにする](https://github.com/nawashiro/kazaguruma-transit/issues/122)
- Repository: `nawashiro/kazaguruma-transit`
- 調査基準ブランチ: `dev`
- 調査基準SHA: `380ef8ad956b289d5033e286b19fdfd110ff68fd`
- 調査日: 2026-09-04 UTC
- 作業ディレクトリ: `/opt/data/kazaguruma-transit`

## 1. 開始状態とIssueの状態

作業開始時は `fix/issue-87-app-config` 上で作業ツリーが clean だった。`origin/dev` をfetchすると、リモートは `16f6a19` から `380ef8a` へ10コミット進んでいた。その後、`dev`へ切り替え、`git pull --ff-only origin dev`でfast-forwardした。

確認結果:

```text
branch=dev
HEAD=380ef8ad956b289d5033e286b19fdfd110ff68fd
origin/dev=380ef8ad956b289d5033e286b19fdfd110ff68fd
status=## dev...origin/dev
git diff --check=exit 0
```

GitHubからIssue本文・状態・コメント・ラベル・担当者を読み戻した。

- State: `OPEN`
- Title: `add: ルートページの受賞のお知らせを消して、お知らせにする`
- Comments: 0
- Labels: なし
- Assignees: なし
- 本文の要望:
  - ルートページの表示を「運営からのお知らせ」に変更する
  - お知らせを`app-config.json`からビルド時に生成し、静的に配信する
  - JSONの内容はお知らせ文言とURLだけにする
  - お知らせ文言を`a`要素として表示する
  - 既存カードと同じスタイルで、Infoアイコン付きの`h2`「運営からのお知らせ」を表示する

Issueのtimelineでは、作成時のタイトルが `add: ルートページの aside 受賞のお知らせ を修正する` から現在のタイトルへ変更されている。追加コメントや実装方針の補足はない。

## 2. 重複作業と候補変更の確認

次の検索を実行した。

```bash
gh pr list --repo nawashiro/kazaguruma-transit --search "122" --state all --limit 100
gh pr list --repo nawashiro/kazaguruma-transit --search "受賞" --state all --limit 100
gh pr list --repo nawashiro/kazaguruma-transit --search "お知らせ" --state all --limit 100
gh pr list --repo nawashiro/kazaguruma-transit --search "announcement" --state all --limit 100
```

Issue #122を参照するPRは見つからなかった。「受賞」では、Issue #81に関係するマージ済みPR #82だけが見つかり、今回のルートページ変更とは無関係だった。「お知らせ」「announcement」には該当PRがなかった。

`git log --all --grep='122\|お知らせ\|announcement'`でもIssue #122の対応コミットは見つからなかった。既存のローカル／リモートブランチにもIssue #122対応を示すブランチはない。

## 3. 現行の表示・設定経路

### 3.1 ルートページ

`src/app/page.tsx`はclient componentであり、現在の表示経路は次のとおりである。

1. `Home`が`PageHeader`を表示する。
2. `PageHeader`の直後に`<div className="mb-6"><AwardRecognition /></div>`を固定表示する。
3. `AwardRecognition`は`@/lib/award/award-data`から受賞名、賞名、バッジ画像URLを直接importする。
4. カード内にバッジ画像、受賞名、受賞文、`/award`への詳細リンクを表示する。
5. その後に目的地・出発地・日時の入力フォームと運行情報カードを表示する。

`AwardRecognition`以外のルートページ要素は、今回のIssueとは関係しない検索状態・URL遷移・注意書きの既存実装である。

### 3.2 受賞ページ

`src/app/award/page.tsx`は`award-data`を直接利用する独立したページである。`git show e865502`で確認した「redundant award badge」の修正は受賞ページ内のバッジ表示を対象としており、ルートページの`AwardRecognition`は残っている。したがって、Issue #122では受賞ページを削除せず、ルートページの固定カードだけをお知らせ表示へ置き換えるのが適切である。

### 3.3 公開設定

Issue #87のマージ後、`src/lib/config/app-config.ts`が`app-config.json`の静的importと実行時検証を担っている。`app-config.json.example`と、現在のignoredな`app-config.json`のトップレベルキーは次の5つであり、お知らせ設定はまだない。

```text
appUrl
gaMeasurementId
locationsDataVersion
discussion
support
```

既存の`AppConfig`は、`discussion`と`support`を構造化して検証し、準備処理が`app-config.json`をexampleから生成する。今回も同じ公開設定境界を使えば、Nostr、GTFS、Prisma、外部通信を増やさずにビルド時静的設定を実現できる。

Issue #87で確立された設定境界には、旧`NEXT_PUBLIC_*`参照や公開設定用のDocker ARGは残っていない。調査時点のproduction sourceで`NEXT_PUBLIC_`、`announcement`、`information`、`infomation`の使用件数はいずれも0件である。

## 4. 履歴と設計意図

受賞表示はcommit `1ed1b7c add: showcase hackathon award`で追加された。追加時点からルートページに受賞カードを置くことは意図された仕様だった。その後の`e865502 fix: remove redundant award badge`は受賞詳細ページの重複バッジを整理しただけで、ルートページからの撤去ではない。

よって今回のIssueは、偶発的な表示不具合の修正ではなく、既存の固定的な受賞カードを、運営が設定変更できる静的なお知らせカードへ責務変更する要求である。受賞データ定数や`/award`ページを巻き込む必要はない。

## 5. 根因と仮説

| 順位 | 仮説 | 根拠 | 判定 |
|---|---|---|---|
| 1 | ルートページが`AwardRecognition`を直接固定表示しており、`app-config.json`からお知らせを差し替える経路がない | `src/app/page.tsx`の固定import・固定render、`AppConfig`にannouncement項目がない | 根因 |
| 2 | 受賞ページ側のバッジ整理がルートカードの要望を満たす | `e865502`の変更対象は`src/app/award/page.tsx`だけで、ルートカードは残っている | 否定 |
| 3 | Nostr、GTFS、Prismaなどの動的データ取得が告知表示を制御している | 現行カードは`award-data`の静的定数だけを使い、外部取得を行わない | 否定 |

## 6. 実装境界の提案

次の最小変更を行う。

- `src/lib/config/app-config.ts`
  - `AnnouncementAppConfig`を追加する。
  - `AppConfig`に`announcement`を追加する。
  - `information`と`url`を非空文字列として検証する。
- `app-config.json.example`
  - `announcement`を追加し、既存の受賞告知を初期値として`information`と`url`だけを持たせる。
- `src/components/features/Announcement.tsx`
  - `appConfig.announcement`を静的に読み込む。
  - 既存カードと同じDaisyUIカード構造で、Lucideの`Info`アイコン付き`h2`「運営からのお知らせ」と、お知らせ文言を表示する`a`要素を描画する。
  - アイコンは`aria-hidden="true"`とし、ルビ処理対象をテキスト境界に限定する。
- `src/app/page.tsx`
  - `AwardRecognition`の固定表示を`Announcement`へ置き換える。
  - 検索フォーム、注意書き、状態遷移は変更しない。
- `AwardRecognition.tsx`と専用テスト
  - ルートページから参照されなくなるため削除する。未使用のproduction codeとテストを残さない。
- `src/lib/config/__tests__/app-config.test.ts`、`src/components/features/__tests__/Announcement.test.tsx`、`src/app/__tests__/page.test.tsx`
  - 設定テンプレート・parser、カードの見出し／リンク／アイコン、ルートページでの受賞カード撤去をテストする。

受賞詳細ページ、`src/lib/award/award-data.ts`、`next.config.ts`の外部画像設定、Nostr、認証、GTFS、Prisma、永続化は変更しない。

### `information`キーの表記

Issue本文には`infomation`という綴りがあるが、既存コードにその識別子はなく、JSON契約の正式なキー名としての別指定もない。憲章のClear NamingとType Safetyに従い、実装上の公開キーは標準綴りの`information`とする。この判断を`spec.md`、`plan.md`、`tasks.md`にも明記し、誤綴りの互換fallbackや二重キーは追加しない。

## 7. 変更前の検証

Node.js `v22.23.2`をPATHの先頭へ指定し、Issueに直接関係する既存テストを実行した。

```bash
PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npm test -- --runInBand --runTestsByPath \
  src/app/__tests__/page.test.tsx \
  src/components/features/__tests__/AwardRecognition.test.tsx \
  src/lib/config/__tests__/app-config.test.ts
```

結果:

```text
Test Suites: 3 passed, 3 total
Tests:       12 passed, 12 total
```

このテスト結果は基準コードの現行挙動を示すものであり、Issueの完了を示さない。`AwardRecognition.test.tsx`は旧受賞カードが表示されることを検証しているため、実装時に新しいお知らせ契約へ置き換える必要がある。

## 8. 調査結論

Issue #122の根因は、ルートページの告知が受賞専用componentと定数へ固定され、既存の`app-config.json`設定境界から独立していることである。`app-config.json`へ小さな`announcement`設定を追加し、`information`を`a`要素として表示する専用カードへ置き換えれば、Issueの要求を満たせる。受賞詳細ページは別責務のため維持する。

調査段階でproduction source、設定、テスト、履歴、外部システムの状態は変更していない。次段階で憲章ゲートを適用した仕様・計画を作成した。

## 9. 実装後の検証

- T005は設定テストだけを変更し、1 suite / 9 tests中5 failed・4 passedの意味あるREDになった。T006のfresh reviewは`VERDICT: PASS`、`modified: false`、開始／終了SHA一致だった。
- T007で`AnnouncementAppConfig`、parser検証、tracked exampleを追加した。親が既存値を保持したままignored `app-config.json`へannouncementを追加し、config focused Jestは1 suite / 9 tests passedになった。
- T008はHomeテストだけを変更し、1 suite / 11 tests中6 failed・5 passedのREDになった。T009のfresh reviewは、任意SVG、旧固定文言、カード構造・位置、section内linkの検証不足を指摘してFAILした。
- T008Rで中立mock、`svg.lucide-info`、旧受賞名・賞名、カードクラス・位置、section内linkを追加した。1 suite / 13 tests中8 failed・5 passedの意味あるREDを確認し、T009Rは`VERDICT: PASS`、`modified: false`、開始／終了SHA一致だった。
- T010で`Announcement`を追加し、`Home`の固定受賞カードを置換し、ルート専用の`AwardRecognition`と専用テストを削除した。親のfocused JestはHome、config、award pageの3 suites / 25 tests passedだった。`/award`と`award-data`は変更していない。
- T010で`card-title`のproduction usageが21から22になったため、全Jestの初回実行では既存の件数契約だけが失敗した。T010Cでテスト名と2つの期待件数だけを22へ同期し、T010CRのfresh reviewは`VERDICT: PASS`、`modified: false`、開始／終了SHA一致だった。
- 修正productionを旧AwardRecognition状態へ一時復元した感度確認では、Home回帰テストが13 tests中8 failed・5 passedとなった。旧UIが実際に検出され、修正状態への復元後にハッシュ一致と`git diff --check`を確認した。
- 全Jestの初回実行では、上記のcard-title件数契約に加えて`src/app/discussions/__tests__/page.streaming.test.tsx`の10 testsが一時的に失敗した。同suite単独実行は11/11 passed、全Jestの再実行は2 skipped / 145 passed suites、13 skipped / 915 passed testsであり、今回の差分による再現性のある失敗とは判定しなかった。
- `npx tsc --noEmit --incremental false`は終了コード0、`npm run lint`は終了コード0、`npm run build`は終了コード0だった。lint/buildには既存warningと`next lint`非推奨表示、buildには`transit-config.json`不足による既存GTFS設定表示があったが、今回差分のerrorではない。
- `git diff --check`は終了コード0。production sourceの`AwardRecognition`参照と`infomation`は0件で、announcementは静的config読み取りだけを行う。

## 10. 実装結論

Issue #122の要求は、既存の公開設定境界へ小さなannouncement契約を追加し、ルートページだけを汎用告知カードへ置換することで満たした。受賞詳細ページは維持し、旧受賞カードの画像・固定文言・専用リンクはルートから除去した。新規の動的取得、永続化、外部送信は行っていない。

## 11. 配送結果

- 実装commit `b7233e2599fd856e0c048485806c0fa2effecda2`（`fix: Issue #122のルート告知をお知らせ設定へ移行`）を作成し、`fix/issue-122-route-announcement`としてGitHubとTangledへpushした。
- GitHub PR [#135](https://github.com/nawashiro/kazaguruma-transit/pull/135)を作成した。作成時のbaseは`dev`、headは`fix/issue-122-route-announcement`、head SHAは上記commit、stateは`OPEN`である。mergeは行っていない。
- GitHubからPR本文と変更13ファイルを読み戻し、Issue #122のリンク、設定契約、検証結果、非対象を確認した。
- Quality Gate run `33861246469` / job `100985951169`は上記head SHAに対して`success`だった。checkout、Node setup、設定準備、依存インストール、ESLint、strict TypeScript、Jestが成功した。Node.js 20 action deprecated annotationは既存workflowの警告である。
- 配送後のPRはOPENのまま維持し、Issueのmerge・close、外部サービスへの追加送信は行っていない。
- 配送記録追補commit `e3598fdb7bc619b97b61ecb683b4b4a927e13dac`もGitHubとTangledへpushした。追補後のPR headはこのSHAである。
- 追補commitに対するQuality Gate run `33862080856` / job `100988583033`も`success`だった。

## 12. スタイル追補の根因確認

- ユーザー提供画像の崩れを受け、Puppeteer/Chromiumで現行ページをviewport 1100x800にて読み込んだ。初回実装の`h2.card-title.inline.gap-0`は`display:block`で、Info SVGも`display:block`となり、直下の見出しspanが次行へ送られていた。
- h2全体は`ruby-text`ではなく、Rubyfulは見出し全体を処理していなかった。根因は、h2内でInfo SVGと見出しspanを兄弟要素として置いたまま、通常のSVG表示規則と`card-title`のレイアウトに委ねていたことと確定した。
- `inline-block`をInfoへ付ける候補でも同一行になることは確認したが、ユーザーの指摘を優先し、styleを個別class assertionで固定する方針は破棄した。
- 最終構造は`h2.card-title.flex.gap-0`、Infoアイコン、`span.ruby-text.gap-0`とした。h2の文書構造を明示し、既存のgap契約も維持した。
- 初回style追補で追加した`inline-block` assertionとカード位置／装飾classテストは削除した。意味論・設定・link・旧表示撤去・既存操作のテストだけを残した。

## 13. ユーザー指摘後の検証

- 関連focused Jestは3 suites / 17 tests passed。全Jestは2 skipped / 145 passed suites、13 skipped / 914 passed testsだった。
- strict TypeScript、lint、buildはexit 0。lintの既存warning、`next lint`非推奨表示、`transit-config.json`不足表示は差分由来ではない。
- 最終production差分は`Announcement.tsx`のh2／Info／内部span classの構造変更、最終test差分は過剰なstyle assertionとカード配置テストの削除、既存card-title契約の`flex`許容への一般化だけである。
