# 技術スタック

## 実行環境

- `package.json`とDockerfileはNode.js 22.xを指定する。Quality GateもNode.js 22.xを使う。
- TypeScript 5をstrict設定で使う。
- Next.js 15のApp RouterとReact 19を使う。
- Tailwind CSS 4とDaisyUI 5でUIを構成する。
- Jest、React Testing Library、Jestのjsdom環境でテストする。
- `puppeteer`でブラウザーを操作し、`@googlemaps/google-maps-services-js`で地図サービスを呼び出す。
- `@nostr-dev-kit/ndk`と`nosskey-sdk`をNostr関連機能で使う。

## データと設定

- Prisma ORMとSQLiteを使う。データベースのURLは`prisma/.temp/data.db`である。
- `prisma/schema.prisma`はGTFSのAgency、Route、Stop、Trip、Calendar、CalendarDate、StopTimeと、APIのRateLimitを定義する。
- `gtfs`と`scripts/import-gtfs.ts`でGTFSデータをSQLiteへ取り込む。
- `app-config.json.example`は配布先固有の公開設定のテンプレートである。実際の`app-config.json`はGit管理せず、`scripts/ensure-app-config.mjs`は存在だけを確認する。
- Quality Gateはチェックアウト内で`app-config.json.example`を`app-config.json`へ一時コピーする。
- `transit-config.json.example`はGTFS取込設定の形を示す。実際の`transit-config.json`はサーバー側で読み込み、Git管理しない。

## 主要スクリプト

| 目的 | コマンド | 実行内容 |
| --- | --- | --- |
| 開発 | `npm run dev` | Prisma Clientを生成し、Turbopackの開発サーバーを起動する。 |
| 本番ビルド | `npm run build` | Prisma Clientを生成し、スキーマを反映し、GTFSを取り込み、Next.jsをビルドする。 |
| 本番起動 | `npm start` | Prisma ClientとSQLiteを準備し、GTFSを取り込み、Next.jsを起動する。 |
| 静的検査 | `npm run lint` | Next.jsのLintを実行する。 |
| Jest | `npm test` | Jestを実行する。 |
| Jest監視 | `npm run test:watch` | Jestを監視モードで実行する。 |
| アクセシビリティ | `npm run accessibility` | アクセシビリティ監査を実行する。 |
| 厳格な監査 | `npm run accessibility:strict` | 監査違反を失敗として扱う。 |
| CI監査 | `npm run accessibility:ci` | 開発サーバーを起動して厳格な監査を実行する。 |
| Prisma | `npm run prisma:generate`、`npm run prisma:migrate`、`npm run prisma:studio` | Client生成、マイグレーション、Studioを実行する。 |
| GTFS取込 | `npm run import-gtfs` | `scripts/import-gtfs.ts`を実行する。 |
| 依存境界 | `npm run check:no-nostr-tools` | `nostr-tools`を宣言していないことを確認する。 |

## 生成物

- `npm run prebuild`は外部の場所データを検証し、`public/generated/location-data.json`を生成する。
- Prismaは`node_modules/.prisma/client`へClientを生成する。
- GTFS取込は`prisma/.temp/data.db`を作成または更新する。
- Next.jsは`.next/`へ本番ビルドを出力する。
- `webpack-license-plugin`は依存ライセンス一覧を`../public/licenses/dependencies.json`として出力する。実行時loaderは`.next/server/public/licenses/dependencies.json`、`.next/public/licenses/dependencies.json`、`public/licenses/dependencies.json`を読む。
- アクセシビリティ監査は`artifacts/lighthouse/`へレポートを出力する。
- 生成物を正本として直接編集しない。入力設定と生成スクリプトを変更する。

## Dockerと秘密情報の境界

- `compose.yml`は`Dockerfile.dev`と`.env.local`を使い、`transit-config.json`を読み取り専用でコンテナへマウントする。
- `compose.prod.yml`は`Dockerfile.prod`と`.env`を使い、`cloudflared`へ`CLOUDFLARE_TUNNEL_TOKEN`を渡す。
- 両DockerfileはBuildKit secretの`transit_config`を`/app/transit-config.json`へマウントしてビルドする。
- `GOOGLE_MAPS_API_KEY`はサーバー側の環境変数として扱う。`transit-config.json`、`.env.local`、`.env`、`CLOUDFLARE_TUNNEL_TOKEN`、`GOOGLE_MAPS_API_KEY`の実値を文書、Git、公開設定へ書かない。
- `PUPPETEER_EXECUTABLE_PATH`は必要な実行環境だけで指定する。認証情報として扱わない。
- `app-config.json`は公開設定だが、配布先ごとの値を含むためGitへ保存しない。

## Quality Gate

`.github/workflows/quality-gate.yml`は`dev`と`master`へのpush、Pull Request、手動実行で動く。

1. Node.js 22.xを設定する。
2. `app-config.json.example`を一時コピーする。
3. `npm ci`を実行する。
4. `npm run lint`を実行する。
5. `npx tsc --noEmit --incremental false`を実行する。
6. `npm run build`を実行する。
7. 3100番ポートでNext.js本番サーバーを起動する。
8. `npm test -- --runInBand --ci`を実行する。
9. 終了時に本番サーバーを停止する。

Quality Gateはこのworkflowに書かれたコマンドだけを自動実行する。アクセシビリティ監査やDocker ComposeはQuality Gateの手順に含まれない。
