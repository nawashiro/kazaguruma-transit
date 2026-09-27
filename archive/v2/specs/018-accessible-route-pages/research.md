# Research: 認証・場所詳細・レート制限の専用ページ化

**Feature**: [spec.md](./spec.md)
**Phase**: 0 — Outline & Research
**Date**: 2026-08-14
**Repository**: `/opt/data/kazaguruma-transit`
**Branch / HEAD**: `fix/issue-67-semantic-a11y-navi` / `aed97c28e9a0c618ad4818dcda6a4ace5e27b286`

## 調査方法と前提

既存のApp Routerページ、認証コンテキスト、場所データローダー、レート制限境界、関連テストを読み取り専用で調査した。3経路を独立調査し、既存のdirty変更は保持した。調査中のファイル作成・変更、stage、commit、pushはない。

調査対象の共通前提は次のとおりである。

- Issue #67の作業単位1〜3（入力ラベル、通常ナビゲーション、ネイティブラジオ）は維持する。
- 作業単位4はnative dialogの統一ではなく、通常ページへの遷移へ置き換える。
- 既存のパスキー認証、場所データ、目的地設定、レート制限の閾値・時間窓は変更しない。
- 認証後に投稿・評価などの副作用を自動再開しない。
- 仕様の戻り先は任意URLではなく、許可済みの同一サイト内遷移に限定する。

## Decision 1: 認証は固定モードの専用ページにする

### Decision

- `/login`はログイン専用、`/signup`はアカウント作成専用とする。
- 両ページは通常のリンクで相互に移動できる。
- 両ページは共通の認証フォーム表示・状態処理を共有できるが、ページの主見出し、metadata、フォームモードは分離する。
- `AuthProvider`、`useAuth`、`login`、`createAccount(passkeyName?)`、既存のローカル認証情報、署名処理は変更しない。
- 認証入口から渡す戻り先は、現在画面の相対pathとqueryだけを受け付ける。外部origin、protocol-relative URL、認証ページ自身、API・静的資産、不正値は拒否し、`/`へ戻す。
- 戻り先は画面だけを表す。投稿、評価、会話作成、編集、モデレーター申請のaction・payload・draft・再実行フラグを持ち回らない。
- 成功時と画面上のキャンセル／戻る時は、ブラウザ履歴や外部referrerに依存せず、許可済みの戻り先へ明示的に置換する。
- パスキーの失敗・キャンセルはページに留め、signupのパスキー名・利用規約同意・プライバシー同意を保持する。試行単位のエラーを表示し、別ページの古いエラーをそのまま表示しない。

### Rationale

現在の`LoginModal`は、ログイン／作成mode、tabpanel、ArrowLeft/ArrowRight、dialog lifecycle、Escape/cancel、backdrop、opener focus保存、focus復帰、二重submit防止を一つのコンポーネントで扱う。固定モードのページにすれば、タブとdialog固有の契約を認証経路から除去できる。

既存の`login`と`createAccount`はAuthContextが公開する既存操作であり、新しい認証方式を追加する理由はない。AuthProviderはroot layoutから全ページを包むため、ページ遷移後も認証状態を共有できる。一方、AuthContextにはページ間のerrorを明示的に消す公開操作がないため、ページ側が各試行のrejectをローカルに表示する方が変更範囲を抑えられる。

`/routes`は検索queryなしでは検索結果を復元できず、mount時のAPI要求も持つ。したがって戻り先は相対path/queryを安全に保持する必要があるが、元の副作用を再送してはならない。

### Alternatives considered

- **LoginModalを残して表示制御だけ共通化する**: tab、dialog、focus、backdrop、Escape契約を残すため、今回の目的に反する。
- **`/auth?mode=login|signup`の単一ページにする**: mode切替状態を残し、`/login`と`/signup`の明示的なページ目的を失う。
- **`router.back()`や`document.referrer`だけで戻る**: 直接アクセスや外部referrer時の安全なfallbackを保証できない。
- **絶対URL、任意callback、action tokenを受け付ける**: open redirectや意図しない副作用再開を招く。
- **投稿本文・評価対象などをsessionStorageやURLに保存する**: 明示的な再操作なしの再開に近く、仕様の非目標である。
- **AuthContextにclearErrorを追加する**: 可能だが、この移行に不要な公開API変更であり、試行単位エラーの方が小さい。

### Evidence

- 認証公開契約: `src/lib/auth/auth-context.tsx:31-40,73-80,159-193,195-294,363-392`
- 全ページを包むAuthProvider: `src/app/layout.tsx:57-83`
- 現行LoginModalの状態とdialog: `src/components/discussion/LoginModal.tsx:12-81,132-151`
- 現行tab/tabpanel・signupフォーム・エラー・送信: `src/components/discussion/LoginModal.tsx:162-234,282-401,403-465`
- 認証入口: `src/components/discussion/BusStopDiscussion.tsx:105-150,300-307`; `src/app/settings/page.tsx:39-48,216-223,336-339`; `src/app/discussions/create/page.tsx:33-47,63-138,416-419`; `src/app/discussions/[naddr]/page.tsx:79-87,337-439,864-871`; `src/app/discussions/[naddr]/edit/page.tsx:117-138,214-388,1084-1086`; `src/app/discussions/[naddr]/moderators/page.tsx:439`
- 既存LoginModalテスト: `src/components/discussion/__tests__/LoginModal.test.tsx:86-316`
- ルートmetadata・PageHeaderパターン: `src/app/locations/layout.tsx:1-22`; `src/components/layouts/PageHeader.tsx:18-24`

## Decision 2: 場所詳細は`/location-detail/[id]`で直接解決する

### Decision

- `KeyLocation.id`を正規識別子として`/location-detail/[id]`に使う。
- IDは空でなく安定し、データセット全体で一意でなければならない。重複・不正形式は任意の先頭要素へ解決せず、詳細取得エラーにする。
- `/locations`のカードは、同じ要約表示・見た目を維持したnative navigation linkへ置き換える。
- 詳細ページは一覧の`selectedLocation`状態に依存せず、URLのIDから場所データを再解決する。
- loading、成功、識別子不在、データ取得失敗を区別する。失敗時も日本語の主見出し、原因説明、`/locations`への戻り導線を失わない。
- 成功時は現在のモーダルと同じ意味の場所名、説明、地域、画像、提供情報、ライセンス、外部リンク、目的地設定を表示する。
- 目的地設定は既存の`convertToLocation`と`/?destination=<encoded JSON>`契約を再利用する。
- URL IDの生成・解決は、データの不正なslashや曖昧な重複を隠さない。実データ全件はCDN取得のため、計画内でfixtureによる一意性・URL境界テストと実データ検証を分ける。

### Rationale

場所詳細は共有、再読み込み、ブラウザ履歴、直接アクセスが必要な独立した情報資源である。現状はカードbuttonのクリックでのみモーダルを開くため、URLから復元する経路がない。native linkにすれば、通常のナビゲーションとして支援技術・キーボード・履歴の契約を利用できる。

`KeyLocation`にはIDがあるが、ローダーは型キャストして返し、ID一意性やURL安全性を検証していない。さらにCDN取得失敗を空配列へ変換するため、識別子不在とデータ取得失敗を同一視してはならない。

既存の目的地設定は、場所から座標と名前を抽出してホームのURLへ渡し、ホーム側で検証・復元する契約になっている。この契約を再利用すれば、新しい永続化や目的地形式を追加せずに主要操作を維持できる。

### Alternatives considered

- **モーダルを残して詳細リンクだけ追加する**: 一覧に二つの詳細経路と二重のアクセシビリティ契約が残る。
- **場所全体をquery、sessionStorage、JSONで渡す**: URL共有、再読み込み、データ更新との整合を損なう。
- **category、表示名、配列index、座標をURLキーにする**: 安定性・一意性・仕様のURL形状を満たさない。
- **Nextの既定not-foundだけに任せる**: 日本語の原因説明と一覧への導線を保証できない。
- **CDN失敗を空配列としてnot-found扱いにする／重複IDを先頭へ解決する**: 失敗や曖昧性を隠すため不採用。

### Evidence

- KeyLocationとCDNローダー: `src/utils/addressLoader.ts:15-28,55-69`
- 場所一覧の状態・選択・モーダル: `src/app/locations/page.tsx:87-176,354-371,542-590,724-732`
- 現行カードのbutton: `src/app/locations/page.tsx:33-83`
- 詳細表示と目的地操作: `src/components/features/LocationDetailModal.tsx:80-191`
- 地域名取得: `src/app/locations/page.tsx:354-367`; `src/lib/location/location-list-state.ts:153-172`
- 目的地遷移とホーム側復元: `src/app/locations/page.tsx:209-215`; `src/app/page.tsx:31-47`
- 共通layout/main・見出し: `src/app/layout.tsx:57-84`; `src/components/layouts/SidebarLayout.tsx:100-104`; `src/components/layouts/PageHeader.tsx:18-24`
- 動的ルートと不正/不在表示の既存例: `src/app/discussions/[naddr]/page.tsx:53-55,306-323,465-502`
- native Linkの既存例: `src/components/features/RouteSearchResults.tsx:40-48`
- 現在の関連focusテスト（移行時に置換対象）: `src/app/locations/__tests__/page.dialog-focus.test.tsx:105-123`; `src/components/features/__tests__/LocationDetailModal.test.tsx:130-217`

## Decision 3: レート制限は通信を行わない`/rate-limit`へ集約する

### Decision

- `RateLimitModal`を残したままにせず、既存の4つの実行経路から`/rate-limit`へ一度だけ遷移する。
- 429かつ`limitExceeded`の判定は各API・データ境界に残し、UIでは明示的な`rate-limited`状態から専用ページへ移動する。
- `/rate-limit`の表示、直接アクセス、再読み込みではfetch、useEffectによる再試行、外部API要求を行わない。
- 既存の主文言（リクエスト制限、1時間60回、1時間待つ、ブラウザを閉じても継続）を通常の見出し・本文として維持する。
- 戻り先はraw URLではなく、allowlist済みの`source=home|locations|routes`に限定する。`home`は`/`、`locations`は`/locations`、`routes`は`/`へ戻し、未指定・不正値は`/locations`へ戻す。
- `/routes`へ直接戻さない。現在の経路検索結果は有効なqueryをmount時にfetchするため、戻り先の表示だけで外部要求を再発火させない。
- 通常のquota超過と、サーバー側fail-closed 429が同じ`limitExceeded`を持つ現状は隣接課題として記録する。今回のページ化ではレート制限の閾値・時間窓・APIポリシーを変更せず、backend契約変更は別途判断する。

### Rationale

レート制限は住所検索、GPS逆ジオコーディング、場所一覧の検索、経路検索の4経路から発生する。各経路がmodalのopen state、close callback、error表示を個別に持つため、dialog固有の契約が分散している。

専用ページは説明を通常の文書として表示でき、直接URL・再読み込み・履歴の意味を標準化できる。ページ表示自体がネットワーク要求を行わなければ、レート制限直後の重複検索や、経路検索結果のmount時fetchの予期しない再発火を防げる。

`/rate-limit`は共通main、PageHeader、通常Link、`role=status`または`role=alert`の既存パターンに合わせられる。モーダルの「閉じる」は、発生元へ戻る明示リンクとして置き換える。

### Alternatives considered

- **Modalを維持してnative dialogのfocus管理を強化する**: 4経路に状態・focus・Escape・backdropを残し、専用ページ化の目的に反する。
- **常に`/locations`へ戻す**: homeの検索とroutesの経路検索で文脈を失う。
- **raw URLや検索条件を受けてページ表示時に再試行する**: 任意遷移先、open redirect、重複API要求を生む。
- **`router.back()`だけに任せる**: 直接アクセスや履歴なし時の戻り先が不定になる。標準の戻る操作は妨げず、正規導線としてallowlist済みLinkを提供する。
- **fail-closed 429のbackend契約を同時に変更する**: 今回のUI移行の必須条件ではなく、既存のレート制限ポリシー変更を混入させるため別課題とする。

### Evidence

- レート制限の閾値と429: `src/lib/api/rate-limit-middleware.ts:6-8,55-64,75-86`
- 共有geocode状態と429変換: `src/lib/location/geocoding-search.ts:3-10,24-38`; `src/components/features/useGeocodingSearch.ts:7-29`
- 場所一覧の別状態と429変換: `src/lib/location/location-list-state.ts:24-34,119-150`; `src/app/locations/page.tsx:101-118,274-334,734-739`
- Homeの出発地・目的地・GPS経路: `src/components/features/OriginSelector.tsx:25-30,50-69,144-149`; `src/components/features/DestinationSelector.tsx:20-27,70-75`
- 経路検索の429とmount時要求: `src/components/features/RouteSearchResults.tsx:76-105,149-169`
- 現行RateLimitModalの主要文言とdialog操作: `src/components/features/RateLimitModal.tsx:58-123`
- 共通ページの状態・metadata例: `src/components/layouts/PageHeader.tsx:18-24`; `src/app/locations/layout.tsx:1-22`; `src/app/usage/layout.tsx:1-14`

## Cross-cutting accessibility and UX decision

通常ページへの遷移では、dialogの`showModal`、backdrop、Escape、focus trap、opener focus復帰を契約にしない。その代わり、各ページに次を要求する。

- ページタイトル、主見出し、共通`main`ランドマーク。
- native `form`、`label`、`fieldset`、`legend`、`Link`、`button`。
- エラーと状態の日本語表示、および`role=alert`または`aria-live`。
- キーボードで主要操作、相互リンク、戻り導線へ到達できる論理的な順序。
- 認証失敗時の入力値・同意状態保持、場所詳細の失敗時の主情報保持、レート制限ページの通信なし。

## Phase 0 conclusion

Phase 0で未解決の仕様マーカーはない。実装上の検証課題（CDN実データのID一意性、URLセグメント境界、空配列へ隠れているtransport failure、各429発生元の統合テスト）はPhase 1のデータモデル、UI契約、quickstart、後続tasksに明示する。`plan.md`のPhase 1設計では、既存のdirty変更を上書きせず、新しい専用ページの責務境界と、`addressLoader.ts`のstatus-preserving最小拡張を含むテスト置換範囲を固定する。
