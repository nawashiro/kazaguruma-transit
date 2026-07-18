# Quickstart: ブックマーク可能な経路検索結果

1. `npm test -- --runInBand`、`npx tsc --noEmit`、`npm run lint`、`npm run build`を実行する。
2. `/`で目的地、出発地、日時、出発/到着、はやさ優先を指定して検索する。
3. `/routes?...`へ移り、Networkで`GET /api/transit?...`を確認する。
4. URLを再読み込みし、同条件の結果、PDF、カレンダー、バス停メモ・会話を確認する。
5. URLを別windowで直接開き、localStorageの優先設定に依存しないことを確認する。
6. `origin=91,0`、必須キー欠落、不正日時でAPIを呼ばず日本語エラーと「検索条件を変更」リンクが出ることを確認する。

## 2026-07-18 実施結果

- `npx tsc --noEmit`: PASS
- `npm run lint`: PASS（既存ファイルのwarningのみ、errorなし）
- `npm test -- --runInBand`: PASS（111 suites / 537 tests、3 suites / 17 tests skipped）
- `npm run build`: PASS（`/routes` と `/api/transit` を含むproduction build成功）
- Red-team: URL round-trip、座標/日時/真偽値拒否、GET 400、入力ページ非fetch、直接アクセス、結果なし、API error、429、POST rate-limit順序維持を再確認した。
