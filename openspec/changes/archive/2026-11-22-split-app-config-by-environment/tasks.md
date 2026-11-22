# Tasks

## 1. 環境解決とテンプレート

- [x] 1.1 `src/lib/config/app-config-environment.ts` の単体テストを追加する。`APP_CONFIG_ENV` が `local` / `production` のときその値、未設定のとき `NODE_ENV=production` だけ production、`development` と `test` は local、未知の値は日本語のエラーになることを検証し、実装前に失敗することを確認する。
- [x] 1.2 `app-config-environment.ts` を実装する。環境の型、解決関数、設定ファイル名を返す関数を置き、1.1のテストが通ることを確認する。
- [x] 1.3 追跡するテンプレートを `app-config.json.example` の1つにし、現在の開発用の値（localhost、検証用の管理者鍵、開発用お知らせ）を載せる。`app-config.local.json.example` は作らない。`src/lib/config/__tests__/app-config.test.ts` がテンプレートの形と `appUrl` を検証して通ることを確認する。
- [x] 1.4 開発機の `app-config.json` を `app-config.local.json` へ移し、`app-config.json` は本番値で用意し直す。追跡対象の変更（`app-config.json.example` と `.gitignore` への `app-config.local.json` 追加、`app-config.prod.json` の削除）だけをコミット対象にし、`git check-ignore app-config.json app-config.local.json` が両方を無視することを確認する。

## 2. 読み込みの切り替えと存在検証

- [x] 2.1 `app-config.ts` のテストを追加する。`NODE_ENV=test` の実行では `app-config.local.json` の値が公開され、`APP_CONFIG_ENV=production` を立てた分離モジュールの読み込みでは `app-config.json` の値が公開されることを検証し、実装前に失敗することを確認する。
- [x] 2.2 `app-config.ts` を2ファイルの静的importと `APP_CONFIG_ENV` による選択へ変更し、Jest実行時の既定を local にする。2.1のテストと既存の検証テストが通ることを確認する。
- [x] 2.3 `next.config.ts` で解決関数を使い、server/client両方へ `env: { APP_CONFIG_ENV }` として固定する。未知の値では設定読み込み時に日本語のエラーで失敗する。契約テストで `next.config.ts` が解決関数と `env.APP_CONFIG_ENV` を使うことを検証する。
- [x] 2.4 `scripts/__tests__/ensure-app-config.test.ts` を2ファイル構成へ更新する。両方あるときは成功し、片方だけのときに不足パスを示して非ゼロで終了し、ファイルを作らないことを検証し、実装前に失敗することを確認する。
- [x] 2.5 `scripts/ensure-app-config.mjs` を2ファイルの存在検証へ変更し、2.4のテストが通ることを確認する。

## 3. ビルドスクリプトとnpmスクリプト

- [x] 3.1 `scripts/__tests__/generate-location-artifact.test.ts` のCLI実行を2ファイル構成へ更新し、`APP_CONFIG_ENV=production` のときに本番用ファイルのURIを取得することを検証する。実装前に失敗することを確認する。
- [x] 3.2 `scripts/generate-location-artifact.ts` のCLIが解決関数で選んだファイルを読むよう変更し、3.1のテストが通ることを確認する。
- [x] 3.3 `scripts/__tests__/update-destinations.test.ts` に、`NODE_ENV` と `APP_CONFIG_ENV` で読むファイルが変わることを検証するテストを追加し、実装前に失敗することを確認する。`scripts/update-destinations.ts` を同じ解決関数へ変更して通す。
- [x] 3.4 `package.json` の `prebuild` が `APP_CONFIG_ENV=${APP_CONFIG_ENV:-production}` を artifact 生成へ渡すようにし、契約テストで `prebuild` と `predev`・`pretest` の役割を検証する。

## 4. Docker・CI・ドキュメント

- [x] 4.1 `Dockerfile.dev` のビルド前に `ENV APP_CONFIG_ENV=local` を置き、`Dockerfile.prod` は既定の production のままにする。既存のDocker契約テストとソース確認で両方を検証する。
- [x] 4.2 Quality Gate の設定準備を1つのテンプレートから2ファイルを作るコピーへ変更し、`src/app/__tests__/app-config-build-boundary.test.ts` のCI・Docker境界テストを2ファイル構成へ更新して通す。
- [x] 4.3 `__tests__/app-config-contract.test.ts` を1テンプレート構成へ更新する。`app-config.json.example` だけが存在すること、2ファイルのgitignore、公開テンプレートに秘密項目がないことを検証して通す。
- [x] 4.4 `README.md`、`docs/how-to/analytics.md`、`docs/how-to/docker-setup.md`、`docs/how-to/update-destinations.md`、`docs/how-to/update-location-data.md`、`docs/how-to/seo-optimization.md`、`docs/reference/discussion.md`、`docs/reference/technology-stack.md` を2ファイル構成へ更新する。記載した `cp` とコマンドがそのまま動くことを確認する。

## 5. 統合検証

- [x] 5.1 `npm run test:unit` と `npm run test:server` を実行し、全テストが通ることを確認する。
- [x] 5.2 `npx tsc --noEmit --incremental false` と `npm run lint` を実行し、エラーがないことを確認する。
- [x] 5.3 `app-config.json.example` から2ファイルを用意し、`ci/transit-config.json` を配置して `npm run build` を実行する。artifactの取得先URIが本番用設定と一致し、`npm start` で起動することを確認する。
- [x] 5.4 `.next` に開発用の設定固有のお知らせ文字列が残っていないことを確認する。残る場合は選択方法を見直し、結果を作業記録へ残す。
- [x] 5.5 `docker compose up --build` で開発用イメージを起動し、表示とcanonical URLが `app-config.local.json` の `appUrl` を使うことを確認する。Dockerが使えない環境では未実施として記録する。

## Workflow follow-up

- レビュー要件を満たしたあと、changeをarchiveする。
- archive後の `openspec/specs/app-config/spec.md` を確認する。
