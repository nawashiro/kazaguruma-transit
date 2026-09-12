# Research: 場所詳細ページのアクセシビリティと情報構造の改善

**Feature**: [spec.md](./spec.md)
**Plan**: [plan.md](./plan.md)
**Phase**: 0 — Evidence and design research
**Date**: 2026-08-16
**Repository**: `/opt/data/kazaguruma-transit`
**Branch / HEAD**: `fix/location-detail-accessibility` / `e34c270b4f086ec3291897f60c4ca0efe3d03c77`

## Research method and scope

既存のdirty変更を保持したまま、場所詳細ページ、共通layout、データloader/resolver、関連テスト、静的文字サイズ監査、globals.css、Ko-fi支援欄を読み取り専用で調査した。既存の018仕様と今回の019仕様を比較し、観測事実、設計判断、未解決の外部データ事実を分離した。

本計画は`/login`、`/signup`、`/rate-limit`、場所一覧のドメインロジックを実装対象に戻さない。今回の対象は、既存の場所詳細ページの表示契約と、ユーザーが明示したアプリ全体16px監査・是正である。認証UIは通常文字のサイズ・色だけを監査・是正し、認証の振る舞い・データフローは変更しない。

## Evidence matrix

| Question | Observed source | Design decision | Remaining external fact |
|---|---|---|---|
| Main landmark | `src/components/layouts/SidebarLayout.tsx:100-108`に単一`main#main-content`。childrenの後にKo-fi支援欄を描画 | route/pageは追加`main`を描画せず、`div`/`section`だけを使う | 実ブラウザでKo-fiを含む最終DOMを確認する |
| Main heading | `src/components/layouts/PageHeader.tsx:18-24`が`h1`を生成 | success/stateともPageHeaderを主見出しの唯一の生成元にする | loading boundaryの現行ファイル配置を実装時に再確認する |
| Success page | `src/app/location-detail/[id]/page.tsx:102-113`がPageHeaderと`LocationDetailContent`を描画 | 上部戻りリンクをPageHeader前に置き、詳細markupをGreen後にpageへ統合 | page metadataと本文の同一リクエスト共有方法は実装時に検証する |
| Error states | `src/app/location-detail/[id]/page.tsx:33-53,73-98`に状態shell。現行successとStatePageで戻りリンク位置が異なる | 全状態の戻りリンクを上部へ統一し、主`h1`を一つにする | 実ブラウザでloading/errorのアクセシビリティtreeを確認する |
| Current detail markup | `src/components/features/LocationDetailContent.tsx:23-101`に地域、画像、説明、外部リンク、CTA、提供情報 | area/provided informationを`dl`、CTAをnative anchor、通常カードなし、画像`alt=""` | live payloadの任意項目欠落をfixtureと実dataの両方で確認する |
| Existing destination format | `LocationDetailContent.tsx:10-20`で`convertToLocation`をJSON化し`/?destination=...`へLink | query形式とホームの復元契約を変更しない | browserでquery後のhome復元を確認する |
| Data status | `src/utils/addressLoader.ts:143-163`はtransport/JSON failureを`status:error`で保持。`src/lib/location/location-detail-resolver.ts:95-138`はinvalid/duplicate/not-found/data-load-errorを分類 | resolverのfail-closed挙動を再利用し、UIだけを修正する | CDNの将来versionで一意性が変わる可能性がある |
| Canonical data | loader URL: `.../key_locations.json` at version `v2.1.1` | duplicate IDを先頭へ解決せず、現行error契約を保持する。現行CDNは一意ID | 将来のupstream重複とfixture error stateは回帰テストで維持する |
| Area | `src/app/location-detail/[id]/page.tsx:21-31`は`location.area`を優先し、なければ`findLocationAreaName`、失敗時`不明` | area derivation/fallbackを変更せず、表示だけ`dt`/`dd`化する | live dataの`area` presenceは0件で、derived pathが実運用経路になる |
| Metadata | `page.tsx:12-15`は固定`場所詳細 | 風ぐるま乗換案内` | success location nameを`${name} - 場所詳細`へ動的化し、invalid/unknown/duplicate/data-load-errorは`場所詳細 | 風ぐるま乗換案内`へfallback | Next metadata/pageのfetch dedupeを実ブラウザで確認する |
| Typography | dirty `font-size-compliance.test.ts:9-31,57-95`は16px threshold/source scan。baselineで74 `text-sm` violations | current giant AST testは未承認扱い。font/CSS/color/buttonを別契約へ分離し、16pxを全体へ適用 | arbitrary/dynamic classの網羅範囲をfresh reviewerが確定する |
| CSS exception | `src/app/globals.css:138-141`に`rt { font-size:70%; }`、通常UI向け小サイズはない | exact global CSS `rt` ruleだけ許可。selector拡張・別CSS・通常要素の例外は拒否 | computed font-sizeはbrowserで確認する |
| Focus/contrast | `globals.css:39-59`に`:focus-visible`とanchor/button等のfocus styling。Tailwind configのbase-contentはlight `#1f2937`、dark `#f9fafb` | native focus-visibleと`text-base-content`を継承し、low-contrast/opacity utilityを除去。WCAG 2.2 AAの通常文字4.5:1、大きな文字3:1、適用対象の非テキスト要素3:1を受入基準とする | light/dark themeの実contrastはbrowserで確認する |
| Ko-fi | `src/components/features/KoFiSupport.tsx:15-34`がcard/iframeを所有し、SidebarLayoutがchildren後に表示 | provided informationのcard撤去対象からKo-fiを除外し、実装writerの変更対象からも除外する | final browserでKo-fi support frameの位置・titleを確認する |

## Decision 1: Keep the host shell and use document semantics

### Observed facts

The application root already renders `SidebarLayout`, and `SidebarLayout` owns the only `main`. `PageHeader` owns the `h1`. The current route is therefore not allowed to add its own landmark or treat a deleted duplicate `h2` as the label for its entire section.

### Decision

Use a plain wrapper for the detail content, retain the shared `PageHeader`, and keep the return link before the heading. The success page and all state pages must expose exactly one main page heading and one top return link. This follows the semantic HTML review requirement that the production host shell be tested rather than a naked component wrapper.

### Alternatives rejected

- Adding a second `main` to the route would create nested/duplicate landmarks in production.
- Keeping `section[aria-labelledby]` after deleting its `h2` would leave a dangling reference or force a duplicate heading.
- Moving the return link into only the error alert would make success/loading/error focus and document order inconsistent.

## Decision 2: Preserve resolver/data boundaries and fail closed

### Observed facts

The loader now preserves transport/decoding errors. The resolver validates the route ID and rejects malformed/duplicate data before resolving the location. A read-only request to the current CDN source `v2.1.1` returned 16 categories and 169 locations, all 169 IDs unique. No invalid path-unsafe IDs were observed. The live payload has no `area` field, so the existing area derivation is not optional in production. Duplicate-ID behavior remains a fixture-level regression boundary for future upstream regressions.

### Decision

Do not alter the resolver, loader wire format, or duplicate policy in this feature. Tests must include a fixture matching the live `v2.1.1` clean success shape, optional-field omissions, not-found, invalid ID, duplicate ID, and data-load-error. Browser verification uses the live `v2.1.1` data for success and controlled fixtures for duplicate/invalid/load-error states rather than weakening the resolver.

### Alternatives rejected

- Selecting the first duplicate would hide an upstream identity error and violate the 018 contract.
- Treating failed fetch as an empty array would make data-load-error indistinguishable from not-found.
- Assuming `area` exists would regress the current derived-region path.

## Decision 3: Separate the four visual audit contracts

### Observed facts

The existing dirty font test is approximately 1,000 lines and currently reports 74 violations. It mixes font utility parsing, CSS rules, Ruby exception handling, colors, opacity, buttons, and dynamic class expressions. The previous interrupted work was explicitly not approved.

### Decision

Use one small font utility/CSS contract, one color/opacity contract, and one button-size contract. Each test file has a single public purpose and a deterministic bounded source reader. Unknown arbitrary font values and unresolvable class composition are failures, not silent passes. The approved feature answer extends the 16px minimum to all normal UI, while only exact `rt` ruby assistance is exempt.

### Alternatives rejected

- Keeping the monolithic AST file would make review and failure diagnosis unbounded.
- Running `rg` from a test would add an external command dependency and hide parser/source boundary defects.
- Allowing all `.ruby-text` descendants to use small text would exempt ordinary UI accidentally.
- Treating DaisyUI `.btn` as globally exempt would allow the exact control the feature is intended to correct.

## Decision 4: Dynamic metadata shares the location boundary

### Observed facts

The page has a static metadata object and resolves the location in the page body. Next App Router metadata is computed separately from page rendering, so an implementation that independently fetches the CDN can create avoidable duplicate work.

### Decision

Add a dynamic metadata function that uses the same validated location resolution as the page. Implementers must use a shared/cached page data promise or equivalent Next-supported deduplication and test the observable title contract. Success uses `${location.name} - 場所詳細`; all invalid/error states use the existing fallback `場所詳細 | 風ぐるま乗換案内`, without raw ID interpolation.

## Decision 5: Integrate the component only after behavior is Green

### Observed facts

The current dirty component is already a non-client function, but the page still imports it. Its tests contain the detailed DOM contract. Removing it immediately would change the public test boundary while typography, metadata, and state work remain unsettled.

### Decision

Treat `LocationDetailContent` integration as a P2 refactor after all P1 behavior is Green and production-reviewed. Page-level tests remain authoritative. Once runtime search proves no consumer remains, remove the component and its obsolete dedicated tests or migrate meaningful assertions to the page test. Any test edit invalidates the preceding test review.

## Phase 0 conclusion

The approved specification has no unresolved product question. The remaining items are implementation verification tasks: settle the giant dirty font test into reviewed small contracts; remediate all normal UI under 16px in bounded groups; verify live duplicate/area behavior without changing the data boundary; validate metadata dedupe; and perform source→rendered accessibility tree→visual browser checks. No `tasks.md`, production implementation, commit, push, or PR is part of this planning handoff.
