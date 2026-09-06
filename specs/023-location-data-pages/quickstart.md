# Quickstart: 場所データページのJavaScript削減

**Feature**: [spec.md](./spec.md)
**Plan**: [plan.md](./plan.md)
**UI contract**: [contracts/location-pages.md](./contracts/location-pages.md)

## Prerequisites

- Node.js 22.x
- `npm install`済みのリポジトリ
- `app-config.json`（場所データ版を含む）
- 外部CDNへ到達できる環境（server-side data boundary確認時）
- GPSを使うブラウザ（GPS受入確認時のみ）

## Static checks

```bash
npx tsc --noEmit --incremental false
npm run lint
npm test -- --runInBand

git diff --check
git status --short --untracked-files=all
```

`npm run build`はPrisma schema push、GTFS取得、Next buildを実行するため、作業ツリーへの副作用を確認できる最終段階でのみ実行する。

## Focused test targets

実装後に、実際のtasks.mdで確定したパスを正本とする。計画時点の候補は次のとおり。

```bash
npm test -- --runInBand --runTestsByPath \
  src/app/locations/__tests__/page.test.tsx \
  'src/app/locations/[category-id]/__tests__/page.test.tsx' \
  'src/app/locations/location-detail/[id]/__tests__/page.test.tsx' \
  src/components/features/__tests__/LocationCategoryNavigation.test.tsx \
  src/components/features/__tests__/LocationSortControls.test.tsx \
  src/components/features/__tests__/LocationSuggestions.test.tsx \
  src/lib/location/__tests__/location-origin-query.test.ts \
  src/lib/location/__tests__/location-page-data.test.ts \
  src/utils/__tests__/addressLoader.test.ts \
  --silent
```

## Acceptance walkthrough

1. `/locations`を直接開き、先頭カテゴリの正規URLへ解決し、先頭ナビが選択されることを確認する。
2. カテゴリナビから別カテゴリへ移動し、通常のカテゴリURLと表示内容が一致することを確認する。
3. カテゴリページで「町字で並べる」が選択済みになり、町字グループが表示されることを確認する。
4. 「近い順に並べる」を押し、GPS許可後に現在カテゴリURLへ`origin=<latitude>,<longitude>`が付与され、距離順になることを確認する。
5. `origin`付きカテゴリページから別カテゴリへ移動し、`origin`が維持されることを確認する。
6. `origin`付きカテゴリページから詳細へ移動し、詳細URLに`origin`が含まれないことを確認する。
7. 詳細または他ページから戻ったとき、位置情報が暗黙に引き継がれないことを確認する。
8. 「町字で並べる」を押し、現在カテゴリURLから`origin`が消え、町字表示へ戻ることを確認する。
9. 文字列形式不正・NaNの`origin`を直接開き、日本語エラーと町字一覧が表示されることを確認する。千代田区外の数値座標はエラーにせず距離順表示する。
10. 有効な`origin`でGPS再取得を失敗させ、距離順一覧と`origin`を維持して再取得エラーだけ表示することを確認する。
11. 存在しないカテゴリURL・場所詳細URLを開き、通常の404となることを確認する。データ取得失敗・重複ID・JSON不正は404と別のデータエラーになることを確認する。
12. ホームで「よく利用される施設」の表示時にブラウザから場所データCDNへ直接リクエストせず、選択した施設が既存の目的地入力へ引き継がれることを確認する。
13. 住所・名前検索、Google Maps API、住所検索用レート制限UIが場所ページに存在しないことを確認する。

## Final checks

```bash
npx tsc --noEmit --incremental false
npm run lint
npm test -- --runInBand
git diff --check
npm run build
```

## Obsolete-logic deletion checks

各削除候補は、tasks.mdの削除台帳と対応するproduction-only検索で確認する。実装後は次を対象ごとに実行し、旧経路の参照が残っていないことを記録する。

- 旧 `/location-detail/[id]` のroute、Link、redirect、専用テスト参照
- `/locations`のclient CDN loader、旧`CategoryTabs`利用、旧active-category state
- 場所ページの住所・名前検索、`geocodeAddress`、住所検索rate-limit branch
- 不要になった`loadLocationCategories`、distance/position state、未使用export/import
- 新しいserver data boundaryへ移した後の旧client area/GeoJSON fetch参照

削除後の検索でテスト・fixture・履歴資料だけが残る場合は、production consumerが0件であることを記録する。旧経路を動かすfallbackやcompatibility redirectを追加して検索を通過させてはならない。

## Evidence to record

- server-side data loadとブラウザCDNリクエストの確認結果
- `/locations`のリダイレクト先、category navのactive state、origin保持/破棄のURL
- 町字/近い順の表示状態、GPS拒否・再取得失敗、invalid origin、out-of-area coordinates
- 404とdata-load/duplicate/malformed-data errorの分類
- focused/full Jest suite/test数、TypeScript、lint、build、diff checkの終了コード
