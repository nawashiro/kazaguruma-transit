# Implementation Plan: 認証・場所詳細・レート制限の専用ページ化

**Branch**: `fix/issue-67-semantic-a11y-navi` | **Date**: 2026-08-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/018-accessible-route-pages/spec.md`

## Summary

Issue #67の作業単位4を、native dialogの統一から通常ページへの遷移へ置き換える。`/login`と`/signup`は固定モードのPasskey認証ページ、`/location-detail/[id]`はURL IDから再解決する場所詳細ページ、`/rate-limit`は通信を行わないレート制限説明ページとする。既存のAuthContext、場所データ、目的地設定、429判定、レート制限ポリシーは維持し、認証前の投稿・評価を自動再開しない。戻り先は安全な同一サイト内のallowlist契約に限定する。

## Technical Context

**Language/Version**: TypeScript 5 strict、React 19、Next.js 15 App Router、Node.js 22.x

**Primary Dependencies**: Next.js App Router、React Testing Library、Jest、Tailwind CSS 4、DaisyUI 5、既存AuthContext、`nosskey-sdk`、既存location loader、既存Nostr/Transitサービス

**Storage**: 新規永続化なし。既存のブラウザ内Passkey/PWK状態、CDN場所データ、既存API・SQLite/Prisma境界を利用する。場所loaderだけはtransport statusを保持する最小拡張とし、正本データやAPI policyは変更しない。

**Testing**: Jest + React Testing Library、既存ページ契約テスト、必要に応じたPuppeteerによる実ブラウザ確認、TypeScript、ESLint、build

**Target Platform**: モダンブラウザ上のNext.js App Router Webアプリ。キーボード操作と支援技術の通常ページ利用を対象とする。

**Project Type**: Web application

**Performance Goals**:

- `/rate-limit`の表示、直接アクセス、再読み込みで追加fetch・外部API要求を0件にする。
- 場所詳細は一覧の選択stateに依存せず、直接URLから一度のデータ解決で表示する。
- 認証ページは既存認証操作を二重送信せず、既存のAuthProvider状態共有を利用する。

**Constraints**:

- native dialog、tablist、modal backdrop、dialog focus trapを新しい専用ページの契約にしない。
- 新しい認証方式、サーバーセッション、action payload永続化を追加しない。
- 投稿・評価・会話操作を認証後に自動再開しない。
- raw return URLを受け付けず、認証は安全な相対path/query、レート制限は`source=home|locations|routes`だけを受け付ける。
- 既存の見た目、主要操作、ラベル・nav・native radio改善を維持する。
- CDN実データのID一意性はfixtureだけで断定せず、実データ検証タスクを別に記録する。

**Scale/Scope**:

- 認証ページ2つと共通フォーム境界1つ。
- LoginModalの実行時入口6箇所をページ導線へ移行。
- RateLimitModalの実行時入口4箇所をページ導線へ移行。
- `/locations`のカード一覧と`/location-detail/[id]`の詳細ページを移行。
- 既存のmodal専用テストを、ページ・リンク・直接アクセス・状態契約テストへ置き換える。

## Constitution Check

*GATE: Phase 0前に確認済み。Phase 1設計後に再確認する。*

| Gate | Result | 根拠 |
|---|---|---|
| 明確な命名 | PASS | `AuthenticationPage`、`SafeReturnTarget`、`LocationDetailPageState`、`RateLimitSource`など、利用者目的と状態を表す名前を使う。 |
| 単純なロジック | PASS | tab/dialog lifecycleを除去し、認証、場所解決、rate-limit source検証を境界ごとに分ける。 |
| 構造化 | PASS | UIは`src/app`/`src/components`、認証・場所・遷移規則は対応する`src/lib`へ分離する。 |
| 型安全 | PASS | mode、source、page state、return targetを狭いunion/明示型で表し、`any`を新規追加しない。 |
| Test-first | PASS | 各ページ・安全な遷移・ID解決・429発生元の回帰を、実装前のテストタスクとして定義する。 |
| Accessibility & UX | PASS | 通常のmain、h1、label、fieldset/legend、Link、button、alert/status、論理的なkeyboard順を契約化する。 |
| 既存データ・認証境界 | PASS | AuthProvider、CDN場所データ、既存目的地query、429ポリシーを再利用し、新規永続化を追加しない。 |
| セキュリティ | PASS | 外部return URL、protocol-relative URL、API/static path、raw rate-limit URLを拒否する。 |
| レビュー可能性 | PASS | ページ、共有form、resolver、source allowlist、既存入口、テストを垂直sliceとして分割できる。 |

## Project Structure

### Documentation (this feature)

```text
specs/018-accessible-route-pages/
├── spec.md
├── checklists/requirements.md
├── plan.md
├── research.md
├── data-model.md
├── evidence/key-locations-validation.json # 実CDN ID検証の証跡（実装時生成）
├── contracts/ui-page-contract.md
├── quickstart.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── login/page.tsx
│   ├── signup/page.tsx
│   ├── rate-limit/page.tsx
│   ├── location-detail/[id]/page.tsx
│   ├── locations/page.tsx
│   ├── settings/page.tsx
│   ├── discussions/create/page.tsx
│   ├── discussions/[naddr]/page.tsx
│   ├── discussions/[naddr]/edit/page.tsx
│   └── discussions/[naddr]/moderators/page.tsx
├── components/
│   ├── auth/AuthenticationForm.tsx       # login/signup共通表示・試行状態
│   ├── features/LocationDetailContent.tsx # 詳細表示・主要操作の共有境界
│   ├── features/LocationCard.tsx          # 一覧要約とnative Link
│   └── layouts/PageHeader.tsx
├── lib/
│   ├── auth/auth-context.tsx              # 既存、契約を維持
│   ├── navigation/safe-return-target.ts   # 認証戻り先検証
│   ├── navigation/rate-limit-source.ts   # source allowlistと固定戻り先
│   ├── location/location-detail-resolver.ts # ID解決と不在/失敗分類
│   ├── location/geocoding-search.ts      # 既存rate-limited境界
│   └── location/location-list-state.ts    # 既存rate-limited境界
├── utils/
│   ├── addressLoader.ts                   # status-preserving location data boundary
│   └── __tests__/addressLoader.test.ts
└── types/
    └── access-route-pages.ts               # return/source/page-state shared unions

src/**/__tests__/
├── app/login/__tests__/page.test.tsx
├── app/signup/__tests__/page.test.tsx
├── app/rate-limit/__tests__/page.test.tsx
├── app/location-detail/[id]/__tests__/page.test.tsx
├── app/locations/__tests__/page.test.tsx  # card/link/既存主要操作
├── lib/navigation/__tests__/safe-return-target.test.ts
├── lib/navigation/__tests__/rate-limit-source.test.ts
├── lib/location/__tests__/location-detail-resolver.test.ts
└── utils/__tests__/addressLoader.test.ts
```

**Structure Decision**: 単一のNext.js App Router構造を維持する。ページ固有の文書・URLは`src/app`、複数ページで共有するフォーム・詳細表示・遷移検証は`src/components`または`src/lib`、既存の認証・API境界は変更せずに利用する。場所データだけは、`src/utils/addressLoader.ts`へtransport failureを保持する最小のstatus-preserving境界を追加する。実装時に既存の`LocationCard`抽出変更が確定している場合は重複コンポーネントを作らず、その境界を再利用する。

## Phase 0 Research Summary

Phase 0の成果は[research.md](./research.md)に記録した。

- 認証: 固定modeページ、試行単位error、安全な相対return target、action非再開。
- 場所詳細: `KeyLocation.id`、native Link、直接URL再解決、not-found/error/data-load-error分離。
- レート制限: 4入口から一度だけ`/rate-limit`、通信なし、source allowlist、`/routes`へ直接戻さない。
- 共通UI: main、h1、label、fieldset/legend、Link/button、alert/status、keyboard順。

## Phase 1 Design

### 1. Authentication route and form

1. 既存`LoginModal`から認証処理と表示責務を分離し、共通の固定modeフォーム境界を設計する。
2. `/login`と`/signup`はmodeをpropsまたはrouteで固定し、tablist・dialog・backdrop状態を持たない。
3. `login()`/`createAccount()`のrejectをページ試行単位のerrorへ変換し、入力・同意状態を保持する。
4. `returnTo`を安全に解析し、無効値は`/`へ置換する。action payloadやdraftは受けない。
5. 既存6入口を内部Linkまたはrouter遷移へ変更し、各画面の既存作業を認証後に自動再実行しない。

### 2. Location detail route

1. `src/utils/addressLoader.ts`にstatus-preservingな場所データ取得境界を作り、空・重複・不正・取得失敗を成功データと区別する。既存loaderが返していた空配列を詳細ページの不在判定へ流用しない。
2. `/locations`のカードをnative Linkへ移行し、要約表示と見た目を維持する。
3. `/location-detail/[id]`はURLからデータを解決し、loading/success/not-found/error/data-load-errorを文書として表示する。
4. 詳細表示と既存の目的地設定を共有表示境界へ移し、`convertToLocation`と既存home queryを再利用する。
5. `key_locations.json`のversioned CDN実データでID一意性・空値・slashを検証し、version・URL・件数・重複IDを証跡として保存する。fixtureでは重複・空・HTTP/JSON failure境界を網羅する。

### 3. Rate-limit route and source migration

1. `home`、`locations`、`routes`の各発生元から、source allowlist付きの`/rate-limit`へ一度だけ遷移する。
2. 既存429/`limitExceeded`判定を維持し、ページ表示はネットワーク要求を行わない。
3. 既存の制限文言を通常の見出し・本文へ移し、allowlist済みの固定戻りLinkを表示する。
4. 既存の4入口のmodal stateとRateLimitModal依存を除去し、error/state表示との二重通知を整理する。
5. 通常quotaとfail-closed 429の詳細文言差は、必要なら別設計へ切り出し、本featureで閾値・middlewareを変更しない。

### 4. Cross-cutting verification

1. ページタイトル、h1/main、label、fieldset/legend、Link/button、alert/statusをRTLと実ブラウザで確認する。
2. direct URL、keyboard traversal、back/explicit return、invalid input、loading/errorをページ単位で検証する。
3. rate-limit pageの表示・再読み込み前後のfetch/API callを0件で確認する。
4. 旧modal専用テストを削除・置換する前に、既存の認証、場所主要操作、429判定テストを移行先の公開契約へ写し取る。
5. `tsc`、lint、focused Jest、full Jest、build、`git diff --check`を実行する。

## Implementation Sequence (for tasks phase)

1. 共有型と安全な遷移境界のREDテスト（return target、rate-limit source、location ID resolver）。
2. 認証共通フォームと`/login`・`/signup`のページRED、独立テストレビュー、実装、GREEN、コードレビュー。
3. 全認証入口のページ遷移RED、独立テストレビュー、実装、関連画面GREEN。
4. 場所ID resolver・native Link・`/location-detail/[id]`のRED、独立テストレビュー、実装、GREEN、実ブラウザ確認。
5. rate-limit source・通信なしページ・4入口移行のRED、独立テストレビュー、実装、GREEN、API呼出確認。
6. 旧modalの削除・テスト置換、全体回帰、TypeScript/lint/build、独立本番レビュー、commit前scope確認。

## Constitution Re-check after Phase 1 design

### WCAG 2.2 AA review references

設計ゲートでは、リポジトリ内の次のUnderstanding文書を参照した。実装・レビュー時も、該当する達成基準の本文と適用範囲を確認する。

- [1.3.1 Info and Relationships](../../docs/accessibility/Understanding/1-3/1-3-1.md): `main`、見出し、label、fieldset/legendの構造。
- [2.1.1 Keyboard](../../docs/accessibility/Understanding/2-1/2-1-1.md): リンク、フォーム、主要操作のkeyboard相当操作。
- [2.4.2 Page Titled](../../docs/accessibility/Understanding/2-4/2-4-2.md): 各専用ページの目的を表すtitle。
- [2.4.3 Focus Order](../../docs/accessibility/Understanding/2-4/2-4-3.md): 文書順と主要操作の論理的なfocus順。
- [2.4.4 Link Purpose (In Context)](../../docs/accessibility/Understanding/2-4/2-4-4.md): 認証相互リンク、詳細リンク、発生元への戻りリンクの目的。
- [2.4.6 Headings and Labels](../../docs/accessibility/Understanding/2-4/2-4-6.md): 主見出し、フォームlabel、エラー説明の明確さ。
- [3.3.1 Error Identification](../../docs/accessibility/Understanding/3-3/3-3-1.md): 認証入力エラーの対象と日本語説明。
- [3.3.2 Labels or Instructions](../../docs/accessibility/Understanding/3-3/3-3-2.md): Passkey名・同意入力のlabel/instruction。
- [4.1.3 Status Messages](../../docs/accessibility/Understanding/4-1/4-1-3.md): loading・認証失敗・レート制限などfocusを奪わない状態通知。

| Gate | Result | 根拠 |
|---|---|---|
| 明確な命名 | PASS | route、state、source、return target、resolverの責務を分離した。 |
| 単純なロジック | PASS | modal lifecycleを追加せず、ページ遷移とallowlist検証へ置き換えた。 |
| 構造化 | PASS | UI、navigation policy、location resolution、既存API境界を分離した。 |
| 型安全 | PASS | `mode`、`source`、page stateを閉じた型として扱う計画である。 |
| Test-first | PASS | 共有境界→ページ→呼び出し元→削除の順にREDとレビューゲートを置く。 |
| Accessibility & UX | PASS | 通常のdocument semanticsを優先し、ページ状態・エラー・keyboard順を検証する。 |
| セキュリティ | PASS | return targetとrate sourceをallowlistし、任意URLとaction payloadを受けない。 |
| 既存操作維持 | PASS | Passkey、場所詳細、目的地設定、429判定、既存UI意味を再利用する。 |

## Complexity Tracking

違反なし。追加のarchitecture、storage、frameworkは導入しないため、正当化すべきconstitution violationはない。
