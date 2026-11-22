# Proposal

## Why

場所詳細はバリアフリー情報と画像だけで、来訪前に確認できる電話・ウェブサイト・Wikipediaへの導線がない。誤りを見つけても、OSMの要素を直接編集する入口もない。OSMタグミラーには電話28件、ウェブサイト50件、Wikipedia 45件があり、公開Wikidataミラーには56件のentity（日本語版Wikipediaのsitelink 48件）がある。

## What Changes

- ビルドartifactの各場所へ`phone`、`websiteUri`、`wikipediaUri`、`osmEditUrl`を追加する。
- 電話は`phone`または`contact:phone`から取り、`+81`/`81`の接頭辞と区切りを外して`03-NNNN-NNNN`へ正規化する。実データ28件すべてがこの形になる。詳細では`tel:`リンクで表示する。
- ウェブサイトは`website`→`contact:website`の順で解決し、絶対http(s) URIだけを表示する。リンク文言は「ウェブサイトを開く」。
- Wikipediaは日本語を優先し、OSMの`wikipedia`タグ→Wikidataミラーの`jawiki`→OSMの他言語→Wikidataミラーの`enwiki`の順で解決する。
- `app-config.json`へ`wikidataMirrorUri`を追加し、ビルドでWikidataミラーを取得する。取得失敗または形式不正はビルド失敗とする。
- 詳細ページの上部に「編集する（OpenStreetMapを開きます）」を置き、OSMのiDエディタへ要素種別ごとのURLで遷移させる。ログインはOSM側で行う。
- 詳細ページに「基本情報」を追加し、電話、ウェブサイト、Wikipediaを、値がある項目だけ表示する。一覧ページには出さない。
- **BREAKING** なし。表示が増えるだけ。

## Capabilities

### New Capabilities

- `location-facts`: OSMタグミラーとWikidataミラーから電話・ウェブサイト・Wikipedia・OSM編集先をビルド時に解決し、場所詳細に表示する。

### Modified Capabilities

なし。

## Impact

- 変更: `scripts/generate-location-artifact.ts`、`src/lib/location/location-artifact.ts`、`src/lib/location/location-page-data.ts`、`src/app/locations/location-detail/[id]/page.tsx`、`app-config.json`、`app-config.json.example`、関連するテストと文書、`src/lib/license/openDataLicenses.json`。
- 依存: OSMタグミラー（既存）とWikidataミラー（新規）。どちらもビルド時だけ取得し、実行時は取得しない。
- 範囲外: 営業時間（別change）、一覧カードへの事実表示、電話番号の国際対応、Wikidataクレームの表示。
