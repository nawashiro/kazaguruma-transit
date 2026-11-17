# Tasks

## 1. カテゴリ名辞書の取得とカテゴリ生成

- [x] 1.1 ビルドのテストを追加する。辞書のコードと名前でカテゴリを作ること、辞書の定義順に並ぶこと、空のカテゴリを出さないこと、異なるコードを統合しないこと、辞書にないコード・辞書の取得失敗・形式不正・コード重複でビルドが失敗することを検証し、実装前に失敗することを確認する。
- [x] 1.2 `app-config.json`と`app-config.json.example`へ`categoryNamesUri`を追加する。`scripts/generate-location-artifact.ts`で辞書を取得・検証し、`ROUTE_DESTINATION_GROUPS`、コード引き、`group`上書きを削除して、コード単位のカテゴリを辞書順で出力する。1.1のテストが通ることを確認する。
- [x] 1.3 artifactの`sourceUris.categoryNamesUri`を型と検証へ追加し、`scripts/__tests__/generate-location-artifact.test.ts`の期待値を更新して通ることを確認する。

## 2. 目録からグループ指定を削除する

- [x] 2.1 目録のテストを追加・更新する。更新CLIが既存entryの`group`を引き継がないこと、`group`を持つentryを読み込んでも分類に使わないことを検証し、実装前に失敗することを確認する。
- [x] 2.2 `src/lib/location/destination-catalog.ts`から`group`を削除し、`scripts/update-destinations.ts`の引き継ぎを削除する。`data/destinations.json`から`group`を消し、2.1のテストが通ることを確認する。

## 3. artifactとルートページをcategoryIdへ切り替える

- [x] 3.1 `RouteDestinationCategory`の`category:en`を`categoryId`へ変え、`src/types/route-destinations.ts`、`src/lib/location/location-artifact.ts`、`src/app/page.tsx`、`LocationSuggestions`を更新する。ルートページとartifactのテストを`categoryId`のfixtureへ更新し、通ることを確認する。
- [x] 3.2 生成済み`public/generated/location-data.json`を再生成し、`categoryId`と辞書の名前を持つことを確認する。

## 4. ドキュメントと統合検証

- [x] 4.1 `docs/how-to/update-destinations.md`を辞書利用へ更新し、`group`と表示グループの記述を消す。記載のコマンドを実行して手順が成立することを確認する。
- [x] 4.2 `npm run test:unit`と`npm run test:server`、`npx tsc --noEmit --incremental false`、`npm run lint`、`npm run build`を実行し、すべて通ることを確認する。
- [x] 4.3 `openspec validate use-published-category-dictionary --strict`を通し、delta specと実装の要求が一致することを確認する。

## Workflow follow-up

- レビュー要件を満たしたあと、changeをarchiveする。
- archive後の`openspec/specs/destination-catalog/spec.md`を確認する。
