# Proposal

## Why

場所ページの写真は、Wikimedia Commonsの原寸画像をブラウザが直接取得している。実測では29枚で82.6MB、1枚あたり最大7.8MBあり、写真6枚のカテゴリページは数十MBになる。高齢者・障害者を含む利用者にとって、モバイル回線の通信量と表示時間が負担になる。

ビルドは既に場所データを外部から取得しており、実行時に外部取得しない契約もある。写真も同じようにビルド時に解決し、配信するバイト数を減らす。

## What Changes

- ビルドで各写真を1280px以下の標準サムネイル（小さい写真は元画像）から取得し、WebPの480・960・1280pxを生成して `public/generated/location-images/` へ内容ハッシュ名で出力する。HTMLと配信には派生画像だけを使い、原寸は配信しない。
- artifactの各場所に派生画像のパス・幅・高さを追加し、一覧と詳細は派生画像だけを参照する。WikimediaのURLをHTMLに出さない。
- 一覧カードは480・960px、詳細は最大1280pxを `srcset` と `sizes` で選ぶ。カードは遅延読み込み、詳細の先頭写真は即時読み込みにする。
- 派生画像は `Cache-Control: public, max-age=31536000, immutable` で配信する。
- 写真1枚の取得または変換に失敗した場合、その写真だけを非表示にしてビルドを続け、警告に件数を出す。原寸URLへのフォールバックはしない。
- `sharp` を直接依存に追加し、`public/generated/` をDockerのビルド文脈から除外する。生成元・件数・確認方法を `docs/how-to/update-location-data.md` に追記する。

## Capabilities

### New Capabilities

- `location-images`: 場所写真のビルド時取得、派生画像の生成、内容ハッシュ名による長期キャッシュ、取得失敗時の扱いを定める。

### Modified Capabilities

- `location-catalog`: 画像の取得元を `schema:image.contentUrl` からビルド生成の派生画像へ変え、実行時に写真を外部取得しないことを明記する。
- `location-ui`: 一覧と詳細の写真を派生画像の `srcset` で配信し、読み込みの優先度を定める要件を追加する。

## Impact

- 変更: `scripts/generate-location-artifact.ts`、`src/lib/location/location-artifact.ts`、`src/lib/location/location-image.ts`、一覧・詳細ページ、`next.config.ts`（キャッシュヘッダー）、`package.json`（sharp）、`.dockerignore`、`docs/how-to/update-location-data.md`。
- 変更: ビルドスクリプト、artifact、画像解決、ページ、視覚契約のテスト。
- 影響: ビルド時間が1〜2分増え、CIの品質ゲートも同じだけ延びる。場所データの形式が変わるため、既存の生成物は再生成が要る（`public/generated/` はgit管理外）。
- 変えない: 場所ID、カテゴリ、地域、営業時間、バリアフリー情報、帰属表示の文言、API。
