# 実装計画: 施設ページと検索フォームのURL整理

**Branch**: `spec/issue-79-uri-pages` | **Date**: 2026-09-05 | **Spec**: [spec.md](spec.md)

## Summary

Issue #79に従い、施設データを公開準備時の検証済みスナップショットへ固定する。既知のカテゴリ・詳細を`generateStaticParams`でSSGし、`dynamicParams = false`で未知URLを共通404へ送る。トップをURL初期値対応の単一ネイティブフォームに整理する。閲覧時の施設CDN取得、旧詳細URL、JSON形式の目的地引渡し、段階的な画面置換を削除する。

設計判断は[research.md](research.md)、公開形状は[ui-url-contract.md](contracts/ui-url-contract.md)、検証手順は[quickstart.md](quickstart.md)を正本とする。

## Technical Context

**Language/Version**: TypeScript 5 strict、React 19、Next.js 15.5.25

**Primary Dependencies**: Next.js App Router、Tailwind CSS 4、DaisyUI 5.0.50、Lucide、Jest、React Testing Library、Puppeteer

**Storage**: 追跡するJSONビルド成果物。新規DB、認証、永続状態は追加しない。

**Testing**: Jest 29.7.0、React Testing Library、隔離コピーでのNext本番生成、Chromium

**Target Platform**: Node.js 22.xのWebサーバーと現行ブラウザ。現環境のNode.js 26.5.1は検証時に注意として記録する。

**Project Type**: Next.js単一Webアプリケーション

**Performance Goals**: 施設一覧・カテゴリ・詳細で閲覧時の施設CDN取得を0回にする。既存の経路検索性能要件を変更しない。

**Constraints**:

- 一覧、カテゴリ、詳細、トップ候補は同じ生成済みJSONだけを読む。
- 施設取得・検証失敗はビルド前工程を非zeroで終える。空配列・旧loader・実行時CDNへの切替を作らない。
- カテゴリURLはデータの元の`category:en`をURLエンコードして使う。ASCII slugへ変換しない。
- `/routes`、経路計算、GTFS、逆ジオコード提供者、Issue #77の全体スタイル変更は対象外とする。
- 利用制限429は既存の`/rate-limit?source=home`遷移を維持する。他の失敗は入力を保持する。

**Scale/Scope**: 現設定版でトップ候補62件、詳細施設169件、詳細カテゴリ16件、町字GeoJSON59地物。生成時に全件検証する。

## Constitution Check

### 実装前

| 原則 | 適合判断 | 対応 |
|---|---|---|
| Clear Naming / Simple Logic | PASS | データ検証、町字判定、URL parser、フォーム状態を小さい責務へ分離する。 |
| Structured Organization / Type Safety | PASS | build dataは`src/lib/location`、型は`src/types`、生成JSONは`src/generated`、UIは`src/components/features`へ置く。`unknown`から検証する。 |
| Test-First Development | PASS | 各動作をRED→独立テストレビュー→GREENに分割する。 |
| Accessibility & UX | PASS | WCAG 1.3.1、2.1.1、2.4.3、2.4.7、2.5.3、3.2.2、3.3.1、3.3.2、3.3.3、4.1.2、4.1.3を対象にする。全操作を44px以上にする。 |
| KISSと後方互換禁止 | PASS | 単一スナップショットと通常リンクを採用する。旧URLとJSON目的地引渡しのフォールバックを残さない。 |
| レート制限 | PASS | 429遷移を維持する。 |
| 検証スコープ | PASS | 既存の静的契約テストの旧パス・子form・JSON URL期待は、実在するproductionコードの置換に合わせて更新する。除外やスキャナ弱化をしない。 |

### 設計後

PASS。新しい依存、DB、施設API、二重経路を追加しない。唯一の生成JSONは公開成果物の入力であり、実行時キャッシュやフォールバックではない。

## Project Structure

### Documentation

```text
specs/023-location-pages-route-form/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/ui-url-contract.md
└── tasks.md
issues/79-location-pages-route-form/
└── investigation.md
```

### Source Code

```text
scripts/
└── build-location-data.ts
src/
├── app/
│   ├── page.tsx
│   └── locations/
│       ├── page.tsx
│       ├── [category-id]/page.tsx
│       └── location-detail/[id]/page.tsx
├── components/features/
│   ├── RouteSearchForm.tsx
│   ├── LocationCategoryList.tsx
│   ├── LocationCard.tsx
│   ├── OriginSelector.tsx
│   ├── DestinationSelector.tsx
│   ├── DateTimeSelector.tsx
│   ├── LocationSuggestions.tsx
│   └── useGeocodingSearch.ts
├── generated/location-data.json
├── lib/
│   ├── location/location-build-data.ts
│   └── transit/route-search-query.ts
└── types/
    ├── location-pages.ts
    └── route-input.ts
```

**Structure Decision**: 現行のApp Router構造を維持する。生成CLIは取得だけを担い、`src/lib/location/location-build-data.ts`の純粋な検証・変換へ渡す。ページは生成JSONを読み、UIはpropsだけを使う。

## Execution Design

### 1. 生成データ

1. `scripts/build-location-data.ts`が設定版のトップ候補・詳細施設、GeoJSONを取得する。
2. `location-build-data.ts`が入力形状、座標、施設ID、カテゴリID、GeoJSON形状、Polygonの穴を検証する。
3. 有効なすべての入力から、町字を含む1個のJSONを作る。
4. 成功時だけ一時ファイルから`src/generated/location-data.json`へ置換する。
5. `predev`と`prebuild`はこの生成を実行する。`start`には追加しない。

### 2. 施設ページ

- `/locations`はカテゴリリンクと既存案内を表示する。
- `/locations/[category-id]`と`/locations/location-detail/[id]`は`generateStaticParams`で生成JSONから既知の全件パラメータを列挙し、SSGする。
- 両ルートは`dynamicParams = false`を明示する。未知paramsの検索失敗は防御的な`notFound()`で`src/app/not-found.tsx`へ送り、HTTP 404の共通見出し・本文を表示する。共通404に`/locations`への戻るリンクを設けず、カテゴリ・詳細固有のnot-foundも作らない。
- カテゴリページの初期表示はサーバー描画の町字別一覧である。距離順だけをclient componentで扱う。
- 詳細ページは所属カテゴリへの通常リンクを持つ。
- `LocationCard`は閲覧時GeoJSON取得をやめ、事前計算済みの`areaName`と新URLを使う。

### 3. URLとフォーム

- 部分入力parserを`route-search-query.ts`へ追加し、全条件必須の結果parserを再利用・維持する。
- `RouteSearchForm`を追加し、単一のフォーム状態とURL初期化を持つ。
- 頂点候補はビルドデータから`select`/`optgroup`で描画する。
- 既存selectorはフォームの一部として、子formを持たない入力・ボタンへ縮小する。
- `InputField`は編集時フォーカスに必要なrefを受け渡す。
- `page.tsx`のJSON解析、URL削除、全体aria-live、段階表示を削除する。

## Accessibility Plan

- 目的地、出発地、日時、優先条件は見出し、`fieldset`、`legend`、明示的`label`で関係を表す。
- 日時と優先条件のラジオはグループ内の同じ`name`を使う。
- エラーと状態は該当項目の近くに限定して通知する。フォーム全体を`aria-live`にしない。
- 「端末のGPSを許可する」「なおす」「検索」の可視名をアクセシブル名に含める。
- 「なおす」後の入力フォーカスを検証する。候補選択による入力変化は予測可能にする。
- 320px幅、キーボード、可視フォーカス、44px操作領域をブラウザで確認する。

## Risks and Mitigations

| リスク | 対策 |
|---|---|
| GeoJSONは`latest`で施設版とは別版 | 生成時点の単一スナップショットへ固定し、ソースURLと生成時刻を記録する。共通版があるとは主張しない。 |
| 生成JSONの更新漏れ | `predev`と`prebuild`へ生成を追加し、fixtureで生成失敗・原子的置換をテストする。 |
| 429遷移と入力保持の衝突 | 利用制限は既存遷移を優先する例外として明記し、その他失敗の入力保持をテストする。 |
| Next静的生成の未知URL | 初回T057はsegment not-found/default 404でFAILだった。T060の`dynamicParams=true`は当時の暫定修正であり、現在は`generateStaticParams`による既知パスのSSG、`dynamicParams=false`による共通HTTP 404、共通本文・戻るリンクなしを確認する。ユーザー修正後のfresh runtime PASSは未確認である。 |
| 旧静的契約テスト | 旧production形を前提とするテストをREDとして置換する。スキャナを弱めない。 |
| Node版の不一致 | 現環境の結果とNode 22.xの最終結果を分けて報告する。 |

## Quality Gates

1. 各タスクの親確認: 変更パス、focused Jest、`git diff --check`。
2. 統合確認: `tsc --noEmit --incremental false`、`npm run lint -- --no-cache`、`npm test`。
3. 隔離コピー: fixture生成、`next build`直実行、ChromiumでCDN遮断・全URL・JS無効・フォーム操作を確認する。
4. 提出前: `git status --short --branch`、commit、push後の`git ls-remote`、PRのhead SHAとCIを確認する。

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| 生成CLIと追跡JSON | 実行時CDN取得を完全に排除し、全ページへ同じ公開版を渡す | ページごとのfetch cacheはキャッシュ欠損時のCDN取得と公開版の不整合を残す |
