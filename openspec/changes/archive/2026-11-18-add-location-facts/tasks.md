# Tasks

## 1. ビルドartifactの事実項目

- [x] 1.1 `scripts/__tests__/generate-location-artifact.test.ts`へ、電話の正規化（`+81`・`81`・`03`・不正値）、ウェブサイトの優先順と不正URL、Wikipediaの4段階解決、`osmEditUrl`の三種別、Wikidataミラーの取得失敗の失敗テストを追加し、`npm test -- generate-location-artifact`が失敗することを確認する。
- [x] 1.2 `scripts/generate-location-artifact.ts`へWikidataミラーの取得・検証と事実項目の解決を実装し、`npm test -- generate-location-artifact`が通ることを確認する。
- [x] 1.3 `src/lib/location/__tests__/location-artifact.test.ts`へ、`phone`・`websiteUri`・`wikipediaUri`・`osmEditUrl`の検証の失敗テストを追加し、`npm test -- location-artifact`が失敗することを確認する。
- [x] 1.4 `src/lib/location/location-artifact.ts`の型と検証へ事実項目を追加し、`npm test -- location-artifact`が通ることを確認する。

## 2. 場所ページのデータ読み込み

- [x] 2.1 `src/lib/location/__tests__/location-page-data.test.ts`と`location-detail-resolver.test.ts`へ、事実項目が詳細へ渡ることと、欠落項目が`undefined`になることの失敗テストを追加し、`npm test -- location-page-data location-detail-resolver`が失敗することを確認する。
- [x] 2.2 `src/lib/location/location-page-data.ts`と`location-detail-resolver.ts`を事実項目へ対応させ、`npm test -- location-page-data location-detail-resolver`が通ることを確認する。

## 3. 詳細ページ

- [x] 3.1 詳細ページの失敗テストを追加し、上部の「編集する（OpenStreetMapを開きます）」、`node`・`way`・`relation`のURL、電話の`tel:`リンク、ウェブサイトとWikipediaの外部リンク、欠落項目の非表示、基本情報セクションの有無、新しいタブの通知を検証して、`npm test -- locations`が失敗することを確認する。
- [x] 3.2 `PageHeader`の直後へ編集リンクを置き、基本情報セクションを実装し、`npm test -- locations`が通ることを確認する。
- [x] 3.3 `src/app/__tests__/accessibility-source-contract.test.ts`と場所詳細のvisual contractテストを更新し、44px以上のリンク、16px以上の文字、`rel="noopener noreferrer"`、フォーカス表示を検証して`npm test -- accessibility-source-contract locations`が通ることを確認する。

## 4. 設定・文書・ライセンス

- [x] 4.1 `app-config.json`と`app-config.json.example`へ`wikidataMirrorUri`を追加し、`npm test -- ensure-app-config generate-location-artifact`が通ることを確認する。
- [x] 4.2 データ提供元カードと`src/lib/license/openDataLicenses.json`を、電話・ウェブサイトがOSM由来で、OSMで修正できることを含む内容へ更新し、ライセンスページの表示で確認する。
- [x] 4.3 `docs/how-to/update-location-data.md`へ、Wikidataミラーの取得先、Wikipedia解決順、電話正規化の規則と警告の読み方を追記し、記載どおりにビルドを実行して確認する。

## 5. 統合検証

- [x] 5.1 `npm run build`を実行し、`public/generated/location-data.json`で電話28件、ウェブサイト50件、Wikipediaリンク48件、`osmEditUrl`102件を確認する。
- [x] 5.2 `npm test`、`npm run lint`、`npx tsc --noEmit`を通す。
- [x] 5.3 開発サーバーで場所詳細を開き、上部の編集リンク、電話の発信リンク、ウェブサイトとWikipediaの遷移、欠落項目の非表示、キーボード操作を確認する。
