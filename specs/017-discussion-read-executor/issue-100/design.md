# Issue #100 新規コメント追補設計: 詳細モデレーター遷移の共有read整合

## Issue

- Repository: `nawashiro/kazaguruma-transit`
- Issue: [#100](https://github.com/nawashiro/kazaguruma-transit/issues/100)
- 追加コメント: [#issuecomment-5386410845](https://github.com/nawashiro/kazaguruma-transit/issues/100#issuecomment-5386410845)
- 調査日: 2026-08-23
- 対象ブランチ: `fix/issue-100-moderator-read-reload`
- 調査時点のHEAD: `fe79cde89cb3b0e317a6e7689fcbad730c60c959`
- 比較対象 `origin/dev`: `2781e83d24538657b900f291b815ab3b3b9c8d82`

この追補は、既存のIssue #100対応（`/discussions/moderator`の共有content readと一覧の再読み込み導線）を前提に、追加コメントで指摘された詳細モデレーター画面の乖離を再調査する。既存設計のうち、詳細モデレーター画面をスコープ外とした判断は本追補で superseded とする。

## 1. 調査結果

### 1.1 パス名の事実確認

Issue本文・コメントの `/discussions/[naddr]/moderator` は単数形だが、リポジトリに存在する詳細モデレーターrouteは次である。

- 実在する詳細route: `/discussions/[naddr]/moderators`
- 実在する管理route: `/discussions/moderator`
- `/discussions/[naddr]/moderator` の `page.tsx` またはリンク: production sourceには存在しない

以降、本設計で「詳細モデレーターroute」と書く場合は、Issueコメントが指している実在route `/discussions/[naddr]/moderators` を意味する。単数形のalias/redirectは、現時点で利用箇所がなく、今回のKISS設計には追加しない。文字どおりの単数形URLを外部契約にする必要が判明した場合は、route互換性の別Issueとして扱う。

### 1.2 現在の取得経路

| 画面 | Providerのscope | 共有content read | 画面固有read |
|---|---|---|---|
| `/discussions` | management | `loadDiscussionModerationSnapshot` | 参照先会話のbatch read |
| `/discussions/manage` | management | `loadDiscussionModerationSnapshot` | 管理画面固有の表示判定 |
| `/discussions/moderator` | management | `loadDiscussionModerationSnapshot` | モデレーター申請read |
| `/discussions/[naddr]` | detail | `loadDiscussionModerationSnapshot` | 評価read |
| `/discussions/[naddr]/approve` | detail | `loadDiscussionModerationSnapshot` | 承認操作 |
| `/discussions/[naddr]/moderators` | detail | **開始しない** | モデレーター申請read |
| `/discussions/[naddr]/edit` | detail | **開始しない** | moderator-request read |

根拠は次の実装である。

- `src/components/discussion/DiscussionDataProvider.tsx` の `CONTENT_PATHS` は管理routeを列挙するが、detail側は `shouldLoadDetailContent()` で `/discussions/[naddr]` と `/approve` だけを許可している。
- `src/app/discussions/[naddr]/layout.tsx` は同一の `DiscussionDataProvider` を `moderators` を含む全detail child routeへ保持する。
- `src/app/discussions/[naddr]/moderators/page.tsx` は共有content stateを使わず、metadataとモデレーター申請を読んでいる。
- `src/app/discussions/moderator/page.tsx` は詳細モデレーター画面を再利用するが、親の `DiscussionManagementShell` によりmanagement content readが開始されるため、同じコンポーネントでもProviderのscopeが異なる。

### 1.3 再現症状との対応

`[naddr]` のlayoutはroute遷移でunmountされない。そのため、mainから`moderators`へ遷移すると、Providerは同じままpathnameだけを受け取り、`shouldLoadDetailContent` の結果を変える。現在の設計には次の問題がある。

1. 共有content readの開始条件が、Providerのデータscopeではなく子routeのpathname whitelistに分散している。
2. global moderator routeには過去の修正で`CONTENT_PATHS`が追加されたが、detail moderator routeは別の判定関数に残り、同じ「モデレーター画面」でも取得経路が異なる。
3. layoutをまたいで保持された`posts`、`contentCompletionReason`、read generationと、route変更後の「このrouteでcontentを読むか」の判定が独立している。readが非EOSEで終わった場合、mainへ戻った時点でも暫定状態と再読み込み導線が残る。readが遷移中にgeneration invalidationされた場合も、戻り先でどの共有readが正本かをroute条件から再判断する必要がある。
4. 現行テストは「detail moderators/editではcontentを読まない」という旧契約を固定しているが、main→moderators→mainの実際の遷移と、global/detail moderator間の同一scope契約を検証していない。

したがって、問題の核心はNostr transport、executorのretry、relay provenanceではなく、**同じdetail layout内の共有read lifecycleをpathname whitelistで切り替えていること**である。focused testは現行契約どおり43 testsが通るが、上記の遷移回帰を含んでいないため、これを修正の反証とは扱わない。live relayを使った再現はrelay応答タイミングに依存するため、実装前のtight loopはProviderの決定的fixtureで作る。

## 2. 問題の核心に対する再設計案

### 2.1 明示的なdata scopeをProviderへ渡す

`DiscussionDataProvider` に次の内部scopeを追加する。

```ts
type DiscussionDataScope = "management" | "detail";
```

- `DiscussionManagementShell` は `scope="management"` を渡す。
- `[naddr]/layout.tsx` は `scope="detail"` を渡す。
- `managementScope` はpathnameではなくscopeから決める。
- managementは一覧用naddr、detailはroute naddrをread targetにする。

scopeは候補relay、retry、completion、cache形式を変更するものではない。ProviderがどのDiscussionを共有するかを明示するだけである。

### 2.2 detail scopeでは共有content lifecycleを一つにする

`scope="detail"` のProviderは、detail layoutが保持されている間、metadataとmoderation contentを同じ共有lifecycleで管理する。`main`、`approve`、`moderators`、`edit`の子routeを移動しても、content readの開始可否をpathnameから再計算しない。

これにより、詳細モデレーター画面への直接アクセスを含めて、次を一つのルールにできる。

- detail Providerのmount時に共有content readを一度開始する。
- 同じdetail layout内のtab遷移では、既存eventsとcompletion stateを保持する。
- mainへ戻るためだけに同じcontent readを再実行しない。
- 非EOSEなら取得済みpostsを保持し、既存の`DiscussionReadStatus`で再読み込みを提供する。
- EOSEなら再読み込みstatusを表示しない。
- `reload()`だけがgenerationを進め、古いcallbackを無効化する。

モデレーター申請、評価、編集のmoderator-requestなど、各画面だけが利用するreadは現行の画面固有executor readとして残す。共有contentを表示しない画面でも、detail layoutで一つの共有snapshotを持つことで、routeごとの取得経路分岐をなくす。追加される通信はdetail layoutあたりの共有snapshot一回であり、tabごとの重複readは発生させない。

### 2.3 pathname whitelistを廃止する

次を廃止または置換する。

- `DiscussionDataProvider` のdetail content用`shouldLoadDetailContent()`。
- management/detailで同じ意味を重複して持つ`CONTENT_PATHS`によるcore read判定。
- route遷移のたびに`loadData`のcontent対象を変える依存関係。

pathnameは、管理一覧で「承認済みだけを参照対象にする」など、画面固有の表示判定にだけ残す。共有readの実行有無はlayoutから渡されたscopeで決める。

### 2.4 単純な追加修正を採用しない理由

`CONTENT_PATHS`へdetail moderatorsの文字列を追加するだけの案は採用しない。

- detail routeの実際のベース値は動的であり、固定文字列追加では表現できない。
- `main→moderators→main`のpersistent layoutとread generationの契約は解消しない。
- 今回は直っても、次のdetail tab追加時に同じwhitelist漏れが起きる。
- global routeとdetail routeが「同じ名前の画面だから同じ経路」になる保証を、テスト可能なscope契約として表現できない。

scopeをlayout境界で明示する方が、変更箇所は増えても責務が単純で、route追加時の判断も一つになる。

## 3. 受入条件

1. 実在する詳細モデレーターroute `/discussions/[naddr]/moderators` のProviderは、metadataだけでなく共有moderation content readを開始する。
2. `/discussions/moderator` と `/discussions/[naddr]/moderators` は、それぞれmanagement/detailの明示scopeを通じて、同じ共有content lifecycle契約を使う。
3. `/discussions/[naddr]` → `/discussions/[naddr]/moderators` → `/discussions/[naddr]` の遷移で、同一detail layout内の共有content readを不要に再開始しない。EOSEで完了したfixtureでは、戻り先に「再読み込み」statusを表示しない。
4. 非EOSE fixtureでは、詳細モデレーターrouteを経由しても取得済みpostsを削除せず、戻り先で`role="status"`、`aria-live="polite"`、44px以上の`再読み込み` buttonを表示する。buttonはProviderの`reload()`を一度だけ呼ぶ。
5. `DiscussionReadExecutor`、`DiscussionReadPlan`、Nostr transportのrelay順序、初回最大3relay、限定retry、completion reason、source relay provenance、cache契約を変更しない。
6. モデレーター申請read、評価read、編集画面のmoderator-request readを共有content readへ混ぜない。
7. 既存の単数形表記 `/discussions/[naddr]/moderator` に対する新規alias/redirectは追加しない。テストと文書は実在するcanonical route `/discussions/[naddr]/moderators` を使う。
8. 新規テストは実装前にREDとなり、fresh read-only test reviewを通過する。
9. focused test、strict TypeScript、lint、全Jest、build、`git diff --check`が成功する。

## 4. 変更対象の想定

### Test

- `src/components/discussion/__tests__/DiscussionDataProvider.test.tsx`
  - detail moderatorsの共有content read開始
  - detail editを含むscope契約
  - main→moderators→mainの同一lifecycle
  - EOSE/非EOSEのcompletionとreload callback
- `src/app/discussions/[naddr]/__tests__/page.streaming.test.tsx`
  - 既存のcontent status/reload public UI契約を維持する回帰確認
- `src/app/discussions/[naddr]/moderators/__tests__/page.test.tsx`
  - 画面固有のmoderator-request readが共有content readへ置換されていないこと

### Production

- `src/components/discussion/DiscussionDataProvider.tsx`
- `src/components/discussion/DiscussionManagementShell.tsx`
- `src/app/discussions/[naddr]/layout.tsx`

`src/app/discussions/[naddr]/page.tsx` の既存`DiscussionReadStatus`は再利用する。global/detailのpathname aliasやNostr executor本体は変更しない。

## 5. リスクと軽減策

- **直接detail moderatorsを開くとcontent readが一回増える**: tab単位ではなくdetail layout単位の共有snapshot一回に限定し、二重readがないことをテストする。画面固有の申請readとは別targetとして維持する。
- **metadata statusとcontent statusが同時に出る**: metadataは`DiscussionTabLayout`、contentはdetail pageの投稿領域という既存表示境界を維持する。新しいstatus componentは作らない。
- **古いcallbackが戻り先を汚染する**: 既存generation guardと`reload()`をscope-based lifecycleに移しても維持し、main→moderators→mainの遅延completionテストを追加する。
- **単数形routeの期待と実装routeが異なる**: canonical routeを文書・テストで明記し、alias追加は今回のdata lifecycle修正から分離する。

## 6. 憲章チェック

- `AGENTS.md` と `.specify/memory/constitution.md` を確認済み。
- TypeScript strict、UI/data/service分離、明確な命名、単純なロジックを維持する。
- 共有readの開始条件をroute文字列からscopeへ移し、detail layoutの責務を明示する。
- テスト先行で、テスト実装 → fresh test review → 本番実装 → GREENの順に進める。憲章v2.0.0に従い、本番実装後の必須subagent reviewタスクは置かない。
- statusは既存の`role="status"` / `aria-live="polite"`、buttonは既存の`min-h-[44px]`契約を使う。
- 新規仕様書は作成せず、関連仕様ディレクトリ内の`issue-100/`に本設計とタスクリストを置く。

## 7. ベースライン検証

調査時点の作業treeはcleanで、次のfocused suiteは現行契約に対して成功した。

```text
npm test -- --runInBand --runTestsByPath \
  src/components/discussion/__tests__/DiscussionDataProvider.test.tsx \
  src/app/discussions/__tests__/page.streaming.test.tsx \
  src/app/discussions/[naddr]/__tests__/page.streaming.test.tsx \
  src/app/discussions/[naddr]/moderators/__tests__/page.test.tsx
```

結果: 4 suites / 43 tests passed。detail moderatorsでcontentを読まない旧契約がGREENであるため、次のREDテストでこの契約を反転する。Reactの既存warningは出力されたが、command exit codeは0である。

既存Issue #100対応のdelivery record（PR #103、CI pass）は履歴情報として保持し、本追補の未実装計画とは混同しない。

## 8. 実装結果

本追補では、pathname whitelistによるcore content read判定を廃止し、layoutから明示する`DiscussionDataScope`へ移行した。

- `src/components/discussion/DiscussionDataProvider.tsx`
  - `DiscussionDataScope = "management" | "detail"`を追加
  - management/detailの判定をpathnameからscopeへ移行
  - detail Providerの全child routeで共有content readを開始
  - `CONTENT_PATHS`、`shouldLoadManagementContent()`、`shouldLoadDetailContent()`を削除
- `src/components/discussion/DiscussionManagementShell.tsx`
  - `scope="management"`を明示
- `src/app/discussions/[naddr]/layout.tsx`
  - `scope="detail"`を明示
- `src/components/discussion/__tests__/DiscussionDataProvider.test.tsx`
  - canonical detail moderators/editの共有read回帰
  - main→moderators→mainの一回lifecycle
  - 非EOSE時のposts/completion/reload保持
  - management fixtureの明示scope

検証結果は`tasks.md`の検証記録に固定した。通常のbuildはexit 137で終了したが、メモリ上限を指定した再実行ではexit 0となり、Next.js production buildまで完了した。`transit-config.json`不在による既存GTFS import警告は残っているが、本Issueの変更によるfailureではない。
