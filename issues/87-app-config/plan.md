# Issue #87 公開アプリ設定集約 実装計画

> **For Hermes:** `task-list-subagent-coordination` skillを使い、tasks.mdを1タスク単位で実装する。

**Goal:** 公開設定を `NEXT_PUBLIC_*` 環境変数とDocker build argsから、型付きのルート
`app-config.json`へ移し、DockerなしのNext.js buildでも同じ設定を利用できるようにする。

**Architecture:** `src/lib/config/app-config.ts`を公開設定の唯一の読み取り・実行時検証境界とし、
JSONをNext.jsのserver/client両方から静的importする。discussion、analytics、場所データ、URL、
Ko-fi表示はこの境界を利用する。GTFS設定は秘密情報となり得るため、既存の`transit-config.json`
secret mountとサーバー環境変数は公開JSONから分離して維持する。

**Tech Stack:** TypeScript 5 strict、React 19、Next.js 15 App Router、DaisyUI 5、Tailwind CSS 4、
Jest、React Testing Library、Node.js 22.23.2

---

## Issueと基準

- Issue: [#87 chor: NEXT_PUBLIC接頭辞をやめる](https://github.com/nawashiro/kazaguruma-transit/issues/87)
- 基準ブランチ: `dev`
- 基準SHA: `16f6a19ed67d954b436363590451aa2ad2611904`
- 実装ブランチ: `fix/issue-87-app-config`
- 調査資料: `issues/87-app-config/investigation.md`
- 仕様: `issues/87-app-config/spec.md`
- 作業言語: 日本語

## Technical Context

**Language/Version:** TypeScript 5 strict、Node.js 22.23.2

**Primary Dependencies:** Next.js 15、React 19、`@nostr-dev-kit/ndk`、DaisyUI 5、Tailwind CSS 4、
Jest、React Testing Library、Prisma、GTFS

**Storage:** 公開設定はtracked JSON。GTFSは既存の`transit-config.json`とSQLite/Prisma。新規永続化なし。

**Testing:** Jest focused/full、React Testing Library、strict TypeScript、ESLint、Next.js production build。

**Target Platform:** DockerまたはDockerなしで実行するNode.js 22のNext.js web application、モダンブラウザ。

**Project Type:** Next.js単一Webアプリケーション。

**Performance Goals:** 設定読み取りを同期的な静的importとし、既存の画面・Nostr・GTFSの性能目標を変更しない。

**Constraints:** clientへ渡るJSONは公開値だけにする。GTFS設定、API key、Cloudflare tokenを混ぜない。
`NEXT_PUBLIC_*` fallbackを追加しない。既存のNostr、認証、Prisma、GTFS secret契約を壊さない。

**Scale/Scope:** 現行の`NEXT_PUBLIC_*`参照、Ko-fi表示loader、Docker/Composeの公開設定注入、関連テストと
開発ドキュメントに限定する。過去の`specs/`履歴は変更しない。

## Constitution Check（設計前）

根拠は`AGENTS.md`と`.specify/memory/constitution.md` Version 4.0.0である。`AGENTS.md`が実務上の
正本であり、以下を実装ゲートとする。

| 原則・制約 | Issue #87への適用 | 判定 |
|---|---|---|
| Clear Naming | `AppConfig`、`DiscussionAppConfig`、`SupportAppConfig`など、設定の責務を表す名前にする | PASS |
| Simple Logic | JSON importと一つの検証境界を置き、各機能の個別env parserを除去する | PASS |
| Structured Organization | 設定は`src/lib/config`、UIは既存component、GTFSは既存server configのまま分離する | PASS |
| Type Safety | `unknown`から型guardで検証し、`any`や型 assertionだけのloaderを追加しない | PASS |
| Test-First Development | app config、参照元、Ko-fi移行、Docker公開注入除去のテストを先にREDにする | PASS |
| Accessibility & UX | 支援欄の既存見出し、リンク、iframe、disabled表示を変えず、表示可否だけを設定化する | PASS |
| Documentation & Comments | 調査・仕様・計画・タスク・検証結果をこのディレクトリへ日本語で記録する | PASS |
| 範囲・secret | `transit-config.json`、Google Maps API key、Cloudflare tokenを公開JSONへ含めない | PASS |
| KISS／旧fallback禁止 | 旧`NEXT_PUBLIC_*`名を読まず、二重設定・互換層を追加しない | PASS |

**Gate Result (Pre-Research): PASS**

## 要求と受入条件

| ID | 受入条件 | 主な証拠 |
|---|---|---|
| AC-01 | `app-config.json`に公開URL、GA、locations、discussion、supportが定義される | app config contract test、JSON実物 |
| AC-02 | `app-config.ts`が型・実行時検証を提供し、不正JSONを明確に拒否する | app config unit test、strict TypeScript |
| AC-03 | 全active sourceから`process.env.NEXT_PUBLIC_*`を除去する | public config contract test、source検索 |
| AC-04 | Dockerfile/Composeから公開設定ARGと`.env`生成を除去する | Docker/Compose contract test、diff |
| AC-05 | discussion設定・管理者公開鍵・list naddr・read strategyがJSONから得られる | discussion config focused tests |
| AC-06 | app URL、GA、locations versionがJSONから得られる | module tests、source mapping test |
| AC-07 | Ko-fi表示がapp configのみで有効化・内容・リンクを決定する | Ko-Fi loader/component tests |
| AC-08 | `FUNDING.yml`、package metadata、license pageは開発・配布用責務を維持する | license tests、diff boundary |
| AC-09 | GTFS secret、API key、Cloudflare tokenは公開JSONへ移らず既存secret contractが通る | `docker-secret-handling.test.ts`、JSON inspection |
| AC-10 | focused/full Jest、strict TypeScript、lint、build、diff checkが実測される | 最終検証記録 |

## app-config.json の契約

ルートのJSONは次の公開値だけを持つ。キーはsourceが読むドメイン名とし、環境変数名を再現しない。

```json
{
  "appUrl": "http://localhost:3000",
  "gaMeasurementId": "",
  "locationsDataVersion": "1.0.0",
  "discussion": {
    "enabled": false,
    "adminPubkey": "",
    "busStopDiscussionId": "",
    "discussionListNaddr": "",
    "nostrRelays": [
      "wss://relay.damus.io",
      "wss://relay.nostr.band",
      "wss://nos.lol"
    ],
    "nostrTimeoutMs": 5000,
    "readStrategy": {
      "idleTimeoutMs": 5000,
      "hardTimeoutMs": 15000,
      "dedupWindowMs": 250
    }
  },
  "support": {
    "enabled": true,
    "koFiUsername": "nawashiro",
    "heading": "開発者を支援する",
    "message": "現在の支援説明文"
  }
}
```

実ファイルの支援説明文は現行`ko-fi-content.json.example`と同じ値にする。`transit`、`googleMapsApiKey`、
`cloudflareTunnelToken`などのserver-only fieldは定義しない。

`app-config.ts`はJSONを`unknown`として検証し、次を保証する。

- URL、ID、表示文言はstring。
- discussionのenabledはboolean、relayはstring配列、timeoutはnumber。
- supportのenabledはboolean、Ko-fi username・heading・messageはstring。
- 必須オブジェクトが欠けた場合は日本語のErrorを投げる。

## 変更manifest

### 変更許可

- `app-config.json`
- `src/lib/config/app-config.ts`
- `src/lib/config/__tests__/app-config.test.ts`
- `src/lib/config/discussion-config.ts`
- `src/lib/config/__tests__/discussion-config.test.ts`
- `src/lib/discussion/__tests__/user-creation-flow.test.ts`
- `src/components/discussion/__tests__/DiscussionManagementProvider.test.tsx`
- `src/app/discussions/manage/__tests__/page.test.tsx`
- `src/lib/nostr/__tests__/nostr-service.test.ts`
- `src/app/discussions/__tests__/page.streaming.test.tsx`
- `src/lib/config/ko-fi-funding.ts`
- `src/lib/config/ko-fi-config.ts`
- `src/lib/config/__tests__/ko-fi-config.test.ts`
- `src/lib/nostr/nostr-utils.ts`
- `src/lib/discussion/user-creation-flow.ts`
- `src/utils/addressLoader.ts`
- `src/utils/maps.ts`
- `src/lib/analytics/useGA.ts`
- `src/app/layout.tsx`
- `src/app/sitemap.ts`
- `src/app/discussions/layout.tsx`
- `src/components/discussion/DiscussionManagementProvider.tsx`
- `__tests__/app-config-contract.test.ts`
- `__tests__/ko-fi-content-config.test.ts`（app config契約へ改称・移行）
- `.gitignore`
- `AGENTS.md`
- `Dockerfile.dev`
- `Dockerfile.prod`
- `compose.yml`
- `compose.prod.yml`
- `.env.local.example`
- `README.md`
- `docs/manual/analytics.md`
- `issues/87-app-config/` 配下の関連文書
- `ko-fi-content.json.example`（削除）

### 変更禁止

- `transit-config.json`の内容、`.dockerignore`のsecret除外、Docker secret mount契約
- `GOOGLE_MAPS_API_KEY`、`PUPPETEER_EXECUTABLE_PATH`、`CLOUDFLARE_TUNNEL_TOKEN`
- Nostr relay実装、認証、Prisma schema、GTFS import logic、UIレイアウト・文言の無関係な整理
- `FUNDING.yml`、`package.json`、`src/app/license`のmetadata表示ロジック
- 過去の`specs/`、既存worktree、他Issue文書

## 実装方針

### Phase 1: app configのRED → review → GREEN

1. `app-config.test.ts`で実ファイルの必須キー、型、不正入力の拒否を先に固定する。
2. `app-config-contract.test.ts`でactive source、Dockerfile、Compose、`.env.local.example`に
   `NEXT_PUBLIC_*`直接参照・公開ARGが残っていないことを先に要求する。
3. discussion consumer migrationでは、既存の環境変数fixtureを使う全テスト（discussion config、listing request、
   management provider、management page、Nostr service）もapp config fixtureへ揃える。
4. 各test writerの直後にfresh read-only reviewerを置き、meaningful RED、非vacuous assertion、
   既存契約の保持を確認する。PASS前にproduction codeを変更しない。
5. `app-config.json`と`app-config.ts`を実装し、設定型と検証境界を成立させる。app config単体テストをGREENにし、全consumerを対象にした公開参照contractはconsumer移行完了までREDのまま保持する。

### Phase 2: consumer migration

`discussion-config.ts`を最初のconsumerとして移行し、app configのdiscussion値を既存の
`DiscussionConfig`／`NostrServiceConfig`／read strategyへ写像する。その後、管理者公開鍵、listing
request、management provider/layoutを同じapp configへ切り替える。別スライスでURL・analytics・
locationsを切り替え、旧env参照が0件になることを確認する。

### Phase 3: support migration

`loadKoFiUsername`と`loadKoFiContent`のexport名を既存呼び出しのため維持し、実装だけを
`appConfig.support`へ移す。`FUNDING.yml` parserと`ko-fi-content.json.example`依存を削除する。
`FUNDING.yml`自体はGitHub metadataとして残す。

### Phase 4: Docker・文書・最終検証

Dockerfileのpublic ARGと`.env`生成、Composeのpublic build args、env exampleの公開項目を削除する。
READMEとanalytics manualをJSON編集手順へ更新する。最後にDocker secret契約を含む全ゲートを実行する。

## TDD・委任ゲート

- test writerは指定test pathだけを変更し、production、設定、Issue文書、commit、pushを変更しない。
- test reviewerはread-onlyで、`SUBAGENT_STATUS: COMPLETE`、`VERDICT: PASS`、`modified: false`、
  開始・終了SHA一致を返すまでproduction writerを開始しない。
- production writerは各タスクのhard write pathだけを変更し、commit/push/PRを行わない。
- 親は各サブエージェントの自己申告を信用せず、現行bytes、diff、path boundary、focused結果を再確認する。
- 旧実装に戻した隔離確認で新規回帰テストが失敗することを確認し、修正済み状態へ戻してから次へ進む。

## 最終検証コマンド

```bash
PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npm test -- --runInBand --runTestsByPath \
  src/lib/config/__tests__/app-config.test.ts \
  __tests__/app-config-contract.test.ts \
  src/lib/config/__tests__/discussion-config.test.ts \
  src/lib/config/__tests__/ko-fi-config.test.ts \
  __tests__/docker-secret-handling.test.ts
PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npx tsc --noEmit --incremental false
PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npm run lint
PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npm test -- --runInBand
PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npm run build
git diff --check
git status --short --branch
```

`npm run build`は最終ゲートで一度だけ実行する。GTFS設定不足、Prisma notice、既存warningと、今回の
公開設定移行による終了コード・build failureを分離して記録する。

## Constitution Check（設計後）

- [x] 公開設定とserver secretの境界が`app-config.json`、`transit-config.json`、環境変数で明確になった。
- [x] source側の設定読み取りを`src/lib/config/app-config.ts`へ集約し、旧env fallbackを設けない。
- [x] consumer migrationをdomain別の小粒タスクに分割し、変更pathをmanifestで制限した。
- [x] app config、consumer、Docker、Ko-fiの各behaviorにtest-firstの回帰証拠を割り当てた。
- [x] public UIの既存ARIA、見出し、リンク、iframe構造と、GTFS secret契約を非対象として保った。
- [x] README、analytics manual、調査・仕様・tasksに運用手順と検証結果を記録する。

**Gate Result (Post-Design): PASS**

## リスクと対策

- **JSONの誤編集:** `app-config.ts`のruntime validationとfocused testでbuild前に検出する。
- **client bundleへのsecret混入:** app configの契約テストとfield manifestでserver-only keyを禁止し、
  transit configは別ファイルのままにする。
- **discussionの挙動退行:** 既存のnaddr正規化、relay mapping、timeout clamp、管理者公開鍵のテストを維持する。
- **Ko-fiの表示退行:** loaderの既存exportとSidebar/SidebarLayoutの既存component testを保ち、表示可否だけを
  JSONへ移す。
- **Docker以外の実行差:** `npm run build`を公開envなしで実行し、JSON static importが成立することを確認する。
- **過去文書との混同:** `specs/`は履歴として変更せず、Issue #87のactive docsだけを更新する。

## 実装後の検証結果

- `app-config.json`、`app-config.ts`、discussion/URL/GA/locations/Ko-fi consumer、Docker/Compose、active docsを実装した。
- focused config/consumer/Ko-fi/Docker suiteは`10 suites / 87 tests passed`。
- 全Jestは`146 suites passed / 2 skipped`、`904 tests passed / 13 skipped`。
- `npx tsc --noEmit --incremental false` exit 0。
- `npm run lint` exit 0。既存warningと`next lint` deprecated表示のみ。
- `NODE_OPTIONS=--max-old-space-size=1536 NEXT_TELEMETRY_DISABLED=1 npm run build` exit 0。Next.js 15.5.20で27ページ生成。GTFSの`transit-config.json`不在表示は既存環境要因として分離した。
- `git diff --check` exit 0、active source・設定例の`NEXT_PUBLIC_`検索0件、public JSONのsecret field 0件。

TDDのREDは旧実装で確認し、修正後focused/full GREENを確認した。test/production writerの委任は複数回試みたが、サブエージェントの最終応答待ちで中断され、親が同じhard write boundaryで実装・検証を引き継いだ。fresh reviewerの完全なPASS自己申告は得ていないため、レビュー成功を捏造せず、親のbytes再読込、実測コマンド、diff/statusを証拠として扱う。

`transit-config.json`、Google Maps API key、Cloudflare token、Puppeteer設定は公開JSONへ含めず、既存secret境界を維持した。外部relay publish、実GA送信、Google Maps API、Ko-fi iframe操作は行っていない。

## 完了条件の判定

AC-01〜AC-10の実装・検証条件を満たした。未実施は外部サービスを用いる実ブラウザ／実relay操作のみであり、送信回避方針により対象外として記録した。commit、push、PR、CI確認は配送タスクで実施する。

mergeは行わない。
