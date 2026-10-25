# 技術スタック

## 実行環境

- Next.js 15のApp Routerを使う。
- Tailwind CSS 4とDaisyUI 5でUIを構成する。
- Jest、React Testing Library、Jestのjsdom環境でテストする。
- `@nostr-dev-kit/ndk`と`nosskey-sdk`をNostr関連機能で使う。

## データと設定

- キャッシュにPrisma ORMとSQLiteを使う。保存先は`transit-config.json`の`sqlitePath`で指定する。起動ごとに再生成し、APIレート制限のカウンターもリセットする。
- `prisma/schema.prisma`はGTFSと、APIのRateLimitを定義する。
- Quality Gateはチェックアウト内で`app-config.json.example`を`app-config.json`へ一時コピーし、テストに使う。

## よく使うスクリプト

| 目的             | コマンド                | 実行内容                                                                       |
| ---------------- | ----------------------- | ------------------------------------------------------------------------------ |
| 開発             | `npm run dev`           | Prisma Clientを生成し、交通DBを再生成・検証してからTurbopackの開発サーバーを起動する。                     |
| 本番ビルド       | `npm run build`         | Prisma Clientを生成し、Next.jsをビルドする。交通DBの変更やGTFS取得は行わない。 |
| 静的検査         | `npm run lint`          | Next.jsのLintを実行する。                                                      |
| Jest             | `npm test`              | Jestを実行する。                                                               |
| アクセシビリティ | `npm run accessibility` | アクセシビリティ監査を実行する。                                               |

## 参考スクリプト

| 目的       | コマンド                                                                     | 実行内容                                         |
| ---------- | ---------------------------------------------------------------------------- | ------------------------------------------------ |
| 本番起動   | `npm start`                                                                  | 交通DBを再生成・検証してからNext.jsを起動する。              |
| Jest監視   | `npm run test:watch`                                                         | Jestを監視モードで実行する。                     |
| 厳格な監査 | `npm run accessibility:strict`                                               | 監査違反を失敗として扱う。                       |
| CI監査     | `npm run accessibility:ci`                                                   | 開発サーバーを起動して厳格な監査を実行する。     |
| Prisma     | `npm run prisma:generate`、`npm run prisma:migrate`、`npm run prisma:studio` | Client生成、マイグレーション、Studioを実行する。 |
| GTFS取込   | `npm run import-gtfs`                                                        | 停止中の交通DBを破棄し、スキーマ作成・GTFS取込・検証を実行する。             |

## 生成物

- GTFS取込は`sqlitePath`のDBを破棄して作成する。既定の設定例は`prisma/.temp/data.db`を使う。
- アクセシビリティ監査は`artifacts/lighthouse/`へレポートを出力する。
- 生成物を正本として直接編集しない。入力設定と生成スクリプトを変更する。

## Quality Gate

`.github/workflows/quality-gate.yml`は`master`へのpush、`master`を対象とするPull Request、手動実行で動く。
