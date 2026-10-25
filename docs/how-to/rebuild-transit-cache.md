# 交通キャッシュの再生成

交通DBはGTFSから再生成するキャッシュです。Prisma 7への更新時に、旧DBのデータ移行は行いません。

## 設定と生成

`transit-config.json` の `sqlitePath` にSQLiteファイルの保存先を設定してください。CLI、GTFS取込、アプリは同じ保存先を使います。相対パスは実行ディレクトリから解決します。

```bash
npm ci
npm run build
npm start
```

`npm ci` はPrismaクライアントを `src/generated/prisma/` へ生成します。生成物はGitへ含めません。この生成だけなら交通設定は不要です。build・start・devには交通設定とGTFS入力が必要です。

通常の構築・起動手順は、DBファイルがない場合だけPrismaのschemaを作成します。続いてGTFSを取り込みます。既存DBには起動のたびにschema変更を適用しません。GTFSが追加するテーブルと運行日データを保持します。

## キャッシュの破棄と再取込

1. アプリを停止してください。
2. `transit-config.json` の `sqlitePath` が指すキャッシュDBを削除してください。
3. 同じDB名の `-wal` と `-shm` ファイルがあれば削除してください。
4. `npm run build` を実行してください。
5. `npm start` を実行してください。
6. 停留所、経路検索、運行日例外を確認してください。

GTFSの元ファイルと設定ファイルは保持してください。旧DBへ戻す手順はありません。依存変更を取り消す場合も、対応する構成でGTFSから再生成します。

## 隔離環境での検証

```bash
npm test -- --runInBand scripts/__tests__/transit-cache-rebuild.test.ts
```

このテストは一時ディレクトリに合成GTFSと交通設定を配置します。通常と異なる保存先で、空DBの構築・取込・再初期化・検索を確認します。DBを破棄した後も同じ手順を実行します。稼働DBは変更しません。
