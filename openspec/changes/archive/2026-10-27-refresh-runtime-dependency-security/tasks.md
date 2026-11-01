# Tasks

## 1. 公開サーバー依存の最低修正版

- [x] 1.1 `__tests__/dependency-security.test.ts` に Next.js 15.5.28、sharp 0.35.5 の宣言下限・解決値の検査を追加し、更新前の依存で失敗を確認する。
- [x] 1.2 Next.js と sharp の宣言・override・ロックファイルを設計の条件へ更新し、1.1 の検査成功を確認する。
- [x] 1.3 `eslint-config-next` を Next.js と同じ版へ揃え、`npm run lint` と `npx tsc --noEmit --incremental false` の成功を確認する。

## 2. 地図・PDF の依存更新

- [x] 2.1 Google Maps SDK 配下の Axios を 1.20.0 以上、follow-redirects を 1.16.1 以上へ更新し、`npm ls axios follow-redirects --all` で解決値を確認する。互換更新で条件を満たせない依存は、保留理由を記録する。
- [x] 2.2 Puppeteer を同じ 25 系で更新し、`npm ls puppeteer puppeteer-core chromium-bidi zod --all` と Node 要件で整合性を確認する。
- [x] 2.3 地図と `src/app/api/__tests__/pdf-route-contract.test.ts` の関連テストを実行し、既存の入出力契約を確認する。互換対応が必要な動作は、先に失敗するテストで示す。
- [x] 2.4 地図・画像・PDF の実行確認を行い、結果を記録する。API キーや Chrome が不足する確認項目は、代替したテストと未実施の範囲を記録する。

## 3. ランタイムの再取得と確認手順

- [x] 3.1 `docs/how-to/docker-setup.md` に `build --pull --no-cache app`、生成イメージの Node.js・Chrome 確認、本番コンテナ再作成後の版確認を追加し、Compose のサービス名とコマンドを照合する。
- [x] 3.2 検証環境が揃う場合は本番構成のイメージを再取得付きでビルドし、Node.js 22.23.4 以上と Chrome の修正状況を確認する。環境がなければ、未実施の項目と理由を検証結果へ記録する。
- [x] 3.3 生成イメージ内の Chrome で PDF を確認し、結果を記録する。実行できない場合は、実 Chrome との互換性を未確認と記録し、本番反映時の確認項目へ残す。

## 4. 統合検証と残存警告

- [x] 4.1 クリーン導入後に lint、strict TypeScript、build、Jest を実行し、結果を記録する。サーバーを要するテストでは本番サーバーを起動して確認する。
- [x] 4.2 全依存と `--omit=dev` の監査を実行し、Next.js・sharp の対象警告の解消と、更新対象の解決値を確認する。
- [x] 4.3 更新後に残る全警告の依存経路・攻撃条件・保留理由を design.md の調査表へ反映する。監査件数、コマンド、未実施の検証も同ファイルへ記録する。
- [x] 4.4 `git diff --check` と OpenSpec の strict 検証を実行し、差分が提案の範囲内であることを確認する。本番反映の実施状況をアプリの検証結果と分けて報告する。

## Workflow follow-up

- 本番反映の実行時に、運用者が再取得付きビルド、イメージ内の確認、コンテナ再作成、稼働版と地図・画像・PDF の確認を行う。
- 本番反映には既存の本番設定を使う。設定値と認証情報を検証結果へ含めない。
- 実装のレビューと必要な検証を終えてから、この変更をアーカイブする。
