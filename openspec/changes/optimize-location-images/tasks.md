# Tasks

## 1. 依存と配置の準備

- [x] 1.1 `sharp` を `dependencies` に追加し、既存の `overrides` と同じ0.35.5で固定する。`npm install` の後に `node -e "require('sharp')"` が成功することを確認する。
- [x] 1.2 `.dockerignore` に `/public/generated/` を追加し、`git check-ignore public/generated/location-data.json` が成功すること、生成物がビルドで作り直されることを確認する。

## 2. ビルド生成のテスト（RED）

- [x] 2.1 `scripts/__tests__/generate-location-artifact.test.ts` に、注入したバイナリ取得関数で `Special:FilePath` の1280px URLを組み立てること、commons以外の写真を失敗として扱うことを確認するテストを追加し、失敗することを確認する。
- [x] 2.2 480・960・1280pxと元画像の幅のうち小さい幅の生成、拡大をしないこと、内容ハッシュ名が同じ入力で安定することを確認するテストを追加し、失敗することを確認する。
- [x] 2.3 429で待って再試行すること、再試行後も失敗した写真だけを `image` なしにし、失敗件数を返すことを確認するテストを追加し、失敗することを確認する。
- [x] 2.4 `src/lib/location/__tests__/location-artifact.test.ts` に、`image` の幅・高さ・`path` の検証（同一オリジン、`..` 禁止、幅の正整数）を追加し、失敗することを確認する。

## 3. 画像生成の実装（GREEN）

- [x] 3.1 取得・変換・書き出しの関数を実装し、2.1と2.2のテストを通す。内容ハッシュは出力バイトのSHA-256先頭16桁と幅から作る。生成の前に出力ディレクトリを空にする。
- [x] 3.2 再試行と失敗時の省略・警告を実装し、2.3のテストを通す。
- [x] 3.3 `image` の検証を `src/lib/location/location-artifact.ts` に実装し、2.4のテストを通す。
- [x] 3.4 `generateLocationArtifact` に統合し、`npm run build` で `public/generated/location-data.json` の写真に `image` が入り、`public/generated/location-images/` にWebPが出力されることを確認する（失敗時は警告の件数も確認する）。
- [x] 3.5 `docs/how-to/update-location-data.md` に取得元・出力形式・失敗時の警告・確認手順を追記し、記載したコマンドがそのまま動くことを確認する。

## 4. 画像解決とページの配信

- [x] 4.1 `src/lib/location/__tests__/location-image.test.ts` を、派生画像（variants・幅・高さ）を返すこと、`image` がない場所は `null` を返すことの期待へ更新し、失敗することを確認する。
- [x] 4.2 `resolveLocationImage` を更新して4.1のテストを通す。
- [x] 4.3 一覧カードの視覚契約テストを、生成済み幅の `srcset`・`sizes`・`loading="lazy"`・`width`/`height`・`alt=""` の期待へ更新し、失敗することを確認する。
- [x] 4.4 一覧カードを実装して4.3のテストを通し、WikimediaのURLを出力しないことを確認する。
- [x] 4.5 場所詳細のページテストを、`srcset` が1280pxまでを含むこと、`loading="eager"`・`fetchpriority="high"`・`width`/`height` の期待へ更新し、実装して通す。

## 5. キャッシュヘッダー

- [x] 5.1 `__tests__/next-config.images-headers.contract.test.ts` を追加し、`/generated/location-images/:path*` に `Cache-Control: public, max-age=31536000, immutable` が付き、`/generated/location-data.json` には付かないことを確認する。実装前に失敗することを確認する。
- [x] 5.2 `next.config.ts` に `headers()` を実装し、5.1のテストを通す。
- [x] 5.3 `npm run build && npm start` の後、`curl -I` で派生画像のヘッダーを確認する。`docs/how-to/update-location-data.md` のキャッシュの説明も更新する。

## 6. 統合確認

- [x] 6.1 `npm run build` を実行し、写真38件の成功件数・警告・生成されたWebPの幅（480・960・1280pxを上限）と形式を確認する。
- [x] 6.2 一覧と詳細のHTMLに `upload.wikimedia.org` が含まれず、一覧1ページの写真の合計が数百KB以下であることを、生成ファイルの合計またはブラウザのNetworkパネルで確認する。
- [ ] 6.3 `npm run lint`、`npx tsc --noEmit`、`npm run test` を通す。
- [ ] 6.4 `npm run accessibility:ci` を実行し、写真の属性変更で新しい違反が出ないことを確認する。

## Workflow follow-up

- 変更提案をレビューし、実装と確認が終わったら `openspec-archive-change` でアーカイブする。
- アーカイブ後のメイン仕様に、写真の取得元とキャッシュの要件が入っていることを確認する。
