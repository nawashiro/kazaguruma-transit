# Tasks

## 1. 生成とartifact読み取りでライセンスを受け入れる

- [x] 1.1 `scripts/__tests__/generate-location-artifact.test.ts`に、`schema:license`が「Public domain」のrecordが`imageUri`・`imageCreator`・`imageLicense`を持つ失敗テストと、ライセンスが空文字列または空白だけのrecordが画像を持たない失敗テストを追加し、`npm run test:unit -- generate-location-artifact`が失敗することを確認する。
- [x] 1.2 `src/lib/location/__tests__/location-artifact.test.ts`に、`imageLicense`が「Public domain」のartifactが読める失敗テストと、空文字列の`imageLicense`が拒否される失敗テストを追加し、`npm run test:unit -- location-artifact`が失敗することを確認する。
- [x] 1.3 `parseLocationImage`のライセンス判定を`isNonEmptyString`へ変え、ライセンスをtrimして`imageLicense`に格納する。1.1のテストが通ることを確認する。
- [x] 1.4 `validateLocation`の`imageLicense`検証を`requireNonEmptyString`へ変える。1.2のテストが通り、`imageUri`と`imageCreator`の検証が変わっていないことを確認する。

## 2. 表示でURIのときだけリンクにする

- [x] 2.1 `src/lib/location/__tests__/location-image.test.ts`の「not-a-url」を期待するケースを、非URIのライセンスが解決されるケースへ変え、空白だけのライセンスが`null`になる失敗テストを追加し、`npm run test:unit -- location-image`が失敗することを確認する。
- [x] 2.2 `resolveLocationImage`のライセンス判定を、trim後に空でない文字列を受け入れる形へ変える。2.1のテストが通ることを確認する。
- [x] 2.3 `src/app/locations/location-detail/[id]/__tests__/page.test.tsx`に、`imageLicense: "Public domain"`のとき作者と「Public domain」がテキストで出てリンクにならないこと、CCのURIでは従来どおりリンクになることを検証する失敗テストを追加し、`npm run test:unit -- "src/app/locations/location-detail/\[id\]/__tests__/page.test.tsx"`が失敗することを確認する。
- [x] 2.4 詳細ページの帰属表示を、`isAbsoluteHttpUrl(image.license)`が真なら`<a>`、偽ならテキストを描画する分岐へ変える。2.3のテストが通ることを確認する。
- [x] 2.5 `src/app/locations/[category-id]/__tests__/page.test.tsx`に、`imageLicense: "Public domain"`のカードが「写真 さくら・Public domain」をリンクなしで表示するテストを追加し、`npm run test:unit -- "src/app/locations/[category-id]/__tests__/page.test.tsx"`が通ることを確認する。

## 3. 文書・ビルド・検証

- [x] 3.1 `docs/how-to/update-location-data.md`の写真件数と「URIでない画像は表示しない」の記述を、ライセンスが非空の文字列なら表示し、絶対http(s) URIのときだけリンクにする説明へ更新する。期待件数を29件とし、取得に失敗した写真がある場合は警告件数に載ることを確認する。記載の確認コマンドで件数が読めることも確認する。
- [x] 3.2 `npm run build`を実行し、`public/generated/location-data.json`で写真が29件、神田寺とマーチ エキュート 神田万世橋の`imageLicense`が「Public domain」で`image`を持つことを確認する。取得に失敗した写真がある場合は警告件数に載り、ビルドが成功することを確認する。
- [x] 3.3 `npm run lint`、`npm test`、`npx tsc --noEmit`、`openspec validate accept-public-domain-location-images --strict`がすべて成功することを確認する。

## Workflow follow-up

- レビュー後に変更をアーカイブし、`openspec/specs/location-catalog/spec.md`へ差分が反映されたことを確認する。
