# Tasks

## 1. 取得元の設定と目録のsource

- [x] 1.1 `app-config.json.example` と各環境の `app-config.json` を `datasetJsonLdUri` へ変え、`categoryNamesUri` を削除する。`node -e` で両ファイルを解析し、新しいキーがあり旧キーがないことを確認する。
- [x] 1.2 `data/destinations.json` の `source` を `datasetJsonLdUri` と `osmMirrorUri` の形へ変える。`node -e` で `validateDestinationCatalog` に相当するキー検査を行い、旧 `placesUri` がないことを確認する。
- [x] 1.3 `src/lib/location/destination-catalog.ts` の `DestinationCatalogSourceUris` と検証を `datasetJsonLdUri` へ改名し、`scripts/update-destinations.ts` の設定読み取りを合わせる。`npm run test:unit -- --testPathPattern=update-destinations` を通す。
- [x] 1.4 `src/lib/location/location-artifact.ts` の `LocationArtifactSourceUris` を `datasetJsonLdUri` へ改名し、artifactの検証と `scripts/generate-location-artifact.ts` の設定読み取りを合わせる。`npm run test:unit -- --testPathPattern=location-artifact` を通す。
- [x] 1.5 `docs/how-to/update-destinations.md` の取得元の記述を新しいキーへ更新し、記載のコマンドを実行して目録のsourceが一致することを確認する。

## 2. 公開グラフの解析とカテゴリ

- [x] 2.1 `scripts/__tests__/generate-location-artifact.test.ts` のフィクスチャを `dataset.jsonld` 形式（Place、DefinedTermSet、DefinedTerm、NodeShape）へ作り直し、Place型フィルタ、term索引、`schema:keywords` 解決の失敗テストを追加してREDを確認する。
- [x] 2.2 `scripts/generate-location-artifact.ts` にPlace型フィルタ、DefinedTermSet順のterm索引、keywordsからコードと名前への解決を実装し、2.1のテストをGREENにする。
- [x] 2.3 カテゴリ0件の除外と警告、複数カテゴリの各バケットへの掲載、参照先termがない場合の失敗のテストを追加し、実装する。`npm run test:unit -- --testPathPattern=generate-location-artifact` を通す。
- [x] 2.4 Place形状とDefinedTerm形状のpath存在確認のテストを追加し、実装する。形状がない場合とpathが欠ける場合にビルドが失敗することを確認する。
- [x] 2.5 `docs/how-to/update-location-data.md` の取得元、カテゴリの取得方法、複数カテゴリ、カテゴリ0件の説明を更新し、`npm run build` の警告とartifactのカテゴリ構造を照合する。

## 3. artifactと場所詳細

- [x] 3.1 artifact検証のテストへ、同じIDで同一内容の重複を許す場合と、内容が異なる重複を拒否する場合を追加し、`src/lib/location/location-artifact.ts` をdeep-equal比較へ変えてGREENにする。
- [x] 3.2 `location-page-data` と `location-detail-resolver` のテストへ、複数カテゴリの同一IDを1件に畳む場合と、内容不一致をエラーにする場合を追加し、実装する。`npm run test:unit -- --testPathPattern='location-(page-data|detail-resolver)'` を通す。
- [x] 3.3 場所詳細ページのテストへ、複数カテゴリの全リンク、パンくずの先頭カテゴリ、`generateStaticParams` のID重複排除を追加し、実装する。`npm run test:unit -- --testPathPattern='location-detail'` を通す。
- [x] 3.4 作者のない画像を「作者不明」として詳細に表示するテストを追加し、`resolveLocationImage` と詳細のfigcaptionを実装する。作者もライセンスもない画像が出ないことを確認する。

## 4. 経路フォームの目録

- [x] 4.1 `scripts/__tests__/update-destinations.test.ts` に、`@graph` のtermと形状をPlaceとして拾わないテストを追加し、`readPlaceRecords` をPlace型フィルタへ変えてGREENにする。
- [x] 4.2 経路フォームのカテゴリ解決をterm索引へ変えるテストを追加し、`buildRouteDestinations` で複数カテゴリの各グループへの出力とカテゴリ0件の除外を実装する。`npm run test:unit -- --testPathPattern=generate-location-artifact` を通す。
- [x] 4.3 `docs/how-to/update-destinations.md` と `docs/how-to/update-location-data.md` の経路フォームのカテゴリ説明を更新し、`data/destinations.json` の掲載entryが新しいカテゴリで出力されることを確認する。

## 5. 一覧カードの写真帰属

- [x] 5.1 場所一覧カードのテストへ、作者のない画像で「写真 作者不明・ライセンス」を表示する場合を追加し、カードの帰属表示を実装する。`npm run test:unit -- --testPathPattern='locations'` を通す。
- [x] 5.2 `docs/how-to/update-location-data.md` の画像の説明を、作者があれば作者名、なければ「作者不明」と示す形へ更新し、記載どおりに表示されることを確認する。

## 6. 統合検証

- [x] 6.1 `npm test` を通し、複数カテゴリ、作者不明画像、形状確認、目録更新のテストがすべて成功することを確認する。
- [x] 6.2 `npm run build` を実行し、`public/generated/location-data.json` の場所86件、カテゴリ20件、写真参照50件、車いす14件を実測して `docs/how-to/update-location-data.md` の件数を更新する。件数の確認コマンドを文書に残す。
- [x] 6.3 `grep` で `places.jsonld`、`category-names.jsonld`、`placesJsonLdUri`、`categoryNamesUri` がコード・設定・文書に残っていないことを確認する。意図的に残すのは変更履歴と移行の説明だけにする。
- [x] 6.4 `npm run lint` を通し、`/locations`、`/locations/[category-id]`、複数カテゴリの詳細、作者不明画像の詳細、経路フォームをローカルで開いて表示を確認する。

## Workflow follow-up

- レビュー要件を満たしたあと、`openspec-archive-change` で変更をアーカイブする。
- アーカイブ後のspecと実装が一致することを確認する。
