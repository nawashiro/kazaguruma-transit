# Issue #87 公開アプリ設定集約 仕様

- Issue: [#87 chor: NEXT_PUBLIC接頭辞をやめる](https://github.com/nawashiro/kazaguruma-transit/issues/87)
- 作成日: 2026-09-03 UTC
- 基準: `dev` / `16f6a19ed67d954b436363590451aa2ad2611904`

## 背景

公開情報が多数の `NEXT_PUBLIC_*` 環境変数、Composeのbuild args、Dockerfileが生成する`.env`、
個別のKo-fi設定ファイルへ分散している。公開情報はアプリ設定として管理し、Dockerを経由しない
Next.jsのbuildでも同じ設定を使えるようにする。GitHubの開発・配布用metadataと、アプリ利用者に
見せる運営上の支援表示は別の責務として扱う。

## User Scenarios

### US1 (P1): 公開アプリ設定を一箇所で管理する

開発者または運用者として、公開URL、Google Analytics、場所データのversion、会話機能の公開設定を
一つのJSONファイルで編集したい。そうすれば、Dockerのbuild argsや複数の環境変数を同期せずに、
設定を変更してアプリをbuildできる。

**独立テスト:** JSONの値を読み込む設定検証と、公開設定の参照元を確認する静的テストを実行し、
`NEXT_PUBLIC_*`またはそれを生成するDocker設定なしで設定値が各機能へ渡ることを確認する。

### US2 (P1): 運営者向け支援表示をアプリ設定で変更する

運営者として、支援欄の表示可否、見出し、説明文、Ko-fiの支援先をアプリ設定で変更したい。
そうすれば、`FUNDING.yml`やnpm metadataを変更せず、別の福祉交通アプリへ転用できる。

**独立テスト:** 設定した支援表示がサイドバーと本文の支援欄へ反映され、無効化時には両方が表示
されないことを、外部送信なしのコンポーネントテストで確認する。

### US3 (P1): 非公開のサーバー設定を公開設定から隔離する

運用者として、GTFS設定やGoogle Maps API keyなどの秘密情報をブラウザへ公開せずに、従来どおり
build/startを実行したい。そうすれば、公開設定の簡素化によって既存のsecret-handlingを壊さない。

**独立テスト:** Docker secret契約とサーバー専用環境変数のテストを維持し、公開アプリ設定へ
GTFS設定やAPI keyが含まれていないことを確認する。

## Functional Requirements

- **FR-001:** 公開URL、GA測定ID、場所データversion、会話設定、支援表示設定を、配布先ごとのGit管理しない
  `app-config.json`で定義できなければならない。Git管理する`app-config.json.example`を標準テンプレートとする。
- **FR-002:** アプリケーションの公開設定読み取りは、`NEXT_PUBLIC_*`環境変数を参照してはならない。
- **FR-003:** DockerfileとComposeは、公開設定をbuild argsまたは生成`.env`で注入してはならない。
- **FR-004:** `app-config.json`はTypeScriptの型と実行時検証を持ち、必須値の欠落や型不正をbuild/testで
  判別できなければならない。実設定が無いCI・初回環境ではexampleから生成する。
- **FR-005:** `npm run build`はDocker固有の公開設定注入なしに、準備処理で用意された`app-config.json`の値を使用して完了
  できなければならない。GTFS用の既存secretはこの要件の対象外とする。
- **FR-006:** Ko-fiのユーザー名、支援欄の見出し、説明文、表示可否は`app-config.json`から読み取り、
  `FUNDING.yml`および`ko-fi-content.json`を実行時入力にしてはならない。
- **FR-007:** `FUNDING.yml`、`package.json`、`/license`の開発・配布用metadataは、その責務を保ったまま
  アプリ運営表示から分離しなければならない。
- **FR-008:** `transit-config.json`、`GOOGLE_MAPS_API_KEY`、`PUPPETEER_EXECUTABLE_PATH`、
  `CLOUDFLARE_TUNNEL_TOKEN`は公開JSONへ移さず、既存のサーバー・secret境界を維持しなければならない。
- **FR-009:** 旧`NEXT_PUBLIC_*`名を読む後方互換fallbackは追加してはならない。
- **FR-010:** 設定移行に伴うエラーは、開発者が原因を特定できる日本語メッセージを返さなければならない。
- **TEMPLATE:** `app-config.json.example`はtracked template、`app-config.json`はgitignored deployment overrideとする。
  `scripts/ensure-app-config.mjs`がoverrideの不在時だけtemplateをコピーし、npm lifecycle、CI、Docker buildで利用する。
## Non-Goals

- GTFS設定のsecret mount方式、GTFSデータ形式、Prisma/SQLiteを変更すること。
- Google Maps API key、Cloudflare token、Puppeteerのserver-only環境変数をJSONへ移すこと。
- `FUNDING.yml`、`package.json`、`/license`のmetadata自体を削除または再設計すること。
- Nostr protocol、認証、relay通信、UI構造、既存の支援リンク形式を変更すること。
- 過去の`specs/`に保存された履歴上の`NEXT_PUBLIC_*`文字列を改稿すること。

## Assumptions

- `app-config.json.example`は公開情報だけを含むtracked templateとし、配布先ごとの`app-config.json`はgitignoreする。
  `app-config.json`が無いCI・初回環境では準備処理がexampleから生成し、既存の配布先設定は上書きしない。
- 初期値は現在の`FUNDING.yml`と`ko-fi-content.json.example`の表示内容、既存のdiscussion既定relay、
  場所データversion `1.0.0`、ローカルURLを移行する。
- `transit-config.json`がない環境でGTFS importが既存どおり警告を出して継続する挙動は、今回の変更で
  成功条件を変えない。

## Success Criteria

- **SC-001:** 公開設定の変更箇所が`app-config.json.example`（既定template）と配布先の`app-config.json`（ignored override）、
  型検証モジュールに集約され、現行の公開設定に対するsource・Docker・Composeの`NEXT_PUBLIC_*`直接参照が0件になる。
- **SC-002:** Dockerを使わず、公開設定用環境変数を指定しない`npm run build`が、準備処理でexampleからignored configを
  生成したうえで終了コード0になり、Next.jsのproduction buildまで完了する（GTFS設定不足など既存ログは別分類する）。
- **SC-003:** 支援設定を変更または無効化したとき、サイドバーと本文の表示が同じJSON設定に従い、
  `FUNDING.yml`の変更なしに結果を再現できる。
- **SC-004:** 公開JSON、client bundle、実行時の公開設定にGTFS設定・Google Maps API key・Cloudflare tokenが
  含まれず、既存Docker secret契約のテストが通る。
- **SC-005:** focused Jest、全Jest、strict TypeScript、lint、build、`git diff --check`が実測され、
  差分由来の失敗が残らない。
