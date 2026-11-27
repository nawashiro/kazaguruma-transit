# Proposal

## Why

地点索引（`data/geocode-index.json`、約1.3MB）は生成物のままGit管理の外に置かれており、索引がない環境では `/api/geocode` が失敗して地点検索が動かない。ビルドのたびに外部から取り直す設計にもできない。索引をリポジトリへ追跡して、クローン直後から検索が動く状態にする。

あわせて、索引の中身が変わっていなくても実行のたびに `generatedAt` が更新され、無意味な差分が出る問題を直す。

## What Changes

- `data/geocode-index.json` をGit管理に加える。`data/destinations.json` と同じ扱いにする。
- 索引の書き出しを1エントリ1行のJSONへ改める。1行のJSONでは差分が「1行の全置換」になり、どの地点が変わったかをレビューできない。
- 索引の内容ダイジェスト（`indexDigest`）を生成時に比較し、内容が同じならファイルを書き換えない。`generatedAt` の更新だけを理由に差分を出さない。
- 更新コマンドは、書き換えなかった場合と書き換えた場合を区別して報告する。
- `docs/how-to/update-geocode-index.md` に、索引を追跡する理由と、差分が出るとき・出ないときの条件を記す。
- 手順書の確認コマンドから、自動生成される `generatedAt` の表示を外す。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `location-search`: 索引の更新が「常に書き換える」から「内容が変わったときだけ書き換える」に変わる。

## Impact

- `src/lib/location/geocode-index.ts`: `serializeGeocodeIndex` の出力形式。
- `scripts/update-geocode-index.ts`: 既存索引との比較と、書き換えの可否の判断。
- `scripts/lib/geocode-build.ts`: ダイジェストの比較への利用。
- `data/geocode-index.json`: 追跡対象に加わり、整形後に再生成する。
- `docs/how-to/update-geocode-index.md`、`.gitignore` は変更しない（`/data/.cache/` の除外はそのまま）。
- 影響を受けない: 検索API、検索UI、経路検索、GTFS取込、PDF出力。
