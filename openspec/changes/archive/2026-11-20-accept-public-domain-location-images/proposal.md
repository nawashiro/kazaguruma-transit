# Proposal

## Why

場所の写真は現在、`schema:license`が絶対http(s) URIであることを表示条件にしている。しかしパブリックドメインの写真には共有すべきライセンス文書が存在せず、公開JSON-LDは「Public domain」という文字列で権利状態を示す。このため権利上もっとも制約の少ない写真だけが表示から漏れている。現データでは4件が該当し、うち現行カタログの2件（神田寺、マーチ エキュート 神田万世橋）が写真なしで表示されている。

## What Changes

- `schema:license`は、非空の文字列であれば受け入れる。絶対http(s) URIであることを要求しない。`schema:contentUrl`は取得元として絶対http(s) URIのまま要求する。
- 場所詳細のライセンスは、絶対http(s) URIのときだけリンクにする。それ以外は記録された文字列をテキストで示す。一覧カードは従来どおりテキストのみとする。
- 生成時とartifact読み取り時の`imageLicense`検証を、絶対http(s) URIから非空文字列へ緩める。artifactの形は変えない。
- 表記は記録値のままとする。「Public domain」を「パブリックドメイン」などへ翻訳しない。
- 作者を必須とする条件は変えない。パブリックドメインでも作者名が記録されていることを表示条件に残す。作者名の内容（マーチ エキュート 神田万世橋の`Unknown authorUnknown author`など）はこの変更で扱わない。
- 神田寺とマーチ エキュート 神田万世橋に写真が付き、写真は27件から29件になる見込み。件数はデータ取得の成否で変わる。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `location-catalog`: 「場所詳細の内容解決」のライセンス条件を、絶対http(s) URI必須から非空文字列の受入れへ変え、URIのときだけリンクにする。

## Impact

- 変更: `scripts/generate-location-artifact.ts`、`src/lib/location/location-artifact.ts`、`src/lib/location/location-image.ts`、`src/app/locations/location-detail/[id]/page.tsx`、関連するテスト、`docs/how-to/update-location-data.md`
- 影響なし: artifactのスキーマ、公開API、依存関係、画像の取得・変換処理
