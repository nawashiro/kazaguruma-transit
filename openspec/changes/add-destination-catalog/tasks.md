# Tasks

## 1. 停留所選択の共通化

- [ ] 1.1 `selectNearbyStops`のテストを追加する。500m以下の採用、500m超の除外、上限ちょうどの採用、直線距離への√2補正、距離順の並びを検証し、実装前に失敗することを確認する。
- [ ] 1.2 `src/lib/transit/stop-selection.ts`へ`calculateHaversineDistanceKm`と`selectNearbyStops`を実装し、`TransitService.findNearbyStops`をこの関数へ移行する。1.1のテストと既存の停留所選択テストが通ることを確認する。

## 2. 目的地目録の更新CLIとデータ

- [ ] 2.1 目録更新CLIのテストを追加する。公開JSON-LDのID取得、500m以内だけの出力、OSM関連付け・OSMタグミラーの要素・OSM名のないrecordの除外、名前コメントの更新、既存の`includeInRouteForm`の保持、新規候補の`false`追加、掲載entryの徒歩圏外・OSM不完全・record消失の報告を検証し、実装前に失敗することを確認する。
- [ ] 2.2 `scripts/update-destinations.ts`を実装する。公開JSON-LDとOSMタグミラーを取得し、`data/destinations.json`を更新する。追加・削除・掲載解除したIDを標準エラーへ報告する。2.1のテストが通ることを確認する。
- [ ] 2.3 目録を生成し、`data/destinations.json`をコミットする。500m以内かつOSM名のある候補が69件、`includeInRouteForm: true`が設計の20件、500m超またはOSM不完全なentryがないことを検証する。
- [ ] 2.4 目録の更新手順を`docs/how-to/update-destinations.md`へ書き、`npm run`または`npx tsx`で示したコマンドが実行できることを確認する。

## 3. ビルドのID結合とルートページ

- [ ] 3.1 ビルドのテストを追加する。掲載entryだけの出力、ID不存在、座標不正、`gif-poi`コード0件・複数、未知コード、空グループの省略、OSM関連付け・OSM名なしで失敗すること、目録名とOSM名が異なる場合にOSM名を使うこと、`source.placesUri`・`source.osmMirrorUri`の不一致で失敗すること、外部取得失敗で失敗することを検証し、実装前に失敗することを確認する。
- [ ] 3.2 位置情報artifactの生成を実装する。`placesJsonLdUri`と`osmMirrorUri`から公開JSON-LDとOSMタグミラーを取得し、掲載IDの座標・分類・OSM表示名を結合して`sources.routeDestinations`を出力する。`sources.mainFacilities`を削除する。3.1のテストを通す。
- [ ] 3.3 ルートページのテストを更新する。artifactの掲載20件を3グループで表示し、実行時に外部取得をせず、artifact欠落時にデータエラーを表示することを検証する。
- [ ] 3.4 `src/app/page.tsx`と関連する型を`routeDestinations`へ切り替える。3.3のテストと既存のアクセシビリティテストを通す。

## 4. 設定・ライセンス・削除

- [ ] 4.1 `app-config.json`と`app-config.json.example`へ`placesJsonLdUri`と`osmMirrorUri`を追加し、`mainFacilitiesUri`を削除する。設定検証のテストが通ることを確認する。
- [ ] 4.2 `src/lib/license/openDataLicenses.json`を新しいDataset landing pageとODbL/CC0の表示へ更新する。ライセンスページのテストが通ることを確認する。
- [ ] 4.3 `locationsDataVersion`と未使用の住所データローダーを削除する。`npx tsc --noEmit --incremental false`と`npm run lint`が通ることを確認する。

## 5. 統合検証

- [ ] 5.1 `npm run test:unit`と`npm run test:server`を実行し、全テストが通ることを確認する。
- [ ] 5.2 `npx tsc --noEmit --incremental false`と`npm run lint`を実行し、エラーがないことを確認する。
- [ ] 5.3 `ci/transit-config.json`を配置して`npm run build`を実行し、目録のID結合とルートページの生成が成功することを確認する。
- [ ] 5.4 ルートページを320 CSS px相当で表示し、長い施設名が折り返され、3グループがキーボードで操作できることを確認する。

## Workflow follow-up

- レビュー要件を満たしたあと、changeをarchiveする。
- archive後の`openspec/specs/destination-catalog/spec.md`を確認する。
