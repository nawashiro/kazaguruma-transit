# Tasks: 認証・場所詳細・レート制限の専用ページ化

**Input**: Design documents from `specs/018-accessible-route-pages/`

**Prerequisites**: `plan.md`、`spec.md`、`research.md`、`data-model.md`、`contracts/ui-page-contract.md`、`quickstart.md`

**Repository**: `/opt/data/kazaguruma-transit`
**Branch**: `fix/issue-67-semantic-a11y-navi`
**Baseline**: `aed97c28e9a0c618ad4818dcda6a4ace5e27b286`

## Task conventions

- すべてのテストタスクは、実装前に意味のあるRED（未実装の公開契約に対するassertion failure）を確認する。
- `status=completed`、子エージェントの自己報告、テスト実行の開始通知だけではレビューゲートを通過したとみなさない。
- テストコードを変更した場合は、直前のtest-code review verdictを無効とし、RED再実行とfresh reviewをやり直す。
- 独立レビューは読み取り専用のfresh subagentへ委任し、`SUBAGENT_STATUS: COMPLETE`と明示的な`VERDICT: PASS`を要求する。`MAX_ITERATIONS`や未完了報告はPASSではない。
- 既存のdirty変更（本番コード、旧modalテスト、`.specify/feature.json`）をreset、clean、stage、上書きしない。
- `npm run build`は既存規約によりPrisma/GTFS処理を伴うため、実装が揃った最終検証でのみ実行する。

## Phase 1: Setup

**Purpose**: 既存Next.jsプロジェクトに追加依存や新規永続化を持ち込まず、作業境界を固定する。

- [ ] T001 `package.json`、`tsconfig.json`、`jest.config.*`、`AGENTS.md`、`specs/018-accessible-route-pages/plan.md`を照合し、Next.js 15 / React 19 / TypeScript strict / Jest + RTLの既存環境と、今回変更しない依存・永続化境界を記録する。
- [ ] T002 `git status --short --untracked-files=all`、`git diff --name-only`、`git diff --check`を実行し、T001の環境確認後に`src/app/locations/page.tsx`、旧modal本体・テスト、`.specify/feature.json`などの既存dirtyを今回の作業対象から除外する境界を`specs/018-accessible-route-pages/tasks.md`の作業記録へ反映する。

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 全ユーザーストーリーが共有する安全な遷移、状態分類、ID解決の基盤をテスト先行で確定する。

**⚠️ CRITICAL**: T006のfresh test-code reviewがPASSになるまで、専用ページや呼び出し元の本番コードを変更しない。

### Tests for Foundational contracts

- [ ] T003 [P] `src/lib/navigation/__tests__/safe-return-target.test.ts`に、相対path + queryの許可、`/routes` query保持、外部origin、`//`、credentials、認証route、API/static path、不正値、action/payload/draftの拒否と`/` fallbackを検証するREDテストを作成する。実行: `npm test -- --runInBand --runTestsByPath src/lib/navigation/__tests__/safe-return-target.test.ts`。
- [ ] T004 [P] `src/lib/navigation/__tests__/rate-limit-source.test.ts`に、`home → /`、`locations → /locations`、`routes → /`、未指定・不正値 → `/locations`の固定mappingとraw return URL拒否を検証するREDテストを作成する。実行: `npm test -- --runInBand --runTestsByPath src/lib/navigation/__tests__/rate-limit-source.test.ts`。
- [ ] T005 [P] `src/utils/__tests__/addressLoader.test.ts`と`src/lib/location/__tests__/location-detail-resolver.test.ts`に、空ID、単一一致、未知ID、重複ID、空配列、HTTP/JSON transport failure、地域・任意表示項目の欠落を、`success`、`not-found`、`error`、`data-load-error`、主要情報保持として区別するREDテストを作成する。実行: `npm test -- --runInBand --runTestsByPath src/utils/__tests__/addressLoader.test.ts src/lib/location/__tests__/location-detail-resolver.test.ts`。

### Foundational test-code review gate

- [ ] T006 `src/lib/navigation/__tests__/safe-return-target.test.ts`、`src/lib/navigation/__tests__/rate-limit-source.test.ts`、`src/utils/__tests__/addressLoader.test.ts`、`src/lib/location/__tests__/location-detail-resolver.test.ts`のtest-code reviewをfresh read-only subagentへ委任し、fixtureの非空性、外部遷移・重複ID・transport failureの境界、意味のあるRED、実装詳細への過結合を確認する。`SUBAGENT_STATUS: COMPLETE`と`VERDICT: PASS`が返るまでT007〜T009を開始しない。

### Foundational implementation

- [ ] T007 [P] `src/types/access-route-pages.ts`にSafeReturnTarget、RateLimitSource、LocationPageStateの共有unionを定義し、`src/lib/navigation/safe-return-target.ts`に同一originへ解決できる相対path + queryだけを許可し、認証loop・API/static path・protocol-relative URL・credentials・外部origin・action payloadを拒否する型付きvalidatorと`/` fallbackを実装する。T003のREDをGREENにする。
- [ ] T008 [P] `src/lib/navigation/rate-limit-source.ts`に、`RateLimitSource` unionとallowlist済みsource-to-path mappingを実装し、raw URLを一切解釈しない。T004のREDをGREENにする。
- [ ] T009 [P] `src/utils/addressLoader.ts`に`loadKeyLocationsDataResult()`を追加してHTTP/JSON/fetch failureを`{ status: "error" }`として保持し、`src/lib/location/location-detail-resolver.ts`にIDの一意性・空値・不正値を検証して`loading/success/not-found/error/data-load-error`へ分類するresolverを実装する。T005のREDをGREENにする。
- [ ] T010 `src/lib/navigation/__tests__/safe-return-target.test.ts`、`src/lib/navigation/__tests__/rate-limit-source.test.ts`、`src/utils/__tests__/addressLoader.test.ts`、`src/lib/location/__tests__/location-detail-resolver.test.ts`を実行し、`npx tsc --noEmit --incremental false`と`git diff --check`を通す。さらに`src/utils/addressLoader.ts`が参照するversioned CDNの`key_locations.json`を、`NEXT_PUBLIC_LOCATIONS_DATA_VERSION`（未指定時`1.0.0`）から読み取り、空ID・重複ID・`/`を含むIDを終了コード1で拒否し、version・URL・件数・検証済みID数・重複ID一覧を`specs/018-accessible-route-pages/evidence/key-locations-validation.json`へ保存する。T007〜T009後の基盤GREEN、型、実データ検証終了コード、証跡を記録する。

**Checkpoint**: 安全な認証戻り先、rate-limit source、場所ID解決が独立して検証でき、各ページ実装へ進める。

---

## Phase 3: User Story 1 - ログインとアカウント作成を専用ページで行う (Priority: P1) 🎯 MVP

**Goal**: `/login`と`/signup`を固定modeの通常ページとして提供し、既存Passkey処理・入力保持・相互リンク・安全な戻り先を維持する。

**Independent Test**: 未認証の設定またはDiscussion導線からページへ移動し、main/h1/form/label、Passkey送信、失敗時の入力保持、相互リンク、成功時のsafe return、認証前副作用の非再開を確認する。

### Tests for User Story 1

> **RED first**: T015のreviewがPASSになるまで、認証ページ・入口の本番コードを変更しない。

- [ ] T011 [P] [US1] `src/components/auth/__tests__/AuthenticationForm.test.tsx`に、login/signup固定mode、native form、h1との文書関係、明示label、signupのPasskey名・利用規約・プライバシー同意、attempt-local error、二重送信防止、入力保持を検証するREDテストを作成する。実行: `npm test -- --runInBand --runTestsByPath src/components/auth/__tests__/AuthenticationForm.test.tsx`。
- [ ] T012 [P] [US1] `src/app/login/__tests__/page.test.tsx`に、直接アクセス時のtitle/main/h1、既存`login()`の一回呼出し、Passkey失敗・cancelの日本語alert、`/signup`通常link、安全な`returnTo`置換、action非再開を検証するREDテストを作成する。実行: `npm test -- --runInBand --runTestsByPath src/app/login/__tests__/page.test.tsx`。
- [ ] T013 [P] [US1] `src/app/signup/__tests__/page.test.tsx`に、直接アクセス時のtitle/main/h1、Passkey名・2つの同意のlabel/legend、`createAccount(passkeyName)`の一回呼出し、失敗時の入力・同意保持、`/login`通常linkを検証するREDテストを作成する。実行: `npm test -- --runInBand --runTestsByPath src/app/signup/__tests__/page.test.tsx`。
- [ ] T014 [P] [US1] 既存の認証入口テスト（`src/app/settings/__tests__/page.streaming.test.tsx`、`src/app/discussions/create/__tests__/page.test.tsx`、`src/app/discussions/[naddr]/__tests__/page.test.tsx`、`src/app/discussions/[naddr]/edit/__tests__/page.test.tsx`、`src/app/discussions/[naddr]/moderators/__tests__/page.test.tsx`、`src/components/discussion/__tests__/BusStopDiscussion.streaming.test.tsx`）をページ導線契約へ更新し、LoginModalの表示ではなく`/login`遷移と、認証後の自動投稿・評価非再実行をREDとして検証する。
- [ ] T015 `src/components/auth/__tests__/AuthenticationForm.test.tsx`、`src/app/login/__tests__/page.test.tsx`、`src/app/signup/__tests__/page.test.tsx`、T014の既存入口テストをfresh read-only subagentへtest-code reviewとして委任する。native form/label、失敗状態、safe return、action非再開、既存主要操作の保存を確認し、明示的な`VERDICT: PASS`までT016〜T019を開始しない。

### Implementation for User Story 1

- [ ] T016 [P] `src/components/auth/AuthenticationForm.tsx`に、固定`mode`、既存`useAuth()`の`login`/`createAccount`、Passkey名・同意state、attempt-local error、native form/fieldset/legend/label、alert/statusを実装し、dialog/tab/backdrop/focus trapを持ち込まない。
- [ ] T017 [P] `src/app/login/page.tsx`に、ログイン専用のmetadata、共通layout/main、主見出し、`AuthenticationForm mode="login"`、`/signup`link、validated `returnTo`後のrouter.replaceを実装する。
- [ ] T018 [P] `src/app/signup/page.tsx`に、アカウント作成専用のmetadata、共通layout/main、主見出し、`AuthenticationForm mode="signup"`、`/login`link、validated `returnTo`後のrouter.replaceを実装する。
- [ ] T019 [US1] `src/components/discussion/BusStopDiscussion.tsx`、`src/app/settings/page.tsx`、`src/app/discussions/create/page.tsx`、`src/app/discussions/[naddr]/page.tsx`、`src/app/discussions/[naddr]/edit/page.tsx`、`src/app/discussions/[naddr]/moderators/page.tsx`の6入口を、既存のreason・主要操作を維持した`/login`内部遷移へ置き換え、認証後は画面だけを復元して副作用を再送しない。
- [ ] T020 [US1] T011〜T014のfocused Jestを`--runInBand`で実行し、`npx tsc --noEmit --incremental false`、対象ESLint、`git diff --check`を通す。GREENのsuite/test数と、既存AuthContextテスト（`src/lib/auth/__tests__/auth-context.test.tsx`）の非退行結果を記録する。

### User Story 1 production-code review gate

- [ ] T021 [US1] `src/components/auth/AuthenticationForm.tsx`、`src/app/login/page.tsx`、`src/app/signup/page.tsx`、6つの認証入口と関連テストのsettled bytesをfresh read-only subagentへproduction-code reviewとして委任する。既存AuthContext境界、open redirect拒否、認証前副作用非再開、native semantics、scopeを確認し、`VERDICT: PASS`までUS1を完了扱いにしない。

**Checkpoint**: 認証ページを独立して直接開け、6入口から利用でき、Passkey失敗・cancel・入力保持・安全な戻り先を確認できる。

---

## Phase 4: User Story 2 - 場所詳細を直接開いて確認する (Priority: P1)

**Goal**: `/locations`のカードを`/location-detail/[id]`へのnative linkへ置き換え、一覧stateなしの直接アクセス、詳細情報、目的地設定、missing/errorを提供する。

**Independent Test**: 有効なIDを一覧・直接URL・再読み込み・履歴から開き、詳細情報と既存「ここへ行く」を確認する。未知ID・重複ID・CDN failureでは空詳細を出さず日本語説明と`/locations`linkを確認する。

### Tests for User Story 2

> **RED first**: T025のreviewがPASSになるまで、一覧カード・詳細ページの本番コードを変更しない。

- [ ] T022 [P] [US2] `src/app/locations/__tests__/page.test.tsx`と`src/app/locations/__tests__/page.dialog-focus.test.tsx`を、カードのnative `A`要素・non-empty href・ID encoding・要約表示維持・keyboard navigation・既存目的地操作への導線を検証するテストへ更新する。旧modal open/focus-return assertionは専用ページ契約へ置き換える。
- [ ] T023 [P] [US2] `src/app/location-detail/[id]/__tests__/page.test.tsx`に、一覧stateなしの直接アクセス、title/main/h1、loading/success/not-found/error/data-load-error、場所名・説明・地域・提供情報・license・external link・`/locations`戻りlinkを検証するREDテストを作成する。実行時は`--runTestsByPath`で角括弧を含むpathを指定する。
- [ ] T024 [P] [US2] `src/components/features/__tests__/LocationDetailContent.test.tsx`と`src/components/features/__tests__/LocationDetailModal.test.tsx`に、既存詳細表示の意味、任意画像/説明/地域欠落時の主要情報保持、既存`convertToLocation`によるホーム目的地設定、主要callbackを専用ページ・content契約へ置き換えるREDテストを作成する。modal固有のfocus-return assertionは残さない。
- [ ] T025 `src/app/locations/__tests__/page.test.tsx`、`src/app/locations/__tests__/page.dialog-focus.test.tsx`、`src/app/location-detail/[id]/__tests__/page.test.tsx`、`src/components/features/__tests__/LocationDetailContent.test.tsx`、`src/components/features/__tests__/LocationDetailModal.test.tsx`、`src/utils/__tests__/addressLoader.test.ts`、`src/lib/location/__tests__/location-detail-resolver.test.ts`をfresh read-only subagentへtest-code reviewとして委任する。native anchor/href、直接アクセス、loader failureとnot-found/data-load-errorの分離、重複ID、主要操作を確認し、`VERDICT: PASS`までT026〜T029を開始しない。

### Implementation for User Story 2

- [ ] T026 [P] [US2] `src/components/features/LocationCard.tsx`に既存カードの要約・見た目・accessible nameを保ったnative `Link`を実装し、`KeyLocation.id`を安全にURL segmentへ変換する。
- [ ] T027 [P] [US2] `src/components/features/LocationDetailContent.tsx`に既存`LocationDetailModal.tsx`の説明、地域、画像、提供情報、license、external link、目的地設定の意味を、通常ページ用のheading・section・link・buttonとして抽出する。
- [ ] T028 [US2] `src/app/location-detail/[id]/page.tsx`に、URL ID resolver、専用metadata、共通SidebarLayout/main、loading/success/not-found/error/data-load-errorの日本語文書状態、場所一覧への戻りlinkを実装する。Nextの既定404だけに依存しない。
- [ ] T029 [US2] `src/app/locations/page.tsx`の選択・モーダルopen経路をnative `LocationCard` linkへ置き換え、カテゴリ・loading/error・地域名の既存意味と一覧の主要操作を維持する。既存dirty差分を先に再読し、意図しないresetを行わない。
- [ ] T030 [US2] T022〜T024の専用ページ・native link・content/resolver testsを実行し、`npx tsc --noEmit --incremental false`、対象ESLint、`git diff --check`を通す。直接アクセス・リンクhref・目的地設定・not-found/data-load-errorのGREENを記録し、置換前のmodal test bytesをこの段階で実行対象に戻さない。

### User Story 2 production-code review gate

- [ ] T031 [US2] `src/components/features/LocationCard.tsx`、`src/components/features/LocationDetailContent.tsx`、`src/app/location-detail/[id]/page.tsx`、`src/app/locations/page.tsx`、resolverとsettled testsをfresh read-only subagentへproduction-code reviewとして委任する。native navigation、ID ambiguity、loader failure、主要操作、WCAG 1.3.1/2.4.2/2.4.4/2.4.6、scopeを確認し、`VERDICT: PASS`までUS3へ進まない。

**Checkpoint**: 場所詳細が共有・再読み込み・直接アクセス可能な独立ページとなり、一覧にmodal/focus-return依存が残らない。

---

## Phase 5: User Story 3 - レート制限を専用ページで理解して再試行する (Priority: P1)

**Goal**: 住所検索、GPS逆ジオコーディング、場所検索、経路検索の4 producerから、一度だけ通信なしの`/rate-limit`へ移動し、source allowlistの固定戻りlinkを提供する。

**Independent Test**: 各producerの429 + `limitExceeded`でページへ遷移し、既存の制限説明、主見出し、source mapping、直接アクセス・再読み込みのfetch 0件、明示的な戻り後のみ再操作可能なことを確認する。

### Tests for User Story 3

> **RED first**: T036のreviewがPASSになるまで、rate-limit pageと4 producerの本番コードを変更しない。

- [ ] T032 [P] [US3] `src/app/rate-limit/__tests__/page.test.tsx`に、`/rate-limit`の直接アクセス・再読み込み・各source、主見出し、1時間60回・1時間待つ・ブラウザを閉じても継続する説明、native return link、fetch/API呼出し0件を検証するREDテストを作成する。
- [ ] T033 [P] [US3] `src/components/features/__tests__/OriginSelector.test.tsx`と`src/components/features/__tests__/DestinationSelector.test.tsx`に、geocode 429/`limitExceeded`からsource付きrate-limit pageへ一度だけ遷移し、loadingを解除し、表示だけでは再検索しない契約を追加する。
- [ ] T034 [P] [US3] `src/app/locations/__tests__/page.test.tsx`と`src/components/features/__tests__/RouteSearchResults.rate-limit.test.tsx`に、locations/routesの429 producer、source mapping、route mount時の重複transit fetch防止、明示的な戻り後の再操作を検証するREDテストを作成する。
- [ ] T035 [P] [US3] `src/lib/location/__tests__/geocoding-search.test.ts`、`src/lib/location/__tests__/location-list-state.test.ts`、`src/lib/transit/__tests__/route-search-state.test.ts`で、429 + `limitExceeded`がstructured `rate-limited`状態へ変換され、通常error・loading・successと混同されない回帰テストを追加する。
- [ ] T036 `src/app/rate-limit/__tests__/page.test.tsx`、T033〜T035のproducer/data-boundary testsをfresh read-only subagentへtest-code reviewとして委任する。direct/reload fetch 0、4 producer、once-only transition、allowlist return、fail-closed境界の過剰な仕様化がないことを確認し、`VERDICT: PASS`までT037〜T040を開始しない。

### Implementation for User Story 3

- [ ] T037 [P] [US3] `src/app/rate-limit/page.tsx`に、server-firstで通信を行わない専用metadata、共通main/h1、既存制限文言、`rate-limit-source.ts`由来のallowlist固定Linkを実装する。mount時のfetch、useEffect retry、外部API初期化を追加しない。
- [ ] T038 [US3] `src/components/features/OriginSelector.tsx`、`src/components/features/DestinationSelector.tsx`、`src/app/locations/page.tsx`、`src/components/features/RouteSearchResults.tsx`の4 producerを、既存の429/`limitExceeded`判定を保った一度だけのrouter遷移へ置き換える。`/routes`へraw queryを渡さず、source tokenだけを渡す。
- [ ] T039 [US3] `src/components/features/useGeocodingSearch.ts`、`src/lib/location/geocoding-search.ts`、`src/lib/location/location-list-state.ts`、`src/lib/transit/route-search-state.ts`のstructured `rate-limited`状態を維持し、modal open state・二重通知・loading stuckを除去する。`src/lib/api/rate-limit-middleware.ts`の閾値・時間窓・API policyは変更しない。
- [ ] T040 [US3] T032〜T035と既存`src/app/routes/__tests__/page.test.tsx`、関連geocode testsを実行し、rate-limit pageのrender/reload前後fetch回数、4 producerのonce-only遷移、source mapping、`npx tsc --noEmit --incremental false`、対象ESLint、`git diff --check`をGREENとして記録する。

### User Story 3 production-code review gate

- [ ] T041 [US3] `src/app/rate-limit/page.tsx`、4 producer、rate-limited state helpers、関連テストのsettled bytesをfresh read-only subagentへproduction-code reviewとして委任する。通信なし、重複要求0、429境界、固定戻り先、WCAG 2.4.2/2.4.4/4.1.3、fail-closedを別scopeへ残したことを確認し、`VERDICT: PASS`までUS4へ進まない。

**Checkpoint**: レート制限の説明・戻り操作が通常ページへ集約され、表示だけではfailed requestを再実行しない。

---

## Phase 6: User Story 4 - 通常ページとしてキーボードと支援技術で移動する (Priority: P2)

**Goal**: 3種類の専用ページが、ページタイトル、main/h1、native controls、label、状態通知、論理的keyboard順、明確なlink目的を一貫して提供する。

**Independent Test**: `/login`、`/signup`、有効/無効な`/location-detail/[id]`、`/rate-limit`をキーボードとRTLで検証し、accessibility tree上のlandmark・heading・form/link/error/statusを確認する。

### Tests for User Story 4

> **RED first**: T045のreviewがPASSになるまで、共通semantic markupや既存contract testを変更しない。

- [ ] T042 [P] [US4] `src/app/__tests__/accessible-route-pages.test.tsx`に、各専用ページの唯一の主要`main`、意味のあるh1、ページ目的に一致するheading、native `A`/`BUTTON`/`FORM`、空でないhref、label/legend、error/status関連を検証するREDテストを作成する。
- [ ] T043 [P] [US4] `src/app/__tests__/accessibility-source-contract.test.ts`に、旧modal実装を前提にしたsource契約を専用ページ・native navigation・form semantics契約へ更新し、dialog/tablist/menuitemの残存を検出するテストを追加する。
- [ ] T044 [P] [US4] `src/components/layouts/__tests__/PageHeader.test.tsx`、`src/components/layouts/__tests__/SidebarLayout.test.tsx`、`src/components/ui/__tests__/InputField.test.tsx`へ、専用ページで再利用するmain/header/labelの既存契約と、Issue #67作業単位1〜3の非退行検証を追加する。
- [ ] T045 `src/app/__tests__/accessible-route-pages.test.tsx`、`src/app/__tests__/accessibility-source-contract.test.ts`、`src/components/layouts/__tests__/PageHeader.test.tsx`、`src/components/layouts/__tests__/SidebarLayout.test.tsx`、`src/components/ui/__tests__/InputField.test.tsx`をfresh read-only subagentへtest-code reviewとして委任する。WCAG 1.3.1/2.1.1/2.4.2/2.4.3/2.4.4/2.4.6/3.3.1/3.3.2/4.1.3、native tag、非空collection、実consumerの主要操作を確認し、`VERDICT: PASS`までT046〜T048を開始しない。

### Implementation for User Story 4

- [ ] T046 [US4] `src/app/login/page.tsx`、`src/app/signup/page.tsx`、`src/app/location-detail/[id]/page.tsx`、`src/app/rate-limit/page.tsx`、`src/components/auth/AuthenticationForm.tsx`、`src/components/features/LocationCard.tsx`、`src/components/features/LocationDetailContent.tsx`のsemantic markupを、`main`/h1/heading order/native form/label/fieldset/legend/link/button/alert/status契約へ揃える。
- [ ] T047 [US4] `src/app/__tests__/accessibility-source-contract.test.ts`、`src/app/__tests__/accessible-route-pages.test.tsx`、関連ページtestsをGREENにし、`npx tsc --noEmit --incremental false`、`npm run lint`、`git diff --check`を実行する。warning（既存`next lint` deprecation等）とfailureを分離して記録する。
- [ ] T048 [US4] `specs/018-accessible-route-pages/quickstart.md`のmanual acceptance walkthroughを実際のlocal server + browserで実行し、keyboard traversal、direct URL、document title、accessible tree、rate-limit fetch 0件、目的地設定遷移を記録する。スクリーンショットだけでsemantic passを主張しない。

### User Story 4 production-code review gate

- [ ] T049 [US4] 全専用ページ、共有form/card/detail content、layout/header、settled semantic testsと`quickstart.md`の実ブラウザ記録をfresh read-only subagentへproduction-code/a11y reviewとして委任する。source→rendered accessibility tree→visual contextの3層、WCAG参照、既存主要操作、scopeを確認し、`VERDICT: PASS`まで旧modal削除へ進まない。

**Checkpoint**: 文書構造・キーボード・エラー状態・リンク目的が、実consumerと実ブラウザで確認できる。

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 旧modal契約の撤去、全体回帰、ドキュメント・scope・配送の最終確認を行う。

- [ ] T050 全認証入口移行後、`src/components/discussion/LoginModal.tsx`、`src/components/discussion/index.ts`、`src/types/discussion.ts`の旧LoginModal export/propsを削除し、`src/components/discussion/__tests__/LoginModal.test.tsx`を専用ページテストへ置換する。削除前に`search_files`でruntime importが0件であることを確認する。
- [ ] T051 場所詳細ページ移行後、`src/components/features/LocationDetailModal.tsx`、`src/components/features/index.ts`、`src/components/features/__tests__/LocationDetailModal.test.tsx`、`src/app/locations/__tests__/page.dialog-focus.test.tsx`のmodal/focus-return契約を削除・置換し、`LocationDetailContent`・native link・direct page契約へ一本化する。
- [ ] T052 4 producer移行後、`src/components/features/RateLimitModal.tsx`、`src/components/features/index.ts`、`src/components/features/__tests__/RateLimitModal.test.tsx`、関連mockを削除・置換し、`search_files`でruntime `RateLimitModal` importが0件、`rate-limited` producerが4経路に残ることを確認する。
- [ ] T053 [P] `src/app/__tests__/page-navigation-contract.test.tsx`、`src/app/settings/__tests__/page.streaming.test.tsx`、`src/app/discussions/create/__tests__/page.test.tsx`、`src/app/discussions/[naddr]/__tests__/page.streaming.test.tsx`、`src/app/discussions/[naddr]/edit/__tests__/page.streaming.test.tsx`、`src/app/routes/__tests__/page.test.tsx`、`src/app/locations/__tests__/page.test.tsx`を全体の新route契約へ更新し、旧modal mockが残っていないことを確認する。
- [ ] T054 [P] `specs/018-accessible-route-pages/spec.md`、`research.md`、`data-model.md`、`contracts/ui-page-contract.md`、`quickstart.md`、`plan.md`、`tasks.md`の相互リンク・source mapping・auth action非再開・ID failure・通信なし契約を読み合わせ、古い「常に場所検索へ戻る」表現や実装未承認の仕様を残さない。
- [ ] T055 `npm test -- --runInBand`で全Jestを実行し、`npx tsc --noEmit --incremental false`、`npm run lint`、`npm run build`、`git diff --check`を実行する。実際のsuite/test数、終了コード、既存warning、baseline failureをログへ記録し、timeoutや未実行を成功と混同しない。
- [ ] T056 [P] `specs/018-accessible-route-pages/quickstart.md`のコマンド・受入手順がtasks.mdで固定したファイル/route/test名と一致することを確認し、`uvx --from specify-cli specify check`と、`specs/018-accessible-route-pages/`配下を対象にした純粋なPythonの相対リンク・未置換marker・未チェック項目content checkを実行する。`.specify/feature.json`へ書き込むprerequisite scriptは配送検証で実行しない。
- [ ] T057 `git status --short --untracked-files=all`と`git diff --name-only`を再確認し、今回の配送対象を`AGENTS.md`と`specs/018-accessible-route-pages/{spec.md,checklists/requirements.md,plan.md,research.md,data-model.md,quickstart.md,contracts/ui-page-contract.md,tasks.md,evidence/key-locations-validation.json}`に限定する。証跡がまだ生成されていない場合は今回の仕様配送から除外し、実装後に追加する。既存の`.specify/feature.json`と本番コード/旧modal dirty変更をstageしない。
- [ ] T058 `git diff --cached --check`、staged path一覧、staged内容のSHA-256を確認してから、`docs: plan accessible route pages`のconventional commitを作成する。commit対象に本番コード、旧modalテスト、`.specify/feature.json`が含まれないことを確認する。
- [ ] T059 `git push -u origin fix/issue-67-semantic-a11y-navi`を実行し、`git fetch origin fix/issue-67-semantic-a11y-navi`後にlocal HEAD SHAと`origin/fix/issue-67-semantic-a11y-navi` SHAが一致することを確認する。PR作成・merge・CI成功はこのtasks配送の範囲に含めない。

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 Setup**: 既存リポジトリと仕様成果物の確認のみ。T001の環境照合後にT002のdirty scope記録を実施する。
- **Phase 2 Foundational**: T001〜T002後にT003〜T005を実施し、T006のfresh test-code review PASSがT007〜T010をblockする。
- **User Stories 1〜3**: T010後に開始可能。仕様上はP1であるが、`src/app/locations/page.tsx`を共有するUS2/US3の実装は、同一ファイルの所有権を一つに固定して並列編集しない。
- **User Story 4**: 各ページの実装後に開始し、T045のfresh test-code review PASS後にT046〜T048を実施する。
- **Polish**: T021、T031、T041、T049のproduction review PASS後に開始する。T050〜T052はそれぞれの旧modal利用者が0件であることを確認してから実施する。
- **配送**: T055〜T057の検証とscope freeze後にT058でcommitし、T059でpushする。push後に本番実装を開始しない。

### User story dependencies

- **US1 (P1)**: Foundational T010後。US2/US3から独立してMVPとして配送可能。
- **User Story 2 (P1)**: Foundational T010後。US1のT021とは独立だが、共通SidebarLayout/PageHeaderと`src/app/locations/page.tsx`の所有権を共有するため、同一ファイルを並列編集しない。
- **US3 (P1)**: Foundational T010後。US2とは独立だが、`src/app/locations/page.tsx`を共有するため、rate-limit producer移行はUS2の一覧変更と直列化する。
- **US4 (P2)**: US1〜US3の各ページと共有部品が存在した後。テストは先に作れるが、実ブラウザ確認T048は各ページGREEN後に行う。

### Blocking review gates

| Gate | Test files | Blocks |
|---|---|---|
| T006 | safe-return-target / rate-limit-source / location-detail-resolver | Foundational production code |
| T015 | AuthenticationForm、login/signup pages、6 auth callsite tests | US1 production code |
| T021 | US1 production files and tests | US1 completion |
| T025 | locations/link、location-detail page、detail content/resolver tests | US2 production code |
| T031 | US2 production files and tests | US3 start |
| T036 | rate-limit page、4 producers、data boundaries | US3 production code |
| T041 | US3 production files and tests | US4 start |
| T045 | common accessibility/page contract tests | US4 production code |
| T049 | all dedicated pages and rendered a11y evidence | Old modal deletion |

各review gateは独立したfresh subagentで実施し、テストまたは実装が1バイトでも変更された場合は直前のverdictを再利用しない。

### Parallel opportunities

- T003〜T005は異なる基盤テストファイルであるため並列。
- T007〜T009は共有型、navigation、location loader/resolverの異なる境界であるため、T006 PASS後は並列。ただし同じfixture/helperを共有する場合は所有権を分ける。
- T011〜T014、T022〜T024、T032〜T035、T042〜T044は異なるテストファイルであるため並列。
- US1のT016〜T018、US2のT026〜T028、US3のT037は異なるファイルで並列。ただし既存page consumerを変更するT019、T029、T038は同じファイルを同時編集しない。
- T053〜T054、T056は実装・全体検証と独立した文書/contract検証として並列可能だが、T054の相互リンク確認は最終ファイルがsettledしてから行う。

### File ownership boundaries

- **Navigation foundation**: `src/lib/navigation/**`
- **Location foundation**: `src/lib/location/location-detail-resolver.ts`とその専用test。既存`addressLoader.ts`はtransport failureの意味を確認してから最小変更する。
- **Auth page**: `src/components/auth/**`、`src/app/login/**`、`src/app/signup/**`。
- **Location page**: `src/components/features/LocationCard.tsx`、`src/components/features/LocationDetailContent.tsx`、`src/app/location-detail/**`、`src/app/locations/page.tsx`。
- **Rate-limit page**: `src/app/rate-limit/**`と`src/components/features/OriginSelector.tsx`、`DestinationSelector.tsx`、`RouteSearchResults.tsx`。`src/app/locations/page.tsx`はLocation ownerが担当し、rate-limit ownerはその変更をpatch単位で受け取る。
- **Tests**: 各test chapterのwriterは割り当てられたtest paths以外を変更しない。reviewerは完全読み取り専用。
- **Docs/delivery**: `specs/018-accessible-route-pages/**`と`AGENTS.md`。既存`.specify/feature.json`は除外する。

## Parallel Example: Foundational contracts

```text
Task: T003 safe-return-target RED tests in src/lib/navigation/__tests__/safe-return-target.test.ts
Task: T004 rate-limit-source RED tests in src/lib/navigation/__tests__/rate-limit-source.test.ts
Task: T005 addressLoader RED tests in src/utils/__tests__/addressLoader.test.ts and location-detail-resolver RED tests in src/lib/location/__tests__/location-detail-resolver.test.ts

After all three complete:
Task: T006 one fresh read-only test-code review; implementation remains blocked until VERDICT: PASS

After T006 PASS:
Task: T007 safe-return-target implementation in src/lib/navigation/safe-return-target.ts
Task: T008 rate-limit-source implementation in src/lib/navigation/rate-limit-source.ts
Task: T009 status-preserving addressLoader and location-detail-resolver implementation in src/utils/addressLoader.ts and src/lib/location/location-detail-resolver.ts
```

## Parallel Example: User Story 1 tests

```text
Task: T011 AuthenticationForm RED tests in src/components/auth/__tests__/AuthenticationForm.test.tsx
Task: T012 login page RED tests in src/app/login/__tests__/page.test.tsx
Task: T013 signup page RED tests in src/app/signup/__tests__/page.test.tsx
Task: T014 existing auth callsite RED contract updates in the six named page/component test files

After all tests settle:
Task: T015 one fresh read-only test-code review; implementation remains blocked until VERDICT: PASS
```

## Implementation Strategy

### MVP first

1. Complete T001〜T002 to freeze scope.
2. Complete T003〜T010 to establish navigation/location foundational contracts.
3. Complete US1 T011〜T021 and stop at its production review gate for an independently usable `/login` + `/signup` MVP.
4. Do not delete old modal files until US2/US3 migrations and T049 pass; the old dirty approach is quarantined, not delivered.

### Incremental delivery

1. Add US1 authentication pages and six入口 migration; verify independently.
2. Add US2 location detail link/page and direct-access states; verify independently.
3. Add US3 network-free rate-limit page and four producer migrations; verify no duplicate requests.
4. Add US4 semantic/accessibility verification and manual browser evidence.
5. Delete obsolete modal contracts, run full checks, commit only approved docs/code for the implementation milestone, and push the exact branch SHA.

### Final acceptance evidence

- All focused RED→review PASS→GREEN gates have an explicit command, exit code, suite/test count, and settled file scope.
- Direct access, reload, keyboard order, heading/label/link semantics, missing/error/partial states, and primary operations are verified.
- Rate-limit page render/reload issues zero additional requests.
- Auth success returns to a validated same-site screen only and never replays a pending side effect.
- Location ID ambiguity and loader failure are not silently treated as a successful first match.
- `npx tsc --noEmit --incremental false`、`npm run lint`、`npm test -- --runInBand`、`npm run build`、`git diff --check`の実結果を報告する。
- T058 commit and T059 remote branch SHA equality are verified; PR/merge/CI status is reported separately if requested later.
