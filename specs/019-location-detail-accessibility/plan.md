# 場所詳細ページのアクセシビリティと情報構造の改善 Implementation Plan

> **For Hermes:** `issue-specification-workflow` と `review-gated-development` に従い、tasks.mdの各テスト章をRED→fresh test-code review PASS→実装→GREEN→fresh production-code review PASSの順に実行する。

**Goal:** 場所詳細ページの文書構造、ネイティブナビゲーション、文字サイズ、文字色、動的タイトル、状態表示をアクセシビリティ契約へ揃え、Green後に不要な詳細表示コンポーネント分離を整理する。

**Architecture:** 共通レイアウトが所有する単一の`main`の内側で、動的ページが上部戻りリンク、`PageHeader`による主`h1`、詳細情報、目的地リンクを文書順に描画する。場所データの既存resolverと`convertToLocation`を再利用し、metadataと本文のデータ解決は共有・キャッシュ可能な境界に揃える。文字サイズ監査は、詳細ページの公開契約とアプリ全体の静的監査を分離し、テストレビュー後に責務別の本番修正へ進む。

**Tech Stack:** TypeScript 5 strict、React 19、Next.js 15 App Router、Tailwind CSS 4、DaisyUI 5、Jest、React Testing Library、Puppeteerまたは既存の実ブラウザ検証手段。

---

**Branch**: `fix/location-detail-accessibility` | **Date**: 2026-08-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/019-location-detail-accessibility/spec.md`

## Summary

今回の作業は、`specs/018-accessible-route-pages/`で定義済みの場所詳細専用ページを、次の公開契約へ具体化するものである。

1. 成功・loading・not-found・取得失敗のすべてで、共通レイアウト内の主`main`を壊さず、主`h1`と上部の一覧リンクを一貫させる。
2. 成功状態の場所名、地域、提供情報、画像、外部リンク、ライセンス、目的地設定を、重複見出しやカード依存のない文書構造へ移す。
3. 目的地移動は`useRouter`とbuttonを使わず、既存の`destination` JSON queryを持つnative anchorへ揃える。
4. 詳細ページとアプリ全体の通常UIを16px相当以上へ修正し、`rt`だけを厳密な例外とする静的監査を、低コントラスト色・opacity・DaisyUI button既定値の監査から分離する。
5. `generateMetadata`相当の動的metadataで有効な場所名をタイトルへ反映し、挙動がGreenになった後に`LocationDetailContent`をページ側へ統合する。

## Technical Context

**Language/Version**: TypeScript 5 strict、Node.js 22.x、React 19、Next.js 15 App Router

**Primary Dependencies**: React Testing Library、Jest、Tailwind CSS 4、DaisyUI 5、`next/link`、既存`addressLoader`、既存`location-detail-resolver`、`PageHeader`、`SidebarLayout`

**Storage**: N/A。新規DB、Nostrイベント、sessionStorage、localStorageは追加しない。場所データは既存CDN、目的地状態は既存URL queryを利用する。

**Testing**: Jest + React Testing Library、静的TSX/CSS監査、`npx tsc --noEmit --incremental false`、`npm run lint`、`git diff --check`、最終Jest、Puppeteer等による実ブラウザ確認。

**Target Platform**: Next.jsのモダンブラウザWebアプリ。共通レイアウトは単一`main`を既に所有しているため、動的ページは追加`main`を描画しない。

**Project Type**: Web application

**Performance Goals**:

- metadataと本文の同一リクエストで、場所データ取得を不必要に重複させない。
- 目的地リンクの起動で既存queryを一度だけ遷移させ、クリック時の追加fetchやrouter callbackを発生させない。
- 文字サイズ監査は決定的なfixture・静的ソース解析で実行し、実CDN・実ブラウザを各テストケースへ重複させない。

**Constraints**:

- `SidebarLayout`の単一`main`、`PageHeader`の見出し契約、既存の場所resolver、`convertToLocation`、共通Ko-fiカードを維持する。
- `LocationDetailContent`の統合・削除は、ページレベルの振る舞いがGreenになった後だけ行う。
- 既存の未コミット変更をreset、clean、stage、commit、pushしない。実装担当は各sliceの明示されたpathだけを書き込む。
- 認証UIは通常文字のサイズ・色の監査と是正だけを対象とし、認証の振る舞い・データフローは変更しない。
- `src/components/features/KoFiSupport.tsx`は実装writerの変更対象から除外し、カード構造、iframe、見出し、表示位置を維持する。
- 全体16px化は一括の機械的置換にせず、監査を先に固定し、ルビ、PDF、テスト、外部から渡る解決不能なclassName境界を混同しない。
- `src/app/globals.css`の`rt { font-size: 70%; }`だけを、ルビ補助文字の明示的な例外として扱う。別selector・別CSS・通常要素への例外拡張は許可しない。
- upstream CDNが将来重複した場合も、既存resolverのfail-closed挙動を維持し、UI変更のために先頭要素へ黙って解決しない。現在の正本CDN `v2.1.1` は一意IDのみである。

**Scale/Scope**:

- 場所詳細のページ、関連テスト、現在の`LocationDetailContent`、ページmetadata、関連静的監査。
- アプリ全体の`src/app/**/*.tsx`、`src/components/**/*.tsx`、`src/app/globals.css`の通常UI文字サイズを16px相当以上へ是正する責務別slice。
- 共通Ko-fi支援欄、認証の振る舞い・データフロー、レート制限、場所一覧のドメインロジック、場所データ形式、目的地query形式は対象外。ただし、認証UIの通常文字に対するFR-011の監査・是正は対象とする。

## Phase 0 Evidence and Baseline

### Worktree freeze

- Repository: `/opt/data/kazaguruma-transit`
- Branch: `fix/location-detail-accessibility`
- Baseline HEAD: `e34c270b4f086ec3291897f60c4ca0efe3d03c77`
- Existing dirty paths at plan start:
  - `.specify/feature.json`（Specifyが`019-location-detail-accessibility`を指すための生成メタデータ）
  - `src/app/__tests__/font-size-compliance.test.ts`
  - `src/app/location-detail/[id]/__tests__/page.test.tsx`
  - `src/app/location-detail/[id]/page.tsx`
  - `src/components/features/LocationDetailContent.tsx`
  - `src/components/features/__tests__/LocationDetailContent.test.tsx`
  - `specs/019-location-detail-accessibility/spec.md`
- Plan and task artifacts are added only under `specs/019-location-detail-accessibility/`; `tasks.md` was generated after plan acceptance and is the execution contract for implementation.

### Read-only baseline commands

| Command | Result |
|---|---|
| `npm test -- --runInBand --runTestsByPath 'src/app/location-detail/[id]/__tests__/page.test.tsx' src/components/features/__tests__/LocationDetailContent.test.tsx src/app/__tests__/font-size-compliance.test.ts --silent` | exit 1; 3 suites, 35 tests; 2 suites/34 tests passed, font audit 1 test failed with 74 `text-sm` violations |
| `npx tsc --noEmit --incremental false` | exit 0 |
| `npm run lint` | exit 0; existing warning群、`LocationDetailContent.tsx`の`<img>` warning、Lint deprecation noticeあり |
| `git diff --check` | clean |
| `uvx --from specify-cli specify check` | exit 0 |

The current font test is a large, previously edited AST-based file and is not treated as an approved test contract. The first typography test slice must reread it, settle its boundary, and obtain a fresh read-only review before any additional font production edit.

### Observed source boundaries

- `src/components/layouts/SidebarLayout.tsx:100-108` owns the single `main` and renders the page children before the Ko-fi support card.
- `src/components/layouts/PageHeader.tsx:18-24` renders the shared `h1`; route pages must not add another `main` or duplicate page heading.
- `src/app/location-detail/[id]/page.tsx:12-15` currently exports a static title; `:33-53` owns an error-state shell; `:102-113` renders the success shell and delegates to `LocationDetailContent`.
- `src/components/features/LocationDetailContent.tsx:23-101` currently owns detail markup. It contains the area/details lists, image, external links, destination anchor, and provided-information heading/list; it still contains `text-sm` and is not yet integrated into the page.
- `src/app/globals.css:39-59` supplies global visible focus styling. `:138-156` contains the existing `rt` exception and ruby color rules.
- `src/components/features/KoFiSupport.tsx:15-34` owns the intentionally preserved card/iframe structure. It is rendered by `SidebarLayout`, not by the provided-information block.
- `src/utils/addressLoader.ts:143-163` preserves CDN/HTTP/JSON failures in `loadKeyLocationsDataResult`; `src/lib/location/location-detail-resolver.ts:95-138` distinguishes invalid/duplicate IDs, not-found, and `data-load-error`.

### Live-data evidence

The exact loader URL at the current data version `v2.1.1` was fetched once in read-only mode:

```text
https://cdn.jsdelivr.net/gh/nawashiro/chiyoda_city_main_facilities@v2.1.1/kazaguruma_json_min/key_locations.json
```

Observed result: 16 categories, 169 locations, 169 unique IDs, no duplicate IDs, no empty/whitespace/slash/backslash/query/fragment/control-character IDs. Optional-field presence: `description` 43, `imageUri` 28, `uri` 71, `imageCopyright` 28, `descriptionCopyright` 44, `nodeCopyright` 169, `licence` 169, `licenceUri` 169, and `area` 0. This confirms that the current CDN can supply a clean success page, while the resolver must still remain fail-closed for duplicate fixtures and that the detail page must retain its existing area-derivation/fallback boundary rather than assuming a live `area` field.

## Constitution Check

*GATE: Phase 0 and Phase 1 design both pass. The stricter 16px feature contract is compatible with the constitution's 14px floor.*

| Gate | Result | Evidence |
|---|---|---|
| Clear naming | PASS | Public concepts are `LocationDetailState`, `DefinitionPair`, `DestinationLink`, and `TypographyAudit`; exact paths are fixed below. |
| Simple logic | PASS | Native links replace router/button navigation; rendering, metadata resolution, and static audits have separate responsibilities. |
| Structured organization | PASS | Page UI remains under `src/app`, feature UI under `src/components`, data boundary under existing `src/utils`/`src/lib`; no direct DB access. |
| Type safety | PASS | Existing `KeyLocation` and resolver unions are reused; no new `any`, unvalidated payload, or second destination format. |
| Test-first development | PASS | Every new contract chapter is RED first, followed by one fresh test-code review and then bounded production implementation. |
| Accessibility & UX | PASS | Single shared `main`, one page `h1`, `dl` relationships, native anchors, empty decorative `alt`, focus-visible styling, 44px targets, Japanese state messages. |
| Existing behavior | PASS | `convertToLocation`, location resolver, global layout, Ko-fi card, external-link security, and data formats remain unchanged. |
| Scope/reviewability | PASS | Global 16px remediation is split by directory/responsibility; no giant one-agent production edit is planned. |

## Project Structure

### Documentation (this feature)

```text
specs/019-location-detail-accessibility/
├── spec.md
├── checklists/requirements.md
├── plan.md
├── research.md
├── data-model.md
├── contracts/location-detail-accessibility.md
├── quickstart.md
└── tasks.md
```

`tasks.md` is generated after this plan was reviewed and accepted. It places each RED test chapter immediately before its fresh test-code review gate and matching implementation tasks.

### Source Code (repository root)

```text
src/
├── app/
│   ├── __tests__/
│   │   ├── font-size-compliance.test.ts
│   │   ├── color-compliance.test.ts                 # planned
│   │   └── button-font-size-compliance.test.ts      # planned
│   ├── location-detail/[id]/
│   │   ├── page.tsx
│   │   ├── loading.tsx                              # existing/public loading boundary
│   │   └── __tests__/page.test.tsx
│   └── globals.css
├── components/
│   ├── features/
│   │   ├── LocationDetailContent.tsx                 # integrated after Green
│   │   └── __tests__/LocationDetailContent.test.tsx  # migrated/removed after Green
│   ├── auth/                                          # typography-only audit/remediation
│   │   ├── AuthenticationForm.tsx
│   │   └── AuthRoutePage.tsx
│   ├── layouts/
│   │   └── SidebarLayout.tsx                         # preserved Ko-fi/main host
│   └── features/KoFiSupport.tsx                      # unchanged
├── lib/location/
│   └── location-detail-resolver.ts                   # reused, no behavior change planned
└── utils/
    └── addressLoader.ts                              # reused, no data-format change planned
```

**Structure Decision:** Keep the existing Next.js App Router and layout hierarchy. Do not introduce a new page shell or data model. Keep a temporary `LocationDetailContent` boundary only until the page-level contract is Green; then merge its markup into the server page and remove the obsolete client/component test boundary if no consumer remains.

## Phase 1 Design

### 1. Page shell, headings, and states

1. Keep `PageHeader` as the single source of the success or state `h1`; do not render nested `main` or add another location heading.
2. Render the `/locations` link before `PageHeader` in success, not-found, data-load-error, invalid/duplicate error, and loading states. Ensure exactly one such link per rendered page state.
3. Replace the `section[aria-labelledby]` dependency with a plain document wrapper or a semantic section whose label does not depend on a deleted duplicate location `h2`.
4. Keep the existing resolver's state distinction. Do not turn the live duplicate-ID evidence into a first-match success or collapse transport failure into not-found.
5. Preserve Japanese messages and the alert boundary. State pages must not render empty success details.

### 2. Detail information structure

1. Render an optional region as one `dl` containing `dt` `地域` and its adjacent `dd`.
2. Render description as ordinary paragraph content without an `説明` heading. Preserve Ruby wrapper placement without using it to exempt normal text from the font contract.
3. Render image as native `img alt=""` in a `figure` with an explicit responsive ratio such as `aspect-[4/3]`; do not add `role="img"`.
4. Render `提供情報` as `h2` followed by one `dl`. Emit only complete conditional `dt`/`dd` pairs for image and description copyrights.
5. Keep license and external site links as anchors with existing target/security attributes and accessible link names.
6. Place the destination anchor before the provided-information heading. Keep its exact encoded `convertToLocation(location)` payload.
7. Do not apply `card`, `card-body`, `bg-base-100`, or equivalent card presentation to normal provided information. Do not modify `src/components/features/KoFiSupport.tsx`.

### 3. Typography and color audit design

Split the current oversized `font-size-compliance.test.ts` into focused contracts without weakening the public boundary:

- **Font utility/CSS contract:** inspect `src/app/**/*.tsx`, `src/components/**/*.tsx`, and `src/app/globals.css`; detect named utilities and arbitrary values below 16px, reject unknown/unparseable font-size values, and permit only the exact `src/app/globals.css` `rt { font-size: 70%; }` rule.
- **Color/opacity contract:** inspect normal text in the bounded source set for low-contrast utilities such as `text-black/60`, muted color/opacity utilities, and the detail-page `text-base-content` contract. Keep exceptions explicit and local; do not infer contrast solely from class absence. Browser acceptance must verify WCAG 2.2 AA ratios in both themes: normal text `>=4.5:1`, large text `>=3:1`, and applicable non-text controls/indicators `>=3:1`. Large text follows WCAG's definition: at least 18pt regular or 14pt bold (approximately 24px or 18.66px bold at 96 CSS px/in).
- **Button contract:** inspect ordinary DaisyUI buttons and links used as controls to ensure their rendered/public classes explicitly enforce `text-base` or an equivalent 16px size. Do not classify the preserved Ko-fi card as a normal detail-information card.

The tests must use Node filesystem and TypeScript parsing or deterministic source readers already available in the repository. They must not shell out to `rg`, fail-open on dynamic class expressions, or treat a broad Ruby wrapper as permission for small ordinary elements. Test code itself and PDF-only source are excluded only where the contract explicitly states so.

Production remediation is divided into bounded ownership slices: location detail/page, remaining `src/app` pages, discussion components, feature components excluding `src/components/features/KoFiSupport.tsx`, authentication components for typography only, shared UI/layouts, and global CSS. Each slice runs the reviewed aggregate and its scoped lint before a fresh production review.

### 4. Dynamic metadata

1. Add a dynamic metadata function at `src/app/location-detail/[id]/page.tsx` that resolves the same valid location ID as the page.
2. Return `${location.name} - 場所詳細` for a successful location, including the exact `千代田区役所 - 場所詳細` example.
3. Return the existing fallback title `場所詳細 | 風ぐるま乗換案内` for invalid, unknown, duplicate, or data-load-error states; do not interpolate an untrusted raw ID into the title.
4. Share the loader/resolver boundary between metadata and page where possible (for example through a page-local cached data promise) and add a test that prevents unnecessary repeated data resolution within the same render contract.

### 5. Green-after-refactor integration

1. Keep page-level tests as the authoritative public contract while `LocationDetailContent` is present.
2. After heading, navigation, structure, typography, color, button, state, and metadata chapters are Green and production-reviewed, move the detail markup into `page.tsx`.
3. Remove unused `LocationDetailContent` exports/imports and its dedicated tests only when repository search proves no runtime consumer remains.
4. Any test edit caused by this migration invalidates the prior test-code review; rerun the exact RED/GREEN checks and obtain a fresh test review before the integration implementation review.

## Implementation Sequence and Blocking Gates

The future `tasks.md` must use this order; no later production task may start before the named gate.

1. **Reconcile existing dirty test boundary.** Read the current page/content/font files and hashes. Keep the already completed slice-1/2 behavior only if it still matches this approved spec; any byte change invalidates the old verdict. Do not reset unrelated dirty paths.
2. **Typography RED foundation.** Rewrite or minimally settle `font-size-compliance.test.ts` into the 16px utility/CSS contract. Run the exact focused test and prove the failure is the 74 real violations, not collection failure. Fresh read-only test review is mandatory.
3. **Typography implementation slices.** After the test review, update production files in small ownership groups: location detail/page, remaining `src/app`, discussion components, feature components excluding `KoFiSupport.tsx`, authentication components for typography only, then shared UI/layouts/global CSS. Each group runs focused Jest, scoped TypeScript/Lint, diff checks, and receives a fresh production review before the next group.
4. **Color/opacity RED → review → implementation → production review.** Add `color-compliance.test.ts` with rendered/source boundary assertions for normal text and low-contrast/opacity utilities. Do not include button-size or font parser behavior in this file.
5. **Button-size RED → review → implementation → production review.** Add `button-font-size-compliance.test.ts` covering ordinary buttons and the detail CTA. Explicitly preserve the Ko-fi card contract.
6. **Heading/link/definition-list regression reconciliation.** Re-read the current `page.test.tsx` and `LocationDetailContent.test.tsx`; if a test changes, rerun RED and fresh test review. Assert native tags, order, heading uniqueness, adjacent `dt`/`dd`, empty alt/no role, card absence only around normal provided info, CTA order, and all state shells.
7. **Dynamic metadata RED → review → page implementation → production review.** Add the exact named-location title case, fallback-title case, and one successful metadata/page data-boundary test. Do not modify production metadata before the fresh test reviewer returns `VERDICT: PASS`.
8. **Green-after-refactor integration.** Add/update the page-level test that proves behavior survives removal of `LocationDetailContent`, review the settled tests, integrate markup, delete unused component/test only after runtime search, then obtain a fresh production review.
9. **Final cross-cutting verification.** Run the full Jest suite, strict TypeScript, full Lint, `git diff --check`, direct/reload/keyboard browser checks at mobile and desktop widths, title/heading/link order, computed font size, contrast/theme, focus, touch target, and Ko-fi preservation. Build is a separate final gate because repository build performs Prisma/GTFS side effects.

## Review-Gate Contract

Every delegated writer receives an exact hard write boundary and may not commit or push. Every reviewer is a fresh read-only subagent and must return:

```text
SUBAGENT_STATUS: COMPLETE
VERDICT: PASS
```

A `CHANGES_REQUESTED`, `INCOMPLETE`, `MAX_ITERATIONS`, completion notice, or green command run against a different byte set never advances the plan. After any test or production byte changes, recompute file hashes, rerun the canonical focused command, and obtain a fresh review. Parent verification must reconcile worktree paths, diff, command exit code, and exact file contents.

## Browser Verification Design

Use the existing local Next.js environment with the current CDN data version `v2.1.1` for the clean success browser path. Use controlled fixtures/interception only for duplicate-ID, invalid-ID, and transport/JSON failure paths; never weaken the resolver merely to make an error fixture pass.

At desktop and a narrow mobile viewport, verify:

- document title for a named location;
- exactly one page `h1`, `提供情報` as `h2`, no duplicate location/説明 heading;
- top-only `/locations` link and document order;
- destination/external/license anchors, href/query, target/rel, and keyboard focus;
- `dl`/`dt`/`dd` adjacency and conditional omission;
- empty-alt native image with no explicit role and 4:3 presentation;
- computed normal text font size >=16px, WCAG 2.2 AA contrast in light and dark themes (normal text >=4.5:1, large text >=3:1, applicable non-text controls/indicators >=3:1);
- CTA and links with rendered bounding rectangles at least 44 CSS px wide and high;
- preserved Ko-fi card after the page children.

## Complexity Tracking

No constitution violation. The only deliberate complexity is splitting the global font audit and remediation into several bounded slices; this is required because the baseline audit reports 74 violations and the repository workflow forbids a giant unreviewed cross-cutting edit.
