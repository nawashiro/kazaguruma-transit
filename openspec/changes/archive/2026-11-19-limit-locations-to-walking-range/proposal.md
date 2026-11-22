# Proposal

## Why

「場所をさがす」は公開JSON-LDの全recordを表示しており、バス停から徒歩圏外の施設も一覧と詳細に並ぶ。利用者は自分がたどり着ける行き先を探すためにこの一覧を使うので、碁盤目補正後の徒歩距離が500mを超える施設を「近い順」に混ぜると、一覧と経路検索で到達可能性の見積もりが食い違う。徒歩圏の判定は目的地目録（`data/destinations.json`）が既に持っているので、場所一覧の母集団もその候補に揃える。

## What Changes

- **BREAKING**: `/locations` の母集団を、目的地目録の候補に含まれるrecordだけに限定する。一覧・詳細・静的パラメータはこの集合だけを対象にし、集合外の詳細URLは404になる。
- 表示名はこれまでどおりOSMタグミラーの`name`だけを使う。目録にだけ存在しOSM名を持たない2件は表示しない。表示は101件から83件、カテゴリは19から18へ減る。
- ビルド（`scripts/generate-location-artifact.ts`）に目録のID集合を渡し、`sources.locations`から集合外のrecordを除く。距離計算や停留所の読み込みは追加しない。500m判定は目録更新の責務のままにする。
- 場所ページのカテゴリナビゲーション、ソート、地域導出、artifact検証、テストを新しい母集団に合わせる。
- データ提供元カードの文言は変えない。徒歩圏の数値は目録の更新で変わり得るため、ページに固定文言を置かない。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `location-catalog`: 「公開JSON-LDの全recordの一覧化」を、目的地目録の候補に限定する要件へ変更する。

## Impact

- `scripts/generate-location-artifact.ts`: `buildLocations`へ目録のID集合を渡し、集合外のrecordを除外する。
- `src/lib/location/location-artifact.ts`: 母集団の検証と地域導出を新しい一覧に対応させる。
- `src/app/locations/**`: カテゴリ数、表示件数、詳細の404範囲が変わる。
- テスト: `scripts/__tests__/generate-location-artifact.test.ts`、`src/lib/location/__tests__/location-artifact.test.ts`、`src/app/locations/**/__tests__`、`src/app/__tests__/location-*`。
- `docs/how-to/update-location-data.md`: 母集団の説明を目録の候補へ更新する。
- 依存: `data/destinations.json`。公開JSON-LDに新しいrecordが増えても、目録を更新するまで`/locations`には出ない。
