# Issue #87 調査記録

- Issue: [#87 chor: NEXT_PUBLIC接頭辞をやめる](https://github.com/nawashiro/kazaguruma-transit/issues/87)
- Repository: `/opt/data/kazaguruma-transit`
- 調査基準ブランチ: `dev`
- 調査基準SHA: `16f6a19ed67d954b436363590451aa2ad2611904`
- 実装ブランチ: `fix/issue-87-app-config`
- 調査日: 2026-09-03 UTC
- 作業言語: 日本語

## 1. 開始状態とIssueの状態

作業開始時のcheckoutは `fix/issue-131-vote-dom-error` だった。変更はなく、`origin` は
fetch URLが `git@github.com:nawashiro/kazaguruma-transit.git`、push URLがGitHubとTangledの
設定だった。`dev` をcheckoutしたうえで、次を実行した。

```bash
git fetch origin dev
git switch dev
git reset --hard origin/dev
git clean -fdx
```

`git clean -fdx` の対象は `.hermes/`、`.next/`、`.swc/`、`next-env.d.ts`、`node_modules/`、
`prisma/.temp/`、`tsconfig.tsbuildinfo` だった。作業開始時点でtracked変更はなかったため、
ユーザーが指定したリモート正本化による破棄対象はローカル未追跡・ignored生成物だけである。
その後 `dev` と `origin/dev` は `16f6a19` で一致し、作業ツリーはcleanになった。

Issueのライブ状態は次のとおりである。

- State: `OPEN`
- Title: `chor: NEXT_PUBLIC接頭辞をやめる`
- Labels: なし
- Assignees: なし
- Comments: 1件
- 最新コメント: 「現行実装はDockerに依存しすぎているので、なるべくNext.jsのビルドだけで実現できる方がよい。」
- 要求の要点: 公開情報を `NEXT_PUBLIC_*` 環境変数とDocker build argsへ重複記述せず、JSONのアプリ設定へ集約する。Ko-fi表示設定もアプリ設定へ移し、開発用メタデータと運営表示を分離する。

Issue対応用の既存ローカルブランチ `fix/issue-87-app-config` は `dev` より古いだけで、
`git log --left-right --cherry-pick dev...fix/issue-87-app-config` に右側固有コミットはなかった。
リモートの同名ブランチは存在しないため、現在の `dev` から同名ブランチを作り直した。

## 2. 重複作業と関連履歴

次の検索を実行した。Issue番号または症状に対応するopen PRはなかった。

```bash
gh pr list --repo nawashiro/kazaguruma-transit --search "#87" --state all
# []
gh pr list --repo nawashiro/kazaguruma-transit --search "NEXT_PUBLIC" --state all
# []
gh pr list --repo nawashiro/kazaguruma-transit --search "NEXT_PUBLIC接頭辞" --state all
# []
gh pr list --repo nawashiro/kazaguruma-transit --search "Dockerに依存" --state all
# []
```

`環境変数` の検索では既存のPR #13、#103、#104が見つかったが、いずれもIssue #87の
未実装対応ではない。#13「環境変数を改善」は2025年の旧対応であり、現在のDockerfileと
`NEXT_PUBLIC_*`構成を導入した履歴である。Issue #87の既存修正PRや、同じ公開設定集約を
扱うopen PRは確認できなかった。

関連する設計履歴は次のとおりである。

- `ec22dfd`：GAとアプリURLをDocker ARGから `.env` へ書き込む仕組みを導入した。
- `fdb306f`：管理者公開鍵、リレー、バス停会話ID、機能有効化を同じ仕組みに追加した。
- `7e2e78b`：場所データのversionを `NEXT_PUBLIC_LOCATIONS_DATA_VERSION` で指定する実装を追加した。
- `98a7df6`：`FUNDING.yml` とローカル `ko-fi-content.json` をアプリ表示へ組み込んだ。
- `9fbca04`：`transit-config.json` をGit管理から外した。
- `f92b74f`：`transit-config.json` をDocker image layerへ残さないsecret mountへ移行した。

`transit-config.json` はGTFS URLのquery parameterを含み得るため、ログのquery redactionと
Docker secret扱いが既に導入されている。したがって、クライアントへbundleされる公開
`app-config.json`へGTFS設定を混ぜない。これはIssueの「公開情報をJSONへ集約する」要求と
衝突しないためのセキュリティ境界であり、transit secretの移行は別課題とする。

## 3. 現行の設定・データフロー

### 3.1 公開設定のDocker依存

現在の公開設定は複数の層に重複している。

1. `.env.local.example` が `NEXT_PUBLIC_APP_URL`、GA、場所データversion、Nostr設定を列挙する。
2. `compose.yml` と `compose.prod.yml` が同じ値を `build.args` へ渡す。
3. `Dockerfile.dev` と `Dockerfile.prod` が各ARGを `.env` へ `RUN echo` する。
4. Next.jsが `NEXT_PUBLIC_*` をビルド時にクライアントbundleへ埋め込む。
5. source側は `process.env.NEXT_PUBLIC_*` を直接参照する。

この経路はDockerなしの `npm run build` では、Dockerfileが生成していた `.env` と同等の
設定を再現できない。公開値なのに環境変数名・Compose・Dockerfile・sourceの四箇所を
同期する必要があり、Issueの指摘どおりKISSではない。

### 3.2 現在の参照箇所

| 設定 | 現在の参照 | 問題 |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | `src/app/layout.tsx`、`src/app/sitemap.ts`、`src/utils/maps.ts`、PDF route | metadata・sitemap・fallbackが同じ公開値を環境変数から読む |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | `src/lib/analytics/useGA.ts` | クライアントbundle用にDocker ARGが必要 |
| `NEXT_PUBLIC_LOCATIONS_DATA_VERSION` | `src/utils/addressLoader.ts` 3箇所 | CDN versionの公開値が環境変数に残る |
| `NEXT_PUBLIC_DISCUSSIONS_ENABLED` | `src/lib/config/discussion-config.ts` | 公開機能フラグが環境変数に残る |
| `NEXT_PUBLIC_ADMIN_PUBKEY` | `src/lib/nostr/nostr-utils.ts`、discussion config | 公開鍵が環境変数に残る |
| `NEXT_PUBLIC_BUS_STOP_DISCUSSION_ID` | discussion config | 公開naddrが環境変数に残る |
| `NEXT_PUBLIC_DISCUSSION_LIST_NADDR` | discussion layout、management provider、creation flow | 同じ公開naddrを複数経路から読む |
| `NEXT_PUBLIC_NOSTR_RELAYS` | discussion config | 公開relay一覧が環境変数に残る |
| `NEXT_PUBLIC_NOSTR_TIMEOUT_MS` | discussion config | 公開クライアント設定と保守設定の境界が曖昧 |
| `NEXT_PUBLIC_DISCUSSION_READ_*` | discussion config | read strategyの値も環境変数に残る |
| `NEXT_PUBLIC_MODERATORS` | 未使用の `getModeratorPubkeysHex()` のみ | 既に削除されたglobal moderator設定の残骸 |

`NODE_ENV`、`GOOGLE_MAPS_API_KEY`、`PUPPETEER_EXECUTABLE_PATH`、
`CLOUDFLARE_TUNNEL_TOKEN`は公開設定ではないため、Issue #87の公開JSON移行対象にしない。
特にGoogle Maps API keyとCloudflare tokenは環境変数のまま保持する。

### 3.3 Ko-fi表示設定と開発メタデータ

`src/app/layout.tsx` はサーバー側の `loadKoFiUsername()` と `loadKoFiContent()` を呼ぶ。
現在は次の二つを別々に読む。

- `FUNDING.yml` の `ko_fi`：支援リンクの有無とユーザー名
- `ko-fi-content.json`（なければexample）：サポート欄の見出しと説明文

一方、`FUNDING.yml`、`package.json`、`/license` のlicense metadataはリポジトリの開発・
配布用情報であり、運営時のサポート表示とは責務が異なる。`FUNDING.yml`をアプリ表示の
入力にし続けると、別の福祉交通アプリへ転用したときに開発者向けメタデータと運営者向け
表示を分離できない。

## 4. 根因と仮説の判定

Issue #87は単一のruntime例外ではなく、公開設定の所有権がDockerのbuild args、`.env`、
各source、Ko-fi用の個別ファイルに分散した設計上の問題である。確認した仮説は次のとおり。

| 順位 | 仮説 | 予測 | 判定 |
|---|---|---|---|
| 1 | Dockerfileが公開設定の実質的な設定ローダーになっている | DockerなしのNext.js buildでは公開値を同じ経路で供給できない | 採用。ARGと`RUN echo`が実在する |
| 2 | `NEXT_PUBLIC_*`の直接参照がクライアント・サーバー境界を分散させている |同じ設定の読み取りと既定値が複数ファイルに散在する | 採用。上表のsource参照で確認 |
| 3 | Ko-fiの支援表示が開発用metadataへ結合している | `FUNDING.yml`の変更が運営表示の有無と表示先を同時に変える | 採用。`loadKoFiUsername()`がFUNDINGを直接読む |
| 4 | `transit-config.json`も公開JSONに移せる | client bundleへ混ぜてもsecret境界が変わらない | 棄却。query parameterを含み得るsecretでDocker secret扱いの履歴がある |

## 5. 実装境界の提案

公開情報をルートの `app-config.json` に集約し、`src/lib/config/app-config.ts` を唯一の
型・検証・読み取り境界にする。JSONはNext.js/TypeScriptの静的importでクライアントと
サーバーの双方から利用し、Docker build argsや生成 `.env` を不要にする。

`app-config.json` に持つのは次の公開設定である。

- `appUrl`
- `gaMeasurementId`
- `locationsDataVersion`
- `discussion`（enabled、admin公開鍵、2種類の公開naddr、relay一覧、timeout、read strategy）
- `support`（enabled、Ko-fiユーザー名、見出し、説明文）

`FUNDING.yml`、`package.json`、`/license`は開発・配布用metadataとして残すが、アプリの
Ko-fi表示入力から外す。`ko-fi-content.json.example`と`parseKoFiUsername()`は不要になる
ため削除し、表示loaderのexport名は既存呼び出しとテストを保ちつつapp configを読む。

`transit-config.json`、`GOOGLE_MAPS_API_KEY`、Puppeteer設定、Cloudflare tokenは別の
server/deployment設定として残す。Docker secret mountは維持し、公開設定だけをDocker
から切り離す。

### 実装対象の主なファイル

- 追加: `app-config.json`、`src/lib/config/app-config.ts` とそのテスト
- 更新: `src/lib/config/discussion-config.ts`、`src/lib/config/ko-fi-funding.ts`、
  `src/lib/nostr/nostr-utils.ts`、`src/utils/addressLoader.ts`、`src/utils/maps.ts`、
  `src/lib/analytics/useGA.ts`、`src/app/layout.tsx`、`src/app/sitemap.ts`、
  `src/app/discussions/layout.tsx`、`src/lib/discussion/user-creation-flow.ts`、
  `src/components/discussion/DiscussionManagementProvider.tsx`、Docker/Compose、README、
  analytics manual、関連テスト
- 削除: `ko-fi-content.json.example`、`parseKoFiUsername()`とその専用テスト

### 非対象

- GTFS設定のsecret mountとデータ形式
- Google Maps API key、Cloudflare token、Puppeteer環境変数
- `FUNDING.yml`・`package.json`のGitHub/npm metadata自体
- Nostr protocol、relay通信、認証、Prisma/SQLite、UI構造
- 過去の `specs/` に保存された履歴上の `NEXT_PUBLIC_*` 記述

## 6. 基準検証

依存関係を再構築後、Node.js 22.23.2で既存の設定関連テストを実行した。

```bash
PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npm install
PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npm test -- --runInBand --runTestsByPath \
  src/lib/config/__tests__/discussion-config.test.ts \
  src/lib/config/__tests__/ko-fi-config.test.ts \
  __tests__/ko-fi-content-config.test.ts \
  __tests__/docker-secret-handling.test.ts
```

結果は `4 suites passed / 20 tests passed`。これは現行の環境変数・FUNDING・Ko-fi example・
Docker secret契約が基準ブランチで成立していることを示すが、Issue #87の新しいJSON設定を
検証するものではない。実装では同じ設定値をapp configから読む回帰テストを先に追加する。

## 7. 調査結論

Issue #87の根因は、公開設定をNext.jsが直接bundleできる単一JSONではなく、Docker ARGから
`.env`を生成する経路と、複数の個別ファイルへ分散していることである。公開設定を
`app-config.json`へ集約し、source側の読み取りを型付きモジュールへ一本化する。ただし、
`transit-config.json`は既存のsecret boundaryを守るため公開JSONへ含めない。この分離が、
IssueのKISS要求と既存のsecret-handling保証を同時に満たす最小の実装境界である。

この文書作成時点では、アプリケーションsource・テスト・Docker設定はまだ変更していない。

## 8. 実装後の確認

- `app-config.json`と`src/lib/config/app-config.ts`を追加し、公開URL、GA、locations version、discussion、supportを型付き・実行時検証付きで提供した。
- active production sourceの`NEXT_PUBLIC_*`参照は0件になった。Dockerfile、Compose、`.env.local.example`、README、analytics manualにも残していない。
- `FUNDING.yml`はGitHub metadataとして残し、Ko-fi表示は`appConfig.support`だけを読むようにした。`ko-fi-content.json.example`と`parseKoFiUsername()`は削除した。
- `transit-config.json`、Google Maps API key、Cloudflare token、Puppeteer設定は公開JSONへ含めず、既存のDocker secret/server環境変数境界を維持した。
- discussion設定、listing request、management provider、URL、analytics、locations loaderはapp configへ切り替えた。

## 9. TDDと検証結果

- T005の旧状態RED: 2 suites / 9 tests failed。失敗は`app-config.json`・`app-config.ts`欠如と、active source/Docker/Composeの旧公開設定参照であり、collection/setup typoではなかった。
- T007後のapp config focused: 1 suite / 6 tests passed。
- consumer・Ko-fi・Docker focused: 10 suites / 87 tests passed。
- 全Jest: 146 suites passed、2 skipped、904 tests passed、13 skipped。
- strict TypeScript: `npx tsc --noEmit --incremental false` exit 0。
- lint: `npm run lint` exit 0。表示された`any`、`<img>`、hook依存、`next lint` deprecated等は既存warningで、今回の差分由来のerrorはない。
- production build: `NODE_OPTIONS=--max-old-space-size=1536 NEXT_TELEMETRY_DISABLED=1 npm run build` exit 0。Next.js 15.5.20で27ページを生成した。`transit-config.json`不在によるGTFS import設定エラー表示は既存環境要因として分離した。
- `git diff --check`: exit 0。active source・設定例の`NEXT_PUBLIC_`検索は0件。`app-config.json`はJSONとしてparseでき、禁止したsecret fieldは0件だった。

TDDのtest writer・production writerは複数回委任したが、サブエージェント側の最終応答待ちで中断され、許可pathへの部分変更はなかった。親が同じhard write boundaryでテストRED、production実装、focused/full検証を再実施した。fresh reviewerの完全な`VERDICT: PASS`自己申告は取得できていないため、それを成功根拠としては扱わず、親の現行bytes・実測コマンド・diff checkを証拠とする。

外部Nostr relayへのpublish、実GA送信、Google Maps API呼び出し、Ko-fi iframe操作は行っていない。
