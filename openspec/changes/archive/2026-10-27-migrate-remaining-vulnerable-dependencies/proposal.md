# Proposal

## Why

依存監査には17パッケージの警告が残る。動作への悪影響を避けながら修正版へ更新し、問題が起きた依存経路だけを戻せる単位で変更を記録する。

## What Changes

- 親依存の指定範囲に修正版がある10パッケージを更新し、検証後にコミットする。
- GTFS、Google Maps、Prismaの順で移行を試し、採用する経路ごとにコミットする。
- 検証に失敗した経路の変更を戻し、理由と残存警告を記録して次へ進む。
- **BREAKING**: Prismaを6系から安定版7系へ移行する。SQLiteアダプター、設定、生成先、初期化と起動処理を対応させる。
- DBを再生成するキャッシュとして扱い、旧DBの保持・データ移行・旧クライアントとの互換対応を追加しない。
- 地図、PDF、GTFS取込、経路検索の既存の入出力を維持する。

## Capabilities

### New Capabilities

- `dependency-maintenance`: 依存更新を段階ごとに検証・採用・取消しする条件と、移行後の交通キャッシュ再生成を定める。

### Modified Capabilities

なし。`openspec list --specs` に登録済みの仕様はない。完了済み変更 `refresh-runtime-dependency-security` の文書は変更しない。

## Impact

対象は `package.json`、`package-lock.json`、依存の検査、GTFS取込、Google Maps SDK連携、Prisma schema・設定・生成クライアント・DB初期化である。互換対応が必要なテスト、ビルド・起動設定、DB再生成手順も対象に含む。

各段階のコミットをdevへpushし、検証係へブランチとコミットIDを添えてレビューを依頼する。指摘を修正し、レビューとGitHub CIの通過後にmasterへ統合して正式リリースを公開する。本番デプロイと稼働DBの削除は含めない。
