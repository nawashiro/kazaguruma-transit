# Tasks

## 1. データベースの自前用意

- [x] 1.1 `createPrismaClient` が `:memory:` 以外の接続先の親ディレクトリを再帰的に作る。検証: `src/lib/db/__tests__/create-prisma-client.test.ts`。
- [x] 1.2 `globalSetup` が DB ファイル不在時に `prisma db push`（`--config prisma.config.ts`）でスキーマを適用する。`transit-config.json` 無し・sqlitePath 不正のときは失敗する。既存 DB ファイルは作らない・push は行わない。

## 2. 新状態の確認

- [x] 2.1 `prisma/.temp` を退避した fresh 相当で `npm run test:server:ci`（3スイート緑）と `npm run test:unit:ci`（187スイート・1538テスト・1 skip）を確認する。
