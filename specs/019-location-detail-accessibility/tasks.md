# Tasks: 場所詳細ページのアクセシビリティと情報構造の改善

**Input**: Design documents from `specs/019-location-detail-accessibility/`

**Prerequisites**: `spec.md`、`plan.md`、`research.md`、`data-model.md`、`contracts/location-detail-accessibility.md`、`quickstart.md`

**Repository**: `/opt/data/kazaguruma-transit`
**Branch**: `fix/location-detail-accessibility`
**Baseline HEAD**: `e34c270b4f086ec3291897f60c4ca0efe3d03c77`
**CDN data version**: `v2.1.1`

## Task conventions and blocking rules

- 本tasksは実装の実行契約であり、チェックボックスの完了は親エージェントが実worktree・SHA・コマンド終了コードを再確認してから更新する。
- 本番コードを変更する前に、意味のあるREDを実行し、fresh read-only test-code reviewerから次の両方を取得する。

```text
SUBAGENT_STATUS: COMPLETE
VERDICT: PASS
```

- `CHANGES_REQUESTED`、`INCOMPLETE`、`MAX_ITERATIONS`、完了通知、別byte状態でのGreenはPASSではない。
- test-code reviewerは読み取り専用で、テスト・本番・設定・仕様を書き換えない。production-code reviewerも読み取り専用である。
- testファイルを1byteでも編集した時点で、直前のtest-code review verdictは失効する。RED、fresh review、GREENをやり直す。
- productionファイルを1byteでも編集した時点で、直前のproduction review verdictは失効する。focused GREEN、型、Lint、diff/hash確認、fresh reviewをやり直す。
- REDはcollection/setup errorではなく、未実装の公開契約を失敗理由とする。すぐGreenになるテスト、source文字列だけを読むテスト、virtual production mock、vacuous conditional assertionは禁止する。
- 委任されたwriterは明示したpathだけを書き込み、commit、push、reset、clean、stage、依存追加を行わない。
- 既存のdirty path（`.specify/feature.json`、`src/app/__tests__/font-size-compliance.test.ts`、場所詳細page/test、`LocationDetailContent`/test、019仕様成果物）をリセット・上書きしない。既存byteを変更する場合は、そのsliceのwriter境界に明示し、親が変更前後のSHAを記録する。
- `npm run build`はPrisma/GTFS副作用を伴うため、最終検証でのみ実行する。
- `origin/dev`とのmerge、commit、push、PR作成は本tasksの範囲外である。

## Phase 1: Setup and dirty-worktree reconciliation

**Purpose**: 現行worktreeとapproved designの境界を凍結し、既存の場所詳細変更を未検証の完了扱いにしない。

- [X] T001 `spec.md`、`plan.md`、`research.md`、`data-model.md`、`contracts/location-detail-accessibility.md`、`quickstart.md`を読み合わせ、FR-001〜FR-016、SC-001〜SC-008、CDN `v2.1.1`、認証UIのtypography-only範囲、`KoFiSupport.tsx`のwriter除外、16px全体契約、review gate順序を実装対象として列挙する。`tasks.md`自身の未置換placeholderも確認する。
- [X] T002 `git status --short --untracked-files=all`、`git diff --name-only`、`git diff --check`、対象ファイルのSHA-256を記録し、既存dirty pathと本tasksで新たに書き込めるpathを分離する。`src/app/location-detail/[id]/page.tsx`、`src/components/features/LocationDetailContent.tsx`、両テスト、font auditをHEADへ戻してはならない。
- [X] T003 現行byteに対して次を実行し、ベースラインを再確認する。`npm test -- --runInBand --runTestsByPath 'src/app/location-detail/[id]/__tests__/page.test.tsx' src/components/features/__tests__/LocationDetailContent.test.tsx src/app/__tests__/font-size-compliance.test.ts --silent`、`npx tsc --noEmit --incremental false`、`npm run lint`、`git diff --check`。既存warning、font auditの74違反、collection failure、未実行を分離して記録する。
- [X] T004 `NEXT_PUBLIC_LOCATIONS_DATA_VERSION=v2.1.1`を指定した読み取り専用CDN probeで16カテゴリ・169場所・169一意ID・重複0・不正ID0を再確認し、`千代田区役所`の実ID `5e3b1528-8af6-436a-83af-24ca45b58e12`とoptional fieldの存在を記録する。単体テストから外部CDNへ接続する変更は行わない。

**Checkpoint**: 現行dirty差分、ベースライン失敗、v2.1.1の一意IDデータ、各レビュー対象pathが親側で再確認されている。

---

## Phase 2: Typography contract and 16px remediation (US3 / FR-009, FR-011)

**Purpose**: 巨大で未承認のfont auditを、16px utility/CSS契約へ絞った意味のあるREDに整理し、通常UIを責務別に16px相当以上へ是正する。

### Typography RED and test-code review

- [X] T005 [US3] `src/app/__tests__/font-size-compliance.test.ts`を、font utility/CSSだけを扱う決定的な契約テストへ整理する。対象は`src/app/**/*.tsx`、`src/components/**/*.tsx`、`src/app/globals.css`。`text-xs`、`text-sm`、variant/prefix/important付き16px未満utility、16px未満arbitrary value、未知・解析不能値、CSS `font-size`を検出し、exactな`src/app/globals.css`の`rt { font-size: 70%; }`だけを許可する。色、opacity、button、Ko-fiはこのテストへ混ぜない。実行: `npm test -- --runInBand --runTestsByPath src/app/__tests__/font-size-compliance.test.ts --silent`。期待: collectionではなく、現行production sourceの違反でRED。
- [X] T006 `src/app/__tests__/font-size-compliance.test.ts`のsettled bytesをfresh read-only test-code reviewerへ委任する。variant/important/arbitrary構文、unknown fail-closed、local class composition、狭い`rt`例外、test/PDF除外、`rg`外部依存なし、診断のpath/line性を確認し、`VERDICT: PASS`までT007以降のfont本番修正を開始しない。

### Typography production slice: location detail

- [X] T007 [US3] T006 PASS後、`src/app/location-detail/[id]/page.tsx`、`src/components/features/LocationDetailContent.tsx`、必要な詳細ページ固有のstyle sourceだけを対象に、通常本文・状態文・リンク・CTAを`text-base`相当以上へ修正する。`rt`を理由に通常要素を免除せず、`text-base-content`境界を壊さず、Ko-fiへ触れない。
- [X] T008 [US3] T007のproduction bytesに対し、詳細ページfont audit、`src/app/location-detail/[id]/__tests__/page.test.tsx`、`src/components/features/__tests__/LocationDetailContent.test.tsx`のfocused Jest、`npx tsc --noEmit --incremental false`、対象Lint、`git diff --check`、SHA/statusを実行する。期待: T005の違反数から詳細ページ担当分が消え、他の既存違反は別sliceとして残る。
- [X] T009 [US3] `src/app/location-detail/[id]/page.tsx`、`src/components/features/LocationDetailContent.tsx`、関連testのsettled bytesをfresh read-only production-code reviewerへ委任する。16px契約、state shell、shared main/header境界、未指定pathへの変更なし、Ko-fi非変更を確認し、`VERDICT: PASS`まで次のfont sliceを開始しない。

### Typography production slice: remaining app routes

- [X] T010 [US3] T009 PASS後、T005の診断manifestに含まれる`src/app/**/*.tsx`（`location-detail/[id]`とtest除外）だけをbounded production writerへ渡し、通常UIの16px未満指定を`text-base`相当以上へ修正する。動的外部`className`は推測で書き換えず、監査境界を越える変更をしない。
- [X] T011 [US3] T010後、font audit、変更された`src/app/**/__tests__/*.test.tsx`、`npx tsc --noEmit --incremental false`、対象Lint、`git diff --check`、変更path/SHAを実行し、T010のmanifest以外に変更がないことを確認する。
- [X] T012 [US3] T010のsettled `src/app/**/*.tsx` production bytesをfresh read-only reviewerへ委任する。ページの可読性、native controlの既存挙動、Tailwind utilityの実効サイズ、scopeを確認し、`VERDICT: PASS`を取得する。

### Typography production slice: feature/discussion/auth components

- [X] T013 [US3] T012 PASS後、T005のmanifestに含まれる`src/components/features/**/*.tsx`（ただし`src/components/features/KoFiSupport.tsx`を除く）、`src/components/discussion/**/*.tsx`、`src/components/auth/**/*.tsx`だけをbounded writerへ渡し、通常UIの16px未満指定を修正する。認証コンポーネントは文字サイズ・色だけを変更し、認証の振る舞い・データフローを変更しない。Ruby wrapper、外部`className` boundary、Ko-fi支援欄を勝手に例外化・改変しない。
- [X] T014 [US3] T013後、font audit、feature/discussion/authの該当component tests、`npx tsc --noEmit --incremental false`、対象Lint、`git diff --check`、path/SHAを実行する。既存warningと新規failureを分離する。
- [X] T015 [US3] T013のsettled feature/discussion/auth production bytesをfresh read-only reviewerへ委任し、通常要素の16px契約、認証UIの振る舞い非変更、Ruby例外の狭さ、主要操作の非退行、`KoFiSupport.tsx`の変更なし、変更境界を確認する。明示的`VERDICT: PASS`を要求する。

### Typography production slice: shared UI/layout and CSS

- [X] T016 [US3] T015 PASS後、T005のmanifestに含まれる`src/components/ui/**/*.tsx`、`src/components/layouts/**/*.tsx`、`src/app/globals.css`だけをbounded writerへ渡し、通常UIを16px相当以上へ修正する。`src/app/globals.css`のexact `rt` rule、focus-visible styling、Ko-fi card構造を維持する。
- [X] T017 [US3] T016後、font audit、共有layout/UI tests、`npx tsc --noEmit --incremental false`、対象Lint、`git diff --check`、path/SHAを実行する。全体font契約のREDが解消し、`rt`以外のCSS小サイズが0件であることを確認する。
- [X] T018 [US3] T016のsettled shared UI/layout/CSS production bytesをfresh read-only reviewerへ委任し、single `main`、focus-visible、DaisyUI/Ruby境界、CSS例外、Ko-fi非変更を確認する。`VERDICT: PASS`までcolor/button chapterへ進まない。

**Typography checkpoint**: 全体font契約がGreen、詳細ページと通常UIの算出サイズが16px以上、strict TypeScript・Lint・diff checkが各sliceで確認済み、各production reviewがPASS。

---

## Phase 3: Color and opacity contract (US3 / FR-010)

**Purpose**: 通常文字の色・opacity監査をfont parserやbutton契約から分離し、低コントラスト指定を除去する。

### Color RED and test-code review

- [X] T019 [US3] `src/app/__tests__/color-compliance.test.ts`を新規作成し、`src/app/**/*.tsx`、`src/components/**/*.tsx`、詳細ページの通常文字について、`text-base-content`等のtheme-safe token、`text-black/60`等の低コントラストutility、通常文字へのopacity utility、低コントラストmuted tokenを検査する。`text-(color:--color)`、`text-[red]`、`text-[theme(...)]`等の非典型arbitrary color記法は今回のcolor contractのスコープ外とし、font-size用の`text-[length:...]`もcolor違反にしない。class absenceだけを実コントラスト測定と誤認せず、Ko-fi cardの非対象境界を明示する。実ブラウザ受入ではlight/dark両テーマで通常文字`>=4.5:1`、大きな文字`>=3:1`、適用対象の非テキスト要素`>=3:1`を検証する（大きな文字は18pt通常または14pt太字、約24pxまたは18.66px太字）。実行: `npm test -- --runInBand --runTestsByPath src/app/__tests__/color-compliance.test.ts --silent`。期待:現行sourceの違反を理由とするRED。
- [X] T020 `src/app/__tests__/color-compliance.test.ts`のsettled bytesをfresh read-only test-code reviewerへ委任する。通常文字と装飾の境界、opacityの検出、dynamic classのfail-closed方針、Ko-fi除外、実ブラウザcontrast確認との分離を確認し、`VERDICT: PASS`までT021を開始しない。

### Color production slices

- [X] T021 [US3] T020 PASS後、`src/app/location-detail/[id]/page.tsx`、`src/components/features/LocationDetailContent.tsx`および詳細ページ関連の診断pathだけをbounded writerへ渡し、通常文字・`dt`/`dd`・状態文・CTAの色を`text-base-content`等へ揃える。`text-black/60`、通常文字opacity、不要なmuted tokenを除去する。
- [X] T022 [US3] T021後、color contract、location detail focused Jest、strict TypeScript、対象Lint、`git diff --check`、path/SHAを実行する。
- [X] T023 [US3] T021のsettled production bytesをfresh read-only reviewerへ委任し、色token、native link focus、状態メッセージ、Ko-fi非変更を確認して`VERDICT: PASS`を取得する。
- [X] T024 [US3] T023 PASS後、color manifestに含まれる残りの`src/app/**/*.tsx`、`src/components/**/*.tsx`、対象CSSを責務別にbounded writerへ渡して低コントラスト/opacity指定を修正する。ただし`src/components/features/KoFiSupport.tsx`はwriter対象から除外し、認証UIは通常文字の色だけを対象とする。変更pathをwriter開始前に固定し、未報告の全体置換を行わない。
- [X] T025 [US3] T024後、`color-compliance.test.ts`、影響範囲のfocused Jest、strict TypeScript、対象Lint、`git diff --check`、path/SHAを実行する。
- [X] T026 [US3] T024のsettled production bytesをfresh read-only reviewerへ委任し、通常文字token、light/dark theme前提、opacity境界、scopeを確認して`VERDICT: PASS`を取得する。

---

## Phase 4: Button/control font contract (US2/US3 / FR-007, FR-009)

**Purpose**: DaisyUIの既定14pxに依存する通常button/controlを明示的な16px相当へ揃える。

### Button RED and test-code review

- [X] T027 [US3] `src/app/__tests__/button-font-size-compliance.test.ts`を新規作成し、通常のbuttonとbutton-like control、場所詳細CTAを実際のrendered/source boundaryで検査する。明示的な典型named utilityである`text-base`以上または同等の16px指定を要求する。`text-[...]`、`text-(...)`、`text-[theme(...)]`等の非典型arbitrary font-size記法は今回のbutton contractのスコープ外とし、検出・違反化しない。Ko-fi cardのiframe/cardは通常buttonの対象にしない。実行: `npm test -- --runInBand --runTestsByPath src/app/__tests__/button-font-size-compliance.test.ts --silent`。期待:既定サイズ依存を理由とするRED。
- [X] T028 `src/app/__tests__/button-font-size-compliance.test.ts`のsettled bytesをfresh read-only test-code reviewerへ委任する。buttonとlink-as-navigationの分類、DaisyUI既定値、CTA順序、Ko-fi除外、実DOMとsourceの境界を確認し、`VERDICT: PASS`までT029を開始しない。production sourceにはcomposition helperの実使用がないことを確認済みのため、helper名をloop bindingがshadowする非典型境界は今回のcontract対象外とする。

### Button production implementation and review

- [X] T029 [US2][US3] T028 PASS後、T027の診断pathに含まれる通常button/controlと`src/app/location-detail/[id]/page.tsx`または一時的な`src/components/features/LocationDetailContent.tsx`のCTAだけをbounded writerへ渡し、16px相当の明示指定を追加する。移動操作をbuttonへ戻さず、「ここへ行く」はnative `a`のまま維持する。
- [X] T030 [US2][US3] T029後、button contract、location detail focused Jest、該当control tests、strict TypeScript、対象Lint、`git diff --check`、path/SHAを実行する。
- [X] T031 [US2][US3] T029のsettled production bytesをfresh read-only reviewerへ委任し、通常controlのcomputed-size前提、native anchor、CTA accessibility、DaisyUI class、Ko-fi非変更を確認して`VERDICT: PASS`を取得する。初回reviewのFAILはproduction findingではなく親側SHA manifestの誤記だったため、ユーザー判断によりPASS扱いとした。

---

## Phase 5: Heading, navigation, definition-list, image, and state regression reconciliation (US1/US2/US4 / FR-001〜FR-008, FR-012)

**Purpose**: 既存dirtyのslice 1/2を再読し、追加で必要な公開契約だけをREDとして表現する。現在の本番byteを過去のレビュー通知だけでPASS扱いにしない。

### Semantic regression RED and test-code review

- [X] T032 [US1][US2][US4] `src/app/location-detail/[id]/__tests__/page.test.tsx`、`src/components/features/__tests__/LocationDetailContent.test.tsx`、`src/components/layouts/__tests__/SidebarLayout.test.tsx`、および`src/app/location-detail/[id]/loading.tsx`の現行契約を再読し、current hashを記録する。未検証契約を3 test pathへ追加した。正本は3 suites/20 tests中19 GREEN、loadingの戻りlink欠落のみ意味あるRED、collection/setup/parser errorなし。target ESLint、strict TypeScript、scoped diff-checkはPASS。
- [X] T033 T032でsettledしたpage/loading/content/layout testsをfresh read-only test-code reviewerへ委任した。3 test SHA不変、`VERDICT: PASS`。shared `main`/`PageHeader` boundary、single h1/提供情報h2、native tagと`/locations` href、definition-list semantics、empty-alt/no-role、conditional omission、loadingを含むstate differentiation、Ko-Fi除外、ownership分離、vacuous assertionなしを確認した。

### Semantic production correction and review

- [X] T034 [US1][US2][US4] T033 PASS後、T032で確認されたloading不足契約に限定し、`src/app/location-detail/[id]/loading.tsx`へPageHeader前のnative `<a href="/locations">場所一覧に戻る</a>`を最小追加した。page/content/layout、Ko-Fi source、resolver/data formatは変更していない。
- [X] T035 [US1][US2][US4] T034後、T032のfocused aggregate（3 suites/20 tests）、page focused（1 suite/6 tests）、strict TypeScript、loading対象Lint、loading対象`git diff --check`、path/SHAを実行し、すべてPASS。loading SHAは`6467cc2b698d54ba7c50741ce5aee24c84c4ee495d78e84e0b2a43c42aeec490`、manifest外production SHAは不変。
- [X] T036 [US1][US2][US4] T034のsettled page/loading/content/layout production bytesをfresh read-only production/a11y reviewerへ委任した。source→rendered DOM/accessibility treeの三層、single main/h1、全状態のtop-only native link、`dt`/`dd`、empty-alt/no-role、Ko-Fi保持、resolver fail-closed境界を確認し、`SUBAGENT_STATUS: COMPLETE`、`VERDICT: PASS`を取得した。全対象SHA不変、findingなし。

---

## Phase 6: Dynamic metadata and data-boundary contract (US4 / FR-013, SC-007)

**Purpose**: 有効な場所名を動的titleへ反映し、metadataと本文で異なるID/data解決を行わない。

### Metadata RED and test-code review

- [X] T037 [US4] `src/app/location-detail/[id]/__tests__/page.test.tsx`へdynamic metadata公開契約を追加した。実在ID/実在名、別有効名、invalid/unknown/duplicate/data-load-error/transport errorの厳密fallback、raw ID非反映、metadata/page同一公開data境界を検証する。正本は1 suite/14 tests中6 GREEN・8 REDで、REDは`generateMetadata`未実装の明示assertionのみ。collection/setup/parser/TypeErrorなし。
- [X] T038 T037のsettled metadata testsをfresh read-only test-code reviewerへ委任し、`VERDICT: PASS`を取得した。SHA不変、非空fixture、厳密title/fallback、公開境界検証、過仕様化なし、production/他test/Ko-Fi/spec docs非変更を確認した。

### Metadata production implementation and review

- [X] T039 [US4] T038 PASS後、`src/app/location-detail/[id]/page.tsx`にdynamic `generateMetadata`を実装した。本文と同じ`loadKeyLocationsDataResult` + `resolveLocationDetail`境界を再利用し、成功時`${location.name} - 場所詳細`、非success時`場所詳細 | 風ぐるま乗換案内`、既存descriptionを返す。static metadataはNext export規則に従い削除し、旧import/CTA期待を持つ既存consumer testは別test-only互換修正で現行public contractへ更新した。
- [X] T040 [US4] T039後、metadata/page focused Jest（1 suite/14 tests）、accessible-route-pages（1 suite/7 tests）、semantic aggregate（3 suites/28 tests）、strict TypeScript、対象Lint、`git diff --check`、path/SHAを実行し、success title、fallback title、page behavior、公開data boundaryをPASS確認した。page SHAは`b9916f101b95fd8ac24b2abcef9bdc152fd4b52da7e5badb5b69960148c2866b`。
- [X] T041 [US4] T039のsettled `src/app/location-detail/[id]/page.tsx`とmetadata/page testsをfresh read-only production reviewerへ委任した。Next App Router metadata boundary、Promise params、resolver reuse、fallback安全性、既存DOM/semantic/a11y契約、loader/resolver、Ko-Fi境界を確認し、全8 SHA不変・`VERDICT: PASS`・findingなしを取得した。

---

## Phase 7: Green-after-refactor integration (US5 / FR-014, FR-015)

**Purpose**: P1の見出し、navigation、structure、font、color、button、state、metadataがすべてGreenかつproduction-reviewedになった後だけ、詳細componentをpageへ統合する。

### Integration RED and test-code review

- [X] T042 [US5] T009、T012、T015、T018、T023、T026、T031、T036、T041のproduction review PASS、focused GREEN、strict TypeScript、Lint、diff結果を親側で再照合した。cross-cutting contractは3 suites/33 tests、semantic/metadata consumerは4 suites/35 tests、strict TypeScript、full Lint（既存warningのみ）、対象diff checkをPASS確認した。default全体diff checkのCRLFは既存`src/app/locations/page.tsx` baselineのみ。
- [X] T043 [US5] `src/app/location-detail/[id]/__tests__/page.test.tsx`へ、`LocationDetailContent`をruntime importせずページレベルの公開挙動だけでsuccess、optional omission、destination href/order、definition-list、image、state、metadataを検証するintegration REDを追加した。real page renderで16件がGREEN、component runtime importのTypeScript AST境界1件だけが意図的REDとなった。Ko-Fi hostはshared-layout testの責務として重複させなかった。
- [X] T044 T043のsettled page integration testsをfresh read-only test-code reviewerへ委任した。page-level public boundary、real render fixture、component責務、TypeScript ASTによるcomponent runtime import absence境界、Ko-Fi ownershipを確認し、`VERDICT: PASS`を取得した。page 16 testsとcomponent 9 testsはGREEN、AST runtime import boundaryのみ意図的RED。

### Integration production implementation and review

- [X] T045 [US5] T044 PASS後、`src/app/location-detail/[id]/page.tsx`へdetail markupとhelpersを統合し、`LocationDetailContent` runtime importを除去した。loader/resolver、PageHeader、state shell、native links、detail semantics、CTA、Ko-Fi/layout境界を維持した。
- [X] T046 [US5] T045後、page/metadata/accessible-route/semantic aggregate、button/accessibility contract、strict TypeScript、Lint、scoped diff check、runtime consumer searchを実行した。CTA assertionをpage testへ移し、component専用testとtest-only direct importsを削除・整理した後、`LocationDetailContent.tsx`と専用testを削除した。runtime consumer/import/requireは0件、削除対象不在、5 suites/47 tests GREEN。全体diff checkのCRLFは既存`src/app/locations/page.tsx` baseline。
- [X] T047 [US5] settled integration page、移行test、削除component、direct consumer境界をfresh read-only production reviewerへ委任し、全target SHA不変・deleted paths不在・`SUBAGENT_STATUS: COMPLETE`・`VERDICT: PASS`・findingなしを取得した。前回のdigest evidence mismatchは親側再計算後のfresh reviewで解消した。

---

## Phase 8: Final cross-cutting verification and browser acceptance

**Purpose**: 全体の自動検証、実ブラウザ、CDN v2.1.1、最終scopeを、未実行やwarningと混同せず記録する。

- [X] T048 `npm test -- --runInBand`を実行し、`127 suites passed / 2 failed / 2 skipped`、`722 tests passed / 2 failed / 17 skipped`を記録した。失敗は今回のscope外かつ既存dirty変更に関連する`src/app/license/__tests__/page.responsive-layout.test.tsx`、`src/components/ui/__tests__/UserIdentity.test.tsx`のみ。strict TypeScript、`npm run lint`、`git diff --check`、`uvx --from specify-cli specify check`も個別実行した。Lintはwarning/deprecationのみ、strict diff checkは既存`src/app/locations/page.tsx`のCRLF/trailing whitespaceのみ、tolerant diff checkはPASS。
- [X] T049 `NEXT_PUBLIC_LOCATIONS_DATA_VERSION=v2.1.1 npm run dev`とChromium/CDPで実在routeをdesktop/narrow mobile確認した。valid title、single `main`/`h1`、上部`/locations` link、destination/external/license href、`dt`→`dd`、`img[alt=""]`/roleなし、4:3、font 16px、Ko-Fi iframe、native focusを確認した。初回browser findingとしてCTAが`display:inline`で実測21pxだったため、TDDで`inline-flex` RED→fresh test review PASS→page.tsx bounded修正を実施し、final desktop rect `117.5×44px`、mobile rect `115.5×44px`、overflowなしを再確認した。
- [X] T050 controlled fixture/route testsとbrowser acceptanceでduplicate-ID、invalid-ID、unknown-ID、data-load/transport error、loadingを確認し、stateを相互排他的に検証した。loadingのPageHeader、日本語status、上部戻りlink、各stateのsingle h1/link/no-success-detailsを確認した。さらにdark theme CTAのcontrastが初回4.12997:1だったため、TDDで`dark:text-white` RED→fresh test review PASS→bounded修正を実施し、final light contrast `5.1982:1`、dark contrast `4.6593:1`、通常文字4.5:1基準を満たすことを確認した。
- [X] T051 `npm run build`を最終かつ別ゲートとして実行し、exit 0を確認した。内部`npm run import-gtfs`は`transit-config.json`欠如を報告したがexit 0で継続したため、その副作用/errorをbuild成功と混同せず記録した。
- [X] T052 `git status --short --untracked-files=all`、`git diff --name-only`、全変更/新規fileのSHA-256、`git diff --check`、019 docsのrelative-link/placeholder/末尾空白検査を実行した。scope外runtime source、`KoFiSupport.tsx`、`.specify/feature.json`、既存dirty testは保持し、staged pathsなし、commit/push/PRなしを確認した。仕様check、build、focused/関連suite、strict TypeScript、Lint、browser、hash/statusを未実行と混同していない。
- [X] T053 T049/T050の最終production bytesに対するfresh read-only production/a11y reviewを実施し、`SUBAGENT_STATUS: COMPLETE`、`VERDICT: PASS`、`modified:false`を取得した。18 reviewed/protected pathsのstart/end SHAはすべて64桁lowercaseかつ不変、staged pathsなし、canonical 5 suites/47 tests、supplemental 4 suites/22 tests、strict TypeScript、target/full lint、scoped diff checkがPASS。browser evidence、metadata/state/semantic/Ko-Fi/deletion boundaryにblocking findingなし。

**Final checkpoint**: 自動検証、ブラウザ検証、build、CDN v2.1.1、scope/hashの結果が個別に記録され、すべてのrequired production reviewが明示的PASSである。warning、未実行、timeout、子エージェント報告だけでは完了扱いにしない。

---

## Dependencies and execution order

### Phase dependencies

- **Phase 1 Setup**: T001〜T004。既存dirty境界、v2.1.1 evidence、baselineを親が確認する。
- **Phase 2 Typography**: T005のRED → T006 test review PASS → font production slices T007〜T018。各sliceのproduction review PASSが次sliceをblockする。
- **Phase 3 Color**: T019 RED → T020 test review PASS → T021〜T026。font全体checkpoint後に開始する。
- **Phase 4 Button**: T027 RED → T028 test review PASS → T029〜T031。color checkpoint後に開始する。
- **Phase 5 Semantics**: T032 RED/reconciliation → T033 test review PASS → T034〜T036。既存dirty実装を無条件にPASS扱いしない。
- **Phase 6 Metadata**: T037 RED → T038 test review PASS → T039〜T041。semantic production review PASS後に開始する。
- **Phase 7 Refactor**: T042で全P1 review PASSを確認後、T043 RED → T044 test review PASS → T045〜T047。
- **Phase 8 Final**: T047 production review PASS後にT048〜T053。T049/T050で実ブラウザfindingが出た場合は、各々RED→fresh test review PASS→bounded production→GREEN→fresh production reviewの順で再実行する。

### User story mapping

- **US1**: T032〜T036（heading, dl, image, information structure）
- **US2**: T032〜T036、T027〜T031（native return/destination/external links and control size）
- **US3**: T005〜T031（global 16px, color/opacity, button/control contracts）
- **US4**: T032〜T041、T049〜T050（state shells, dynamic metadata, browser acceptance）
- **US5**: T042〜T047（Green-after-refactor page integration）

### Hard review gates

| Gate | Reviewed test paths | Blocks |
|---|---|---|
| T006 | `src/app/__tests__/font-size-compliance.test.ts` | all typography production edits |
| T009 | detail/page typography bytes and tests | remaining app typography slice |
| T012 | remaining `src/app/**/*.tsx` typography bytes | feature/discussion/auth typography slice |
| T015 | feature/discussion/auth typography bytes（`KoFiSupport.tsx`除外） | shared UI/layout/CSS typography slice |
| T018 | shared UI/layout/CSS typography bytes | color chapter |
| T020 | `src/app/__tests__/color-compliance.test.ts` | color production edits |
| T023/T026 | detail/remaining color production bytes | button chapter |
| T028 | `src/app/__tests__/button-font-size-compliance.test.ts` | button production edits |
| T031 | button/detail control production bytes | semantic reconciliation |
| T033 | page/content/layout semantic tests | semantic production correction |
| T036 | page/content/layout final semantic bytes | metadata chapter |
| T038 | metadata/page tests | dynamic metadata production |
| T041 | dynamic metadata/page bytes | integration refactor |
| T044 | page integration tests | component integration/deletion |
| T047 | final integrated page/component bytes | full final verification |

### Parallel opportunities

- T001〜T004は読み取り専用確認だが、親のworktree freezeとCDN probeを先に完了し、結果を同じbaseline ledgerへ統合する。
- Independent test review dispatches are never parallelized with writers or other workstreams. Shared files and sequential review gates make implementation serial by design.
- Within a production slice, only independent read-only validators may run in parallel after the final write; the writer must never edit a file another writer owns.

## Verification command reference

```bash
# Detail and semantic aggregate
npm test -- --runInBand --runTestsByPath \
  'src/app/location-detail/[id]/__tests__/page.test.tsx' \
  src/components/features/__tests__/LocationDetailContent.test.tsx \
  src/components/layouts/__tests__/SidebarLayout.test.tsx \
  --silent

# Cross-cutting contracts
npm test -- --runInBand --runTestsByPath \
  src/app/__tests__/font-size-compliance.test.ts \
  src/app/__tests__/color-compliance.test.ts \
  src/app/__tests__/button-font-size-compliance.test.ts \
  --silent

# Static gates
npx tsc --noEmit --incremental false
npm run lint
git diff --check
uvx --from specify-cli specify check

# Browser data version
NEXT_PUBLIC_LOCATIONS_DATA_VERSION=v2.1.1 npm run dev
```

## Notes

- `[P]`は本tasksでは、shared file ownershipまたはreview gateと競合しない読み取り専用確認に限って使用する。writer implementationを並列化しない。
- `tasks.md`のチェック状態は、親が実際の変更path、file hash、focused command、review markerを検証した後にだけ更新する。
- `v2.1.1`実データは一意IDだが、duplicate-ID fixtureはresolverの将来回帰を検出するため必須である。
- ここでの完了はcommit/pushを意味しない。
