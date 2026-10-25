# Proposal

## Why

既存の交通DBを再利用すると、GTFSやスキーマを更新しても古いDBが残り、手動削除が必要になる。GTFSから再生成できるキャッシュとして扱い、起動するコードと設定に対応するDBを毎回作る。

## What Changes

- **BREAKING** `npm run dev` と `npm start` は設定されたSQLite DBを毎回削除し、スキーマ作成・GTFS取込・検証を終えてから配信を始める。
- **BREAKING** 同じDBにあるAPIレート制限カウンターも再起動でリセットする。
- 設定、DB削除、スキーマ作成、GTFS取得・取込、検証のいずれかが失敗した場合は起動を中止する。旧DBへの復帰や取込のスキップは行わない。
- `npm run import-gtfs` を明示的なキャッシュ再生成コマンドにする。稼働中の更新は行わず、時刻表の更新はアプリ停止後の再起動で反映する。
- ビルドから交通DBの再生成を分離し、ビルドによる稼働中DBの変更を防ぐ。
- 未使用の別取込経路と再利用用の設定を除去し、運用手順を再起動による更新へ改める。

## Capabilities

### New Capabilities

- `transit-cache-lifecycle`: 起動前の交通キャッシュ再生成、配信開始の条件、失敗時の起動中止、更新とカウンターの寿命を定める。

### Modified Capabilities

なし。

## Impact

`scripts/initialize-transit-cache.ts`、`scripts/import-gtfs.ts`、`package.json` の起動・ビルド処理、`src/lib/db/transit-manager.ts` の未使用取込経路、設定型、関連テストとキャッシュ再生成手順が対象となる。Dockerのビルド・起動でも同じ処理順を使う。

SQLiteファイルと `transit-config.json` の `sqlitePath` を引き続き使う。旧DBの保持・データ移行は行わない。URLを指定したGTFSは起動ごとに取得するため、配信開始までの時間と起動可否が取得元の応答に依存する。
