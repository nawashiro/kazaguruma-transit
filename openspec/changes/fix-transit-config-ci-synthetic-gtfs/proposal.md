## Why

`transit-config.json` が欠落しても `npm run build` が成功するため、開発者やCIが設定し忘れに気づけない。GTFS取り込みの失敗を明示的に検出し、Secretに依存せずfork由来のPull Requestでも検証できる状態が必要になった。

## What Changes

- `transit-config.json` の欠落・不正・GTFSデータ不足をbuild失敗として扱う。
- CIが小規模な合成GTFS fixtureと対応する`transit-config.json`を明示的に用意してbuildする。
- 合成fixtureで、日本語ID、任意項目の空値、calendar例外、終端のpickup/dropoff、BOM・改行差など、確認した入力形式を検証する。
- 設定欠落、無効な参照、取り込み結果が空になるケースを回帰テストで固定する。
- 本番GTFS、実在する事業者データ、GitHub SecretはCI fixtureに含めない。
- **BREAKING**: `transit-config.json` を用意しないローカルbuildは成功しなくなる。

## Capabilities

### New Capabilities

- `transit-config-enforcement`: transit-configとGTFS入力をbuildの必須前提として検証し、CIで合成fixtureを使って再現可能に検証する。

### Modified Capabilities

## Impact

- `scripts/import-gtfs.ts`、設定読込、GTFS取り込み結果の検証に影響する。
- `.github/workflows/quality-gate.yml` に合成fixtureの準備工程を追加する。
- `ci/` 配下の合成GTFSデータ、設定fixture、関連テストを追加する。
- 本番データの配布、Secret管理、アプリケーションの公開API、実運用GTFSの取得元は変更しない。
