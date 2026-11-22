# Tasks

## 1. ビルドartifactの場所一覧

- [x] 1.1 `scripts/__tests__/generate-location-artifact.test.ts`へ、場所一覧のカテゴリ分け、OSM名の解決、OSM名がないrecordの除外、`wheelchair`の3状態への写像、画像と作者・ライセンス、関連リンク、全場所の地域導出の失敗テストを追加し、`npm test -- generate-location-artifact`が失敗することを確認する。
- [x] 1.2 `scripts/generate-location-artifact.ts`へ`sources.locations`の射影と`wheelchair`・`osmElement`・`imageUri`・`imageCreator`・`imageLicense`・`relatedPages`の解決を実装し、`npm test -- generate-location-artifact`が通ることを確認する。
- [x] 1.3 `src/lib/location/__tests__/location-artifact.test.ts`へ、`locations`の形状、重複ID、`wheelchair`の値、`osmElement`、カテゴリ、画像の作者とライセンスの検証の失敗テストを追加し、`npm test -- location-artifact`が失敗することを確認する。
- [x] 1.4 `src/lib/location/location-artifact.ts`の検証と型を`locations`へ切り替え、`npm test -- location-artifact`が通ることを確認する。
- [x] 1.5 `scripts/generate-location-artifact.ts`から`keyLocations`の取得・検証を削除し、`sourceUris.keyLocationsUri`を落とす。`scripts/__tests__/update-destinations.test.ts`の設定も更新し、`npm test -- generate-location-artifact update-destinations location-artifact`が通ることを確認する。

## 2. 場所ページのデータ読み込み

- [x] 2.1 `src/lib/location/__tests__/location-page-data.test.ts`と`location-detail-resolver.test.ts`を`locations`形式へ更新し、`urn:uuid`の解決、存在しないID、重複ID、不正IDの失敗テストが失敗することを確認する。
- [x] 2.2 `src/lib/location/location-page-data.ts`と`location-detail-resolver.ts`を`locations`へ切り替え、`npm test -- location-page-data location-detail-resolver`が通ることを確認する。
- [x] 2.3 `src/utils/addressLoader.ts`から`KeyLocation`・`KeyLocationCategory`・`KeyLocationsDataResult`と型ガードを削除し、`grep -R "KeyLocation" src scripts`が何も返さず、`npm test -- location-page-data location-detail-resolver`が通ることを確認する。

## 3. バリアフリー表示と場所ページ

- [x] 3.1 カテゴリページ、詳細ページ、バッジ、参照リンクの失敗テストを追加し、状態、説明文、情報なしの導線、node・way・relationのリンク規則、2行のリンク文言、新しいタブの通知、既知のみのバッジ、町字と同じ行の配置、画像の作者とライセンス、色だけに依存しない表示を検証して、`npm test -- locations`が失敗することを確認する。
- [x] 3.2 `src/lib/location/wheelchair-status.ts`へタグからラベル・説明文・状態色・参照URLへの写像を実装し、`src/components/features/BarrierAccessibility.tsx`へ詳細ブロックと一覧バッジを実装する。`npm test -- wheelchair-status locations`が通ることを確認する。
- [x] 3.3 詳細ページへ画像の下にバリアフリー情報を置き、画像の`figcaption`に作者とライセンスを出し、カテゴリページのカードへタイトル下のメタ行としてバッジを出す。`npm test -- locations`が通ることを確認する。
- [x] 3.4 カテゴリを`/locations/[code]`、詳細を`/locations/location-detail/[urn:uuid]`へ切り替え、`generateStaticParams`と旧URLの404を検証するテストを通す。
- [x] 3.5 `src/app/__tests__/accessibility-source-contract.test.ts`と場所ページのvisual contractテストを更新し、状態のテキスト、外部リンクの`rel`、フォーカス表示、最小16pxを検証して`npm test -- accessibility-source-contract locations`が通ることを確認する。

## 4. 設定・文書・ライセンス

- [x] 4.1 `app-config.json`と`app-config.json.example`から`keyLocationsUri`を削除し、`npm test -- ensure-app-config generate-location-artifact`が通ることを確認する。
- [x] 4.2 データ提供元カードから「徒歩圏内（600m以内）」を削除し、OSMの`wheelchair`タグとWheelMapまたはOpenStreetMapの案内へ更新する。`src/lib/license/openDataLicenses.json`の説明も更新し、ライセンスページの表示で確認する。
- [x] 4.3 `docs/how-to/update-location-data.md`を追加し、取得元、ビルド後の件数確認、OSM・WheelMap・公開データセットでの修正手順を、記載どおりにコマンドを実行して確認する。

## 5. 統合検証

- [x] 5.1 `npm run build`を実行し、`public/generated/location-data.json`で場所102件、`wheelchair`のある25件、カテゴリ20件、画像の作者とライセンス38件（非URI帰属4件を除く）を確認する。
- [x] 5.2 `npm test`、`npm run lint`、`npx tsc --noEmit`を通す。
- [x] 5.3 開発サーバーで`/locations`と場所詳細を開き、一覧のバッジ、詳細の3状態と情報なし、WheelMapとOSMのリンク、画像の帰属、キーボード操作を確認する。
