# Proposal

## Why

server プロジェクトのテストは、`transit-config.json` の `sqlitePath` が指すデータベースが手元に残っていることに暗黙に頼っている。fresh checkout ではディレクトリが無く Prisma が開けないほか、ファイルがあってもスキーマが空のままなのでレート制限やAPI が全滅する（履歴の jest スイートは GTFS モジュールを丸ごとモックして実DBを使わず、この前提は移転時に失われた）。

## What Changes

- `createPrismaClient` が接続先 SQLite の親ディレクトリを自前で作る。
- jest の `globalSetup` が、`transit-config.json` の `sqlitePath` が指すデータベースファイルの不在時に `prisma db push` でスキーマを適用してからサーバを起動する。既存のデータベースには触れない。

## Capabilities

### Modified Capabilities

- `test-infrastructure`: テストコマンドが用意する状態にテスト用データベースを加える。

## Impact

- `src/lib/db/create-prisma-client.ts`・`scripts/global-setup.mjs`
