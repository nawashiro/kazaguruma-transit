# Research: 場所データページのJavaScript削減

**Feature**: [spec.md](./spec.md)
**Phase**: 0 — Outline & Research
**Date**: 2026-09-06
**Repository**: `/opt/data/kazaguruma-transit`

## 調査方法と前提

`AGENTS.md`、憲章、既存の場所一覧・場所詳細・ホーム・経路検索URL契約、`/discussions`の共通ナビゲーション、現在の場所データを読み取り専用で調査した。現在のソースは変更していない。

現在の場所データ版 `2.1.1` を読み取り、`key_locations.json` は16カテゴリ・169場所、カテゴリID重複0、場所ID重複0、URL境界に問題となるslash/backslash/query/fragment/control character 0件だった。カテゴリ順の先頭は `city_office_and_branch_offices`（表示名「区役所・出張所」）である。

## Decision 1: 初期実装はサーバー側データ境界を持つSSR中心とする

### Decision

- `/locations`、`/locations/[category-id]`、`/locations/location-detail/[id]`は、場所データをサーバー側で取得・検証するServer Component中心のページとして設計する。
- `origin`クエリで距離順が変わるため、最初の実装方式はSSR（サーバーサイドレンダリング）を基本とする。
- SSG（静的サイト生成）は必須条件にしない。将来、データ版のビルド固定と動的queryの扱いを別途選択できるよう、ページ表示とデータ取得境界を分離する。
- ブラウザから場所データCDNへの直接取得は行わない。アプリケーション用の新しい場所データAPI、DB、キャッシュ永続化は追加しない。

### Rationale

Next.jsの`generateStaticParams`は動的パスをビルド時に列挙する手段であり、`/location-detail/[id]`という階層名自体がSSGの障害ではない。一方、カテゴリページの`origin`はリクエストごとに距離順表示を変えるため、SSRならURLから検証・並べ替え・HTML生成を一つの境界で扱える。ユーザーが指定した主眼はSSGではなくブラウザ側JavaScriptの削減であるため、最初からSSG固有の失敗処理へfeatureを縛らない。

### Alternatives considered

- **全ページをSSGする**: `origin`付き表示、データ版の更新、生成対象ID列挙、ビルド失敗の設計が増え、今回の主眼を超える。
- **現在のclient fetchを維持する**: CDN失敗、loading、URLナビゲーション、カテゴリ状態をブラウザ側に残すため不採用。
- **座標をPOST/fetchで別APIへ送る**: `origin`をURLに含めない代償としてAPIと通信状態を増やすため不採用。

## Decision 2: `/locations`は先頭カテゴリの正規URLへ解決する

### Decision

- `/locations`はデータ順が確定した先頭カテゴリの`/locations/[category-id]`へ解決する。
- カテゴリ0件、場所データ取得失敗、形式不正の場合は解決せずデータエラー状態とする。
- 存在しないカテゴリID、空ID、URL識別子として不正な値は通常の404とする。
- `origin`を持たないサイドバー入口からは、先頭カテゴリの町字表示へ入る。

### Rationale

`/locations`と先頭カテゴリページの二重表示を避け、URLと表示内容を一致させる。共通ナビゲーションの先頭選択状態も、URLで一意に決まる。

## Decision 3: URL・origin・並べ替えの契約

### Decision

- `[category-id]`は既存の`category:en`をURLエンコードした値とする。新しいslug対応表は作らない。
- `origin=<latitude>,<longitude>`は現在カテゴリURLの一時状態とする。緯度・経度順は既存の経路検索結果URLと同じである。
- 数値として解釈できる座標は千代田区外でも受け入れる。文字列形式不正、NaN等はエラーを表示しつつ町字一覧を表示する。
- カテゴリ間のナビゲーションは有効な`origin`を維持する。
- 場所詳細、その他ページ、「町字で並べる」は`origin`を削除する。
- 有効な`origin`で再度GPS取得に失敗しても、既存の距離順表示と`origin`を維持し、エラーだけを表示する。
- `sessionStorage`、`localStorage`、アプリ共通状態には座標を保存しない。

### Rationale

カテゴリ間では同じ座標で比較することが利用者にとって自然だが、詳細や他ページまで位置情報を持ち回る必要はない。「町字で並べる」を明示的なリセット経路にすることで、URL状態を通常のリンクで制御できる。

## Decision 4: 「近いところから表示」はGPS専用の小さな境界にする

### Decision

- カテゴリナビゲーションの下に「町字で並べる」「近い順に並べる」の2操作を置く。
- 「近い順に並べる」はブラウザの`navigator.geolocation`を、利用者の明示操作後にだけ呼ぶ。
- 取得成功後は現在カテゴリURLへ通常のGET遷移を行い、サーバー側で距離順を計算する。
- 名前・住所入力、Google Maps API、ジオコーディングAPI、住所検索専用レート制限は場所ページから削除する。
- 「町字で並べる」は現在カテゴリのqueryなしURLへの通常遷移とする。

### Rationale

GPSボタンだけのclient islandにし、場所データ取得・距離計算・ページ表示をサーバー側へ置く。住所検索はGoogle Maps APIとレート制限の複雑性を持つため、今回の小さな責務から外す。

## Decision 5: 町字分類はサーバー側へ移すが、既存の純粋計算を再利用する

### Decision

- `clientGeoUtils.ts`のポリゴン判定、地域名整形、カテゴリ内グループ化の純粋関数は再利用する。
- GeoJSON取得はサーバー側のデータ境界へ移し、Next.jsのfetchキャッシュを使う。アプリケーション独自の永続キャッシュは追加しない。
- `area`フィールドが空の現在データでも、GeoJSONから町字を導出し、導出不能は「その他」にする既存意味を維持する。
- 距離計算は既存`calculateDistance`、距離順は既存`sortLocationsByDistance`を基礎にし、同距離時は元のデータ順を維持する。

### Alternatives considered

- **GeoJSONを毎回ブラウザ取得する**: 場所データCDNと同じclient fetch問題を残すため不採用。
- **areaフィールドだけを正本にする**: 現行データで`area`が提供されていないため、町字表示が壊れる。
- **距離計算ロジックを新規実装する**: 既存の距離計算とテストを重複させるため不採用。

## Decision 6: 共通カテゴリナビゲーションはURLナビゲーションとして実装する

### Decision

- `/locations/layout.tsx`がカテゴリデータとナビゲーション境界を共有する。
- `LocationCategoryNavigation`は`nav`・通常リンク・`aria-current="page"`を持つ。視覚的なtabs-boxは再利用してよいが、通常のサイト移動をapplication tab widgetとして複製しない。
- `origin`の読み取り・カテゴリ間リンクへの付与だけを小さなclient islandに限定し、場所データ取得は行わない。
- `/discussions`の`DiscussionManagementTabLayout`は、active state、ページリンク、戻り導線、キーボード検証の参照として利用する。

### Rationale

既存の`CategoryTabs`はbuttonと一時的なactive stateを持つため、カテゴリURLを正本にする要求とは異なる。`DiscussionManagementTabLayout`の構造・状態表示を参照しつつ、場所カテゴリでは通常ナビゲーションとして最小のclient境界にする。

## Decision 7: URL不在とデータエラーを分離する

### Decision

- 未知・空・不正なカテゴリURLと場所詳細URLは通常の404にする。feature固有の404ページや404からの戻りリンクは追加しない。
- CDN fetch、HTTP、JSON decode、必須フィールド検証、重複IDの失敗は、URLが存在するデータエラーとして日本語で表示する。
- `loadKeyLocationsData`の空配列成功化を詳細・カテゴリの不在判定に使わず、status-preserving境界を通す。

### Rationale

URL不在と、存在するページのデータ破損・取得失敗を同じ画面へ収束させると、404、再試行、運用障害の意味が曖昧になる。Next.js標準の404をURL識別子境界に使い、データエラーは既存の日本語状態へ残す。

## Decision 8: 不要ロジックは削除ゲートを通して根こそぎ除去する

### Decision

- 後方互換用の別名ルート、旧client fetch、住所検索状態、場所ページ専用geocode/rate-limit分岐、移行後に未使用となるtab/state/importは、新しい契約がGreenになった後に削除する。
- 削除候補は、実行時production consumerの参照調査と、削除後の負の検索で確認する。テスト・fixture・履歴資料だけの残存はproduction consumerとは区別する。
- 旧経路を残すfallback、compatibility redirect、隠れたfeature flag、未使用exportで保険をかけない。
- 削除は対象ごとの小さな作業単位にし、代替テスト、fresh test review、削除、focused GREEN、親所有のproduction verificationの順に行う。production reviewは独立taskにしない。

### Rationale

「新しいページを追加する」だけでは、旧ページ、旧loader、旧state、旧API分岐が残り、JavaScript削減とKISSの効果を失う。削除の安全性は、曖昧な最終掃除ではなく、候補ごとの参照境界と負の検索で検証できる。

### Alternatives considered

- **最後に一括で未使用コードを掃除する**: どのテスト・新実装に依存するかが曖昧になり、削除漏れと過剰削除を同時に招くため不採用。
- **旧経路をredirect/aliasで残す**: 憲章の後方互換を目的とした複雑化禁止と、今回のURL整理に反するため不採用。
- **lintやtree-shakingに任せる**: runtime route、CSS、状態分岐、外部API呼び出しの不要性を証明できないため不採用。

## Evidence / official references

- Current route query serialization: `src/lib/transit/route-search-query.ts:25-33,68-75,112-124`
- Current location client data loading and nearby state: `src/app/locations/page.tsx:30-110,143-259`
- Current area grouping/distance utilities: `src/lib/location/location-list-state.ts:94-172`, `src/utils/clientGeoUtils.ts:20-140`
- Current client category tabs: `src/components/ui/CategoryTabs.tsx:1-81`
- Discussion navigation reference: `src/components/discussion/DiscussionManagementTabLayout.tsx:127-160`
- Location status-preserving loader: `src/utils/addressLoader.ts:143-163`
- Location resolver: `src/lib/location/location-detail-resolver.ts:122-176`
- Next.js 15 `generateStaticParams`: https://nextjs.org/docs/15/app/api-reference/functions/generate-static-params
- Next.js 15 route segment configuration: https://nextjs.org/docs/15/app/api-reference/file-conventions/route-segment-config
