# Proposal

## Why

前回更新した Next.js と sharp に、新たな脆弱性が公開された。公開サーバーで使う依存を修正版へ更新し、本番ビルドで取得する Node.js と Chrome の実バージョンを確認する。

## What Changes

- Next.js を 15.5.28 以上の 15.5 系へ更新する。sharp の override 下限を 0.35.5 へ上げ、ロックファイルの解決値も更新する。
- Google Maps 経由の Axios・follow-redirects と、PDF 生成用 Puppeteer を互換範囲で更新する。更新後も残る警告には攻撃条件と保留理由を記録する。
- 依存の最低修正版を検査する既存テストを改める。地図・画像・PDF の既存動作を検証する。
- Docker の再取得付きビルドと、生成イメージ内の Node.js・Chrome の確認手順を整える。本番反映時には稼働コンテナの版も確認する。
- Prisma のメジャー更新と、ビルド・検査専用依存の一括更新は対象外とする。

## Capabilities

### New Capabilities

- `server-dependency-security`: 公開サーバー依存の最低修正版、残存警告の評価、本番実行環境の確認条件を定める。

### Modified Capabilities

なし。

## Impact

対象は `package.json`、`package-lock.json`、`__tests__/dependency-security.test.ts`、`docs/how-to/docker-setup.md` とする。依存更新で互換対応が必要な場合は、地図・PDF の該当処理とテストに限定する。

API 契約、Prisma schema、GTFS 設定、Node.js 22 系の選択、CI の起動条件は変更しない。本番環境へのアクセスは未確認であり、ローカル検証と本番反映の完了を分けて報告する。
