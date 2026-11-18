# Tasks

## 1. 依存と日本時間アダプタ

- [x] 1.1 `opening_hours@3.16.0`を依存へ追加し、`npm ls opening_hours`で解決を確認する。
- [x] 1.2 `src/lib/location/opening-hours-time.ts`へ`toLibraryDate`・`fromLibraryDate`を実装し、オフセットを注入できる形にして、`getTimezoneOffset`が0と-540の両方で同じ日本時間になることを検証する単体テストを通す。
- [x] 1.3 既定のオフセット取得を使い、日本時間の12:00に営業中の規則を評価して「営業中」になる統合テストを追加し、`npm test -- opening-hours`が通ることを確認する。

## 2. 営業時間の評価

- [x] 2.1 失敗テストを追加し、`Tu-Su 10:00-17:30`の営業中・営業時間外、`PH off`の祝日、`Sa[1] off`の第1土曜、`Mo-Su 11:00-08:00`の深夜跨ぎ、`24/7`、解釈不能の規則を検証して、`npm test -- opening-hours`が失敗することを確認する。
- [x] 2.2 `src/lib/location/opening-hours.ts`へ、状態、次に変わる時刻、先一週間の日別時間帯、`PH`・`SH`の警告判定を実装し、`npm test -- opening-hours`が通ることを確認する。
- [x] 2.3 artifactの各場所へ`openingHours`を追加し、文字列の検証を足して、`npm test -- generate-location-artifact location-artifact`が通ることを確認する。

## 3. 詳細ページ

- [x] 3.1 詳細ページの失敗テストを追加し、「営業中」「営業時間外」「24時間営業」、次に変わる時刻、7日分の日別表示、休みの日、複数の時間帯、常時の注意書き、`PH`・`SH`がない場合の祝日警告、`PH`がある場合の警告なし、解釈不能時の生の規則表示、画像とバリアフリー情報の下・基本情報より上の配置を検証して、`npm test -- locations`が失敗することを確認する。
- [x] 3.2 詳細ページを`force-dynamic`にし、営業時間セクションを画像とバリアフリー情報の下・基本情報の上へ実装して、`npm test -- locations`が通ることを確認する。
- [x] 3.3 `src/app/__tests__/accessibility-source-contract.test.ts`と場所詳細のvisual contractテストを更新し、16px以上の文字、色だけに依存しない状態表示、`<time>`の日付、フォーカス表示を検証して`npm test -- accessibility-source-contract locations`が通ることを確認する。

## 4. 文書・ライセンス・統合

- [x] 4.1 `docs/how-to/update-location-data.md`へ、営業時間の規則、祝日と第N週の警告、解釈不能時の表示を追記し、記載どおりにビルドと表示を確認する。
- [x] 4.2 依存ライセンスの出力に`opening_hours`（LGPL-3.0）が載り、クライアントバンドルに含まれないことを確認する。
- [x] 4.3 `npm run build`を実行し、営業時間のある40件で状態と先一週間が表示され、ない62件でセクションが出ないことを確認する。
- [x] 4.4 `npm test`、`npm run lint`、`npx tsc --noEmit`を通し、開発サーバーで祝日・第1土曜・深夜営業・24/7の場所を開いて表示を確認する。
