# Design

## Context

写真の採否は3箇所で同じ「ライセンスが絶対http(s) URIか」を判定している。

- 生成: [generate-location-artifact.ts](scripts/generate-location-artifact.ts) の`parseLocationImage`
- artifact読み取り: [location-artifact.ts](src/lib/location/location-artifact.ts) の`validateLocation`
- 表示解決: [location-image.ts](src/lib/location/location-image.ts) の`resolveLocationImage`

表示側 [page.tsx](src/app/locations/location-detail/[id]/page.tsx) は`image.license`を無条件に`<a href>`にする。一覧カードは[page.tsx](src/app/locations/[category-id]/page.tsx)で`imageLicenseLabel`の戻り値をテキストとして出すだけなので、リンクの有無に影響されない。

[image-license.ts](src/lib/location/image-license.ts) の`imageLicenseLabel`は、CC系のURLを`CC BY-SA 4.0`などへ、CC0とPublic Domain Markを既知の表記へ変換し、それ以外は入力文字列をそのまま返す。したがって「Public domain」という文字列は追加実装なしでそのまま表示できる。

現データでは`schema:license`が「Public domain」のrecordが4件あり、うち現行カタログの2件（神田寺、マーチ エキュート 神田万世橋）が写真なしになっている。`schema:license`がURLのrecordはすべてCC系で、CC0の2件は既にリンク付きで表示されている。

## Goals / Non-Goals

**Goals:**

- ライセンスの採否を「非空の文字列が記録されているか」に変える。
- 絶対http(s) URIのライセンスだけをリンクにし、それ以外は記録値をテキストで示す。
- artifactの形と、CC系ライセンスの表示を変えない。

**Non-Goals:**

- 作者を必須とする条件の緩和。PDでは帰属義務がないが、現データのPD4件はすべて作者名を持つため、表示の分岐を増やさない。
- `Unknown authorUnknown author`など元データの作者名の修正。データ側の責務とし、表示コードで吸収しない。
- ライセンス文字列の意味的な検証。CC名の表記ゆれや権利の真偽は判定しない。
- 「Public domain」など非URI表記の翻訳。

## Decisions

### 1. `imageLicense`は文字列のままにする

`LocationEntry`と`LocationImage`の`imageLicense: string`を維持し、ラベルとURIを別フィールドに分けない。

理由: artifactの形が変わらず、生成済みデータとの互換性を保てる。リンクの有無は絶対http(s) URIかどうかで判定でき、別フィールドは同じ情報の二重管理になる。代替案の`imageLicenseUri`追加は、表示の都合でartifactスキーマと生成・検証・テストを広げることになるので採らない。

### 2. 非URIライセンスは任意の非空文字列を受け入れる

既知のPD表記だけを許可するホワイトリストは採らない。

理由: これまでのURL判定も、URLの中身が正しいかは検証していなかった。実質は「データにライセンスが記録されているか」の代理判定であり、文字列を受け入れることは判定の意図に忠実。ホワイトリストはデータを信じる点で同じなのに、表記ゆれ（`Public Domain`、`PD`）で写真を落とす。受理後の失敗は表示ラベルの誤りであり、URL判定でも防げなかった種類のもの。

代替案: PD表記のホワイトリスト。コードが増え、得るものが表示上の安心感だけなので採らない。

### 3. リンク判定は既存の`isAbsoluteHttpUrl`を使う

詳細ページで`isAbsoluteHttpUrl(image.license)`が真なら`<a>`、偽ならテキストを描画する。一覧カードは既にテキストのみなので変更しない。`imageLicenseLabel`はそのまま使い、非URIでは入力文字列を返す既存動作に任せる。

### 4. 空文字列は「ライセンスなし」として画像を落とす

空白だけの文字列を有効なライセンスとして表示しない。生成時は`schema:license`をtrimして空なら画像を捨て、artifact読み取り時は`requireNonEmptyString`で拒否する。`imageUri`と`imageCreator`の要求は変えない。

### 5. 作者の要求は据え置く

CC BY/SAの帰属には作者が必要で、判定を分岐させる利益がない。PDで作者が空の画像を許すかは、表示の選択肢（作者なしの帰属行）を伴う別の判断なので、必要になった時点の変更に分ける。

## Risks / Trade-offs

- [PDの主張が元データの手入力で、権利の真偽をコードでは確認できない] → 公開JSON-LDを権利状態の正として扱い、表示にも記録値を出す。今回の4件も、URL判定では権利の真偽を確かめられていなかった。データ更新手順で出典の確認を求める。
- [CCライセンスが文字列で記録され、リンクなしで表示される] → ライセンス名は表示されるため帰属の識別は保たれる。リンクが必要な更新ではデータ側にURIを記録する。コードでURIを推測しない。
- [`Unknown authorUnknown author`が作者名として表示される] → 元データの不具合。表示コードで特別扱いせず、データ更新時に修正する。
- [古いコードが新しいartifactを読むと、非URIライセンスを不正としてデータエラーにする] → ロールバック時はartifactも同時に再生成する。artifactはビルド生成物でリポジトリ管理外のため、通常のデプロイでは問題にならない。
- [文書の写真件数がデータ更新でずれる] → 件数は既存の確認コマンドでartifactから数え、固定値を正としない。

## Migration Plan

1. 生成・読み取り・表示の検証を変更し、テストを更新する。
2. `npm run build`でartifactを再生成し、神田寺とマーチ エキュート 神田万世橋に`image`が付くことを確認する。
3. 取得に失敗した場合は写真なしのままビルドが成功し、警告件数に載る。原寸URLへのフォールバックはしない。
4. ロールバックはコードの revert とartifactの再生成を同時に行う。
