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

- [ ] T001 `spec.md`、`plan.md`、`research.md`、`data-model.md`、`contracts/location-detail-accessibility.md`、`quickstart.md`を読み合わせ、FR-001〜FR-016、SC-001〜SC-008、CDN `v2.1.1`、認証UIのtypography-only範囲、`KoFiSupport.tsx`のwriter除外、16px全体契約、review gate順序を実装対象として列挙する。`tasks.md`自身の未置換placeholderも確認する。
- [ ] T002 `git status --short --untracked-files=all`、`git diff --name-only`、`git diff --check`、対象ファイルのSHA-256を記録し、既存dirty pathと本tasksで新たに書き込めるpathを分離する。`src/app/location-detail/[id]/page.tsx`、`src/components/features/LocationDetailContent.tsx`、両テスト、font auditをHEADへ戻してはならない。
- [ ] T003 現行byteに対して次を実行し、ベースラインを再確認する。`npm test -- --runInBand --runTestsByPath 'src/app/location-detail/[id]/__tests__/page.test.tsx' src/components/features/__tests__/LocationDetailContent.test.tsx src/app/__tests__/font-size-compliance.test.ts --silent`、`npx tsc --noEmit --incremental false`、`npm run lint`、`git diff --check`。既存warning、font auditの74違反、collection failure、未実行を分離して記録する。
- [ ] T004 `NEXT_PUBLIC_LOCATIONS_DATA_VERSION=v2.1.1`を指定した読み取り専用CDN probeで16カテゴリ・169場所・169一意ID・重複0・不正ID0を再確認し、`千代田区役所`の実ID `5e3b1528-8af6-436a-83af-24ca45b58e12`とoptional fieldの存在を記録する。単体テストから外部CDNへ接続する変更は行わない。

**Checkpoint**: 現行dirty差分、ベースライン失敗、v2.1.1の一意IDデータ、各レビュー対象pathが親側で再確認されている。

---

## Phase 2: Typography contract and 16px remediation (US3 / FR-009, FR-011)

**Purpose**: 巨大で未承認のfont auditを、16px utility/CSS契約へ絞った意味のあるREDに整理し、通常UIを責務別に16px相当以上へ是正する。

### Typography RED and test-code review

- [ ] T005 [US3] `src/app/__tests__/font-size-compliance.test.ts`を、font utility/CSSだけを扱う決定的な契約テストへ整理する。対象は`src/app/**/*.tsx`、`src/components/**/*.tsx`、`src/app/globals.css`。`text-xs`、`text-sm`、variant/prefix/important付き16px未満utility、16px未満arbitrary value、未知・解析不能値、CSS `font-size`を検出し、exactな`src/app/globals.css`の`rt { font-size: 70%; }`だけを許可する。色、opacity、button、Ko-fiはこのテストへ混ぜない。実行: `npm test -- --runInBand --runTestsByPath src/app/__tests__/font-size-compliance.test.ts --silent`。期待: collectionではなく、現行production sourceの違反でRED。
- [ ] T006 `src/app/__tests__/font-size-compliance.test.ts`のsettled bytesをfresh read-only test-code reviewerへ委任する。variant/important/arbitrary構文、unknown fail-closed、local class composition、狭い`rt`例外、test/PDF除外、`rg`外部依存なし、診断のpath/line性を確認し、`VERDICT: PASS`までT007以降のfont本番修正を開始しない。

### Typography production slice: location detail

- [ ] T007 [US3] T006 PASS後、`src/app/location-detail/[id]/page.tsx`、`src/components/features/LocationDetailContent.tsx`、必要な詳細ページ固有のstyle sourceだけを対象に、通常本文・状態文・リンク・CTAを`text-base`相当以上へ修正する。`rt`を理由に通常要素を免除せず、`text-base-content`境界を壊さず、Ko-fiへ触れない。
- [ ] T008 [US3] T007のproduction bytesに対し、詳細ページfont audit、`src/app/location-detail/[id]/__tests__/page.test.tsx`、`src/components/features/__tests__/LocationDetailContent.test.tsx`のfocused Jest、`npx tsc --noEmit --incremental false`、対象Lint、`git diff --check`、SHA/statusを実行する。期待: T005の違反数から詳細ページ担当分が消え、他の既存違反は別sliceとして残る。
- [ ] T009 [US3] `src/app/location-detail/[id]/page.tsx`、`src/components/features/LocationDetailContent.tsx`、関連testのsettled bytesをfresh read-only production-code reviewerへ委任する。16px契約、state shell、shared main/header境界、未指定pathへの変更なし、Ko-fi非変更を確認し、`VERDICT: PASS`まで次のfont sliceを開始しない。

### Typography production slice: remaining app routes

- [ ] T010 [US3] T009 PASS後、T005の診断manifestに含まれる`src/app/**/*.tsx`（`location-detail/[id]`とtest除外）だけをbounded production writerへ渡し、通常UIの16px未満指定を`text-base`相当以上へ修正する。動的外部`className`は推測で書き換えず、監査境界を越える変更をしない。
- [ ] T011 [US3] T010後、font audit、変更された`src/app/**/__tests__/*.test.tsx`、`npx tsc --noEmit --incremental false`、対象Lint、`git diff --check`、変更path/SHAを実行し、T010のmanifest以外に変更がないことを確認する。
- [ ] T012 [US3] T010のsettled `src/app/**/*.tsx` production bytesをfresh read-only reviewerへ委任する。ページの可読性、native controlの既存挙動、Tailwind utilityの実効サイズ、scopeを確認し、`VERDICT: PASS`を取得する。

### Typography production slice: feature/discussion/auth components

- [ ] T013 [US3] T012 PASS後、T005のmanifestに含まれる`src/components/features/**/*.tsx`（ただし`src/components/features/KoFiSupport.tsx`を除く）、`src/components/discussion/**/*.tsx`、`src/components/auth/**/*.tsx`だけをbounded writerへ渡し、通常UIの16px未満指定を修正する。認証コンポーネントは文字サイズ・色だけを変更し、認証の振る舞い・データフローを変更しない。Ruby wrapper、外部`className` boundary、Ko-fi支援欄を勝手に例外化・改変しない。
- [ ] T014 [US3] T013後、font audit、feature/discussion/authの該当component tests、`npx tsc --noEmit --incremental false`、対象Lint、`git diff --check`、path/SHAを実行する。既存warningと新規failureを分離する。
- [ ] T015 [US3] T013のsettled feature/discussion/auth production bytesをfresh read-only reviewerへ委任し、通常要素の16px契約、認証UIの振る舞い非変更、Ruby例外の狭さ、主要操作の非退行、`KoFiSupport.tsx`の変更なし、変更境界を確認する。明示的`VERDICT: PASS`を要求する。

### Typography production slice: shared UI/layout and CSS

- [ ] T016 [US3] T015 PASS後、T005のmanifestに含まれる`src/components/ui/**/*.tsx`、`src/components/layouts/**/*.tsx`、`src/app/globals.css`だけをbounded writerへ渡し、通常UIを16px相当以上へ修正する。`src/app/globals.css`のexact `rt` rule、focus-visible styling、Ko-fi card構造を維持する。
- [ ] T017 [US3] T016後、font audit、共有layout/UI tests、`npx tsc --noEmit --incremental false`、対象Lint、`git diff --check`、path/SHAを実行する。全体font契約のREDが解消し、`rt`以外のCSS小サイズが0件であることを確認する。
- [ ] T018 [US3] T016のsettled shared UI/layout/CSS production bytesをfresh read-only reviewerへ委任し、single `main`、focus-visible、DaisyUI/Ruby境界、CSS例外、Ko-fi非変更を確認する。`VERDICT: PASS`までcolor/button chapterへ進まない。

**Typography checkpoint**: 全体font契約がGreen、詳細ページと通常UIの算出サイズが16px以上、strict TypeScript・Lint・diff checkが各sliceで確認済み、各production reviewがPASS。

---

## Phase 3: Color and opacity contract (US3 / FR-010)

**Purpose**: 通常文字の色・opacity監査をfont parserやbutton契約から分離し、低コントラスト指定を除去する。

### Color RED and test-code review

- [ ] T019 [US3] `src/app/__tests__/color-compliance.test.ts`を新規作成し、`src/app/**/*.tsx`、`src/components/**/*.tsx`、詳細ページの通常文字について、`text-base-content`等のtheme-safe token、`text-black/60`等の低コントラストutility、通常文字へのopacity utility、低コントラストmuted tokenを検査する。class absenceだけを実コントラスト測定と誤認せず、Ko-fi cardの非対象境界を明示する。実ブラウザ受入ではlight/dark両テーマで通常文字`>=4.5:1`、大きな文字`>=3:1`、適用対象の非テキスト要素`>=3:1`を検証する（大きな文字は18pt通常または14pt太字、約24pxまたは18.66px太字）。実行: `npm test -- --runInBand --runTestsByPath src/app/__tests__/color-compliance.test.ts --silent`。期待:現行sourceの違反を理由とするRED。
- [ ] T020 `src/app/__tests__/color-compliance.test.ts`のsettled bytesをfresh read-only test-code reviewerへ委任する。通常文字と装飾の境界、opacityの検出、dynamic classのfail-closed方針、Ko-fi除外、実ブラウザcontrast確認との分離を確認し、`VERDICT: PASS`までT021を開始しない。

### Color production slices

- [ ] T021 [US3] T020 PASS後、`src/app/location-detail/[id]/page.tsx`、`src/components/features/LocationDetailContent.tsx`および詳細ページ関連の診断pathだけをbounded writerへ渡し、通常文字・`dt`/`dd`・状態文・CTAの色を`text-base-content`等へ揃える。`text-black/60`、通常文字opacity、不要なmuted tokenを除去する。
- [ ] T022 [US3] T021後、color contract、location detail focused Jest、strict TypeScript、対象Lint、`git diff --check`、path/SHAを実行する。
- [ ] T023 [US3] T021のsettled production bytesをfresh read-only reviewerへ委任し、色token、native link focus、状態メッセージ、Ko-fi非変更を確認して`VERDICT: PASS`を取得する。
- [ ] T024 [US3] T023 PASS後、color manifestに含まれる残りの`src/app/**/*.tsx`、`src/components/**/*.tsx`、対象CSSを責務別にbounded writerへ渡して低コントラスト/opacity指定を修正する。ただし`src/components/features/KoFiSupport.tsx`はwriter対象から除外し、認証UIは通常文字の色だけを対象とする。変更pathをwriter開始前に固定し、未報告の全体置換を行わない。
- [ ] T025 [US3] T024後、`color-compliance.test.ts`、影響範囲のfocused Jest、strict TypeScript、対象Lint、`git diff --check`、path/SHAを実行する。
- [ ] T026 [US3] T024のsettled production bytesをfresh read-only reviewerへ委任し、通常文字token、light/dark theme前提、opacity境界、scopeを確認して`VERDICT: PASS`を取得する。

---

## Phase 4: Button/control font contract (US2/US3 / FR-007, FR-009)

**Purpose**: DaisyUIの既定14pxに依存する通常button/controlを明示的な16px相当へ揃える。

### Button RED and test-code review

- [ ] T027 [US3] `src/app/__tests__/button-font-size-compliance.test.ts`を新規作成し、通常のbuttonとbutton-like control、場所詳細CTAを実際のrendered/source boundaryで検査する。明示的`text-base`または同等の16px指定を要求し、Ko-fi cardのiframe/cardは通常buttonの対象にしない。実行: `npm test -- --runInBand --runTestsByPath src/app/__tests__/button-font-size-compliance.test.ts --silent`。期待:既定サイズ依存を理由とするRED。
- [ ] T028 `src/app/__tests__/button-font-size-compliance.test.ts`のsettled bytesをfresh read-only test-code reviewerへ委任する。buttonとlink-as-navigationの分類、DaisyUI既定値、CTA順序、Ko-fi除外、実DOMとsourceの境界を確認し、`VERDICT: PASS`までT029を開始しない。

### Button production implementation and review

- [ ] T029 [US2][US3] T028 PASS後、T027の診断pathに含まれる通常button/controlと`src/app/location-detail/[id]/page.tsx`または一時的な`src/components/features/LocationDetailContent.tsx`のCTAだけをbounded writerへ渡し、16px相当の明示指定を追加する。移動操作をbuttonへ戻さず、「ここへ行く」はnative `a`のまま維持する。
- [ ] T030 [US2][US3] T029後、button contract、location detail focused Jest、該当control tests、strict TypeScript、対象Lint、`git diff --check`、path/SHAを実行する。
- [ ] T031 [US2][US3] T029のsettled production bytesをfresh read-only reviewerへ委任し、通常controlのcomputed-size前提、native anchor、CTA accessibility、DaisyUI class、Ko-fi非変更を確認して`VERDICT: PASS`を取得する。

---

## Phase 5: Heading, navigation, definition-list, image, and state regression reconciliation (US1/US2/US4 / FR-001〜FR-008, FR-012)

**Purpose**: 既存dirtyのslice 1/2を再読し、追加で必要な公開契約だけをREDとして表現する。現在の本番byteを過去のレビュー通知だけでPASS扱いにしない。

### Semantic regression RED and test-code review

- [ ] T032 [US1][US2][US4] `src/app/location-detail/[id]/__tests__/page.test.tsx`、`src/components/features/__tests__/LocationDetailContent.test.tsx`、`src/components/layouts/__tests__/SidebarLayout.test.tsx`、および`src/app/location-detail/[id]/loading.tsx`の現行契約を再読し、current hashを記録する。未検証契約があれば、ページを実際の`SidebarLayout`/`main` host内でrenderするテストとして追加する。検査対象は唯一の`h1`、`提供情報`の`h2`、`説明`見出し不在、成功・loading・not-found・data-load-error・invalid・duplicate各状態の上部戻り`a`一つ、native CTAのhref/order、`dt`→`dd`隣接、`img[alt=""]`かつroleなし、aspect ratio、通常cardなし、Ko-Fi card維持である。実行: `npm test -- --runInBand --runTestsByPath 'src/app/location-detail/[id]/__tests__/page.test.tsx' src/components/features/__tests__/LocationDetailContent.test.tsx src/components/layouts/__tests__/SidebarLayout.test.tsx --silent`。新規assertionは未実装gapに対する意味のあるREDでなければならない。
- [ ] T033 T032でsettledしたpage/loading/content/layout testsをfresh read-only test-code reviewerへ委任する。shared `main`/`PageHeader` boundary、native tagとnon-empty href、definition-list semantics、empty-alt/no-role、conditional omission、loadingを含むstate differentiation、Ko-fi除外、既存主要操作への過結合を確認し、`VERDICT: PASS`までT034を開始しない。T032でtest bytesが変わった場合は、T032のREDとT033を再実行する。

### Semantic production correction and review

- [ ] T034 [US1][US2][US4] T033 PASS後、T032で確認された不足契約に限り、`src/app/location-detail/[id]/page.tsx`、`src/app/location-detail/[id]/loading.tsx`、`src/components/features/LocationDetailContent.tsx`、必要な`src/components/layouts/SidebarLayout.tsx`だけをbounded writerへ渡す。`useRouter`/移動button除去、成功・loading・error各状態の上部リンク統一、heading/section構造、`dl`、empty-alt/no-role、aspect、CTA順、状態shellを最小変更で揃える。Ko-Fi sourceとresolver/data formatは変更しない。
- [ ] T035 [US1][US2][US4] T034後、T032のfocused aggregate、strict TypeScript、対象Lint、`git diff --check`、path/SHAを実行し、success・optional omission・invalid・duplicate・not-found・data-load-error・loadingの各契約を分類して記録する。
- [ ] T036 [US1][US2][US4] T034のsettled page/loading/content/layout production bytesをfresh read-only production/a11y reviewerへ委任する。source→rendered DOM/accessibility treeの三層、single main/h1、全状態のtop-only native link、`dt`/`dd`、empty-alt/no-role、focus、Ko-Fi保持、resolver fail-closed境界を確認し、`SUBAGENT_STATUS: COMPLETE`と`VERDICT: PASS`を取得する。

---

## Phase 6: Dynamic metadata and data-boundary contract (US4 / FR-013, SC-007)

**Purpose**: 有効な場所名を動的titleへ反映し、metadataと本文で異なるID/data解決を行わない。

### Metadata RED and test-code review

- [ ] T037 [US4] `src/app/location-detail/[id]/__tests__/page.test.tsx`へ、`千代田区役所`（ID `5e3b1528-8af6-436a-83af-24ca45b58e12`）のmetadata titleが厳密に`千代田区役所 - 場所詳細`となるケース、任意の有効名、invalid/unknown/duplicate/data-load-errorの厳密なfallback `場所詳細 | 風ぐるま乗換案内`、raw ID非反映、metadata/page data-boundaryの不要重複解決を追加する。実行: `npm test -- --runInBand --runTestsByPath 'src/app/location-detail/[id]/__tests__/page.test.tsx' --silent`。期待:現在のstatic metadataまたは未実装dynamic functionを理由とするRED。
- [ ] T038 T037のsettled metadata testsをfresh read-only test-code reviewerへ委任する。`metadata.title`を直接検証し、vacuous conditional、raw ID interpolation、fixtureの非空性、loader/resolver failure分類、fetch dedupe assertionの過仕様化がないことを確認し、`VERDICT: PASS`までT039を開始しない。T037で既存test bytesを変更した場合はREDを再実行する。

### Metadata production implementation and review

- [ ] T039 [US4] T038 PASS後、`src/app/location-detail/[id]/page.tsx`にdynamic metadata functionを実装する。page本文と同じvalidated location ID/data boundaryを再利用またはNext-supported cacheで共有し、成功時`${location.name} - 場所詳細`、`千代田区役所`の厳密値、invalid/unknown/duplicate/data-load-error時の厳密なfallback `場所詳細 | 風ぐるま乗換案内`を返す。raw IDをtitleへ入れない。
- [ ] T040 [US4] T039後、metadata/page focused Jest、必要なresolver tests、strict TypeScript、対象Lint、`git diff --check`、path/SHAを実行する。success title、fallback title、page behavior、不要な二重データ解決の結果を記録する。
- [ ] T041 [US4] T039のsettled `src/app/location-detail/[id]/page.tsx`とmetadata/page testsをfresh read-only production reviewerへ委任し、Next App Router metadata boundary、params、resolver reuse、fallback安全性、既存DOM契約を確認して`VERDICT: PASS`を取得する。

---

## Phase 7: Green-after-refactor integration (US5 / FR-014, FR-015)

**Purpose**: P1の見出し、navigation、structure、font、color、button、state、metadataがすべてGreenかつproduction-reviewedになった後だけ、詳細componentをpageへ統合する。

### Integration RED and test-code review

- [ ] T042 [US5] T009、T012、T015、T018、T023、T026、T031、T036、T041のproduction review PASS、focused GREEN、strict TypeScript、Lint、diff結果を親側で再照合する。未PASSのgateがあれば統合を開始せず、該当sliceへ戻る。
- [ ] T043 [US5] `src/app/location-detail/[id]/__tests__/page.test.tsx`へ、`LocationDetailContent`をruntime importせずページレベルの公開挙動だけで成功、optional omission、destination href/order、definition-list、image, state, metadata, Ko-fi hostを検証するintegration REDを追加または既存テストへ移行する。`src/components/features/__tests__/LocationDetailContent.test.tsx`の有意味なassertionは失わず、移行対象を明示する。実行: `npm test -- --runInBand --runTestsByPath 'src/app/location-detail/[id]/__tests__/page.test.tsx' src/components/features/__tests__/LocationDetailContent.test.tsx --silent`。
- [ ] T044 T043のsettled page integration testsをfresh read-only test-code reviewerへ委任する。page-level public boundary、host main、meaningful fixture、component testでしか証明できない契約の移行、component import absenceを確認し、`VERDICT: PASS`までT045を開始しない。T043でtest bytesが変わった場合はREDとレビューをやり直す。

### Integration production implementation and review

- [ ] T045 [US5] T044 PASS後、`src/app/location-detail/[id]/page.tsx`へ`LocationDetailContent.tsx`の必要なdetail markupとhelpersを統合する。`LocationDetailContent`がclient boundaryでないことを仮定せず、実runtime consumer searchで確認する。不要なcomponent export/importと専用testは、意味あるassertionをpage testへ移した後だけ削除する。`SidebarLayout`、`PageHeader`、`KoFiSupport`、resolver、destination formatは変更しない。
- [ ] T046 [US5] T045後、page integration aggregate、full location-detail tests、strict TypeScript、対象Lint、`git diff --check`、`search_files`によるruntime consumer 0件、path/SHAを確認する。削除対象の不在とpage-level behaviorを別々に記録する。
- [ ] T047 [US5] T045のsettled page、削除/移行したcomponent/test、direct consumersをfresh read-only production reviewerへ委任する。behavior preservation、unused client/component boundary、test coverage、shared layout/Ko-Fi非変更、scopeを確認し、`SUBAGENT_STATUS: COMPLETE`と`VERDICT: PASS`を取得する。

---

## Phase 8: Final cross-cutting verification and browser acceptance

**Purpose**: 全体の自動検証、実ブラウザ、CDN v2.1.1、最終scopeを、未実行やwarningと混同せず記録する。

- [ ] T048 `npm test -- --runInBand`を実行し、全suite/test数、失敗、timeout、collection failureを記録する。次に`npx tsc --noEmit --incremental false`、`npm run lint`、`git diff --check`、`uvx --from specify-cli specify check`を個別に実行する。Lintの既存warning/deprecationと新規errorを分離し、未実行を成功としない。
- [ ] T049 `NEXT_PUBLIC_LOCATIONS_DATA_VERSION=v2.1.1 npm run dev`でローカルNext.jsを起動し、Puppeteer/CDP等の実ブラウザで`/location-detail/5e3b1528-8af6-436a-83af-24ca45b58e12`をdesktop/narrow mobileで確認する。title、唯一のh1、`提供情報` h2、上部戻るlink、destination/external/license href、`dt`/`dd`、`img[alt=""]`/roleなし、4:3、computed font-size >=16px、light/darkのWCAG 2.2 AA contrast（通常文字>=4.5:1、大きな文字>=3:1、適用対象の非テキスト要素>=3:1）、keyboard focus、主要link/CTAの表示領域幅・高さ各44 CSS px以上、Ko-Fi cardを記録する。
- [ ] T050 browser interceptionまたは同等のcontrolled fixtureでduplicate-ID、invalid-ID、unknown-ID、transport/JSON failure、loadingを確認し、not-found/data-load-error/errorを混同せず、各stateでh1一つ・上部戻るlink一つ・空success detailsなしを記録する。loadingでは`loading.tsx`由来の見出し・日本語status・上部戻るlinkを確認する。v2.1.1の実データを重複fixtureと誤記しない。
- [ ] T051 `npm run build`を最終かつ別ゲートとして実行する。Prisma/GTFS side effect、環境不足、lint failure、build failureを個別に分類し、build未実行・timeoutを成功としない。
- [ ] T052 `git status --short --untracked-files=all`、`git diff --name-only`、全変更/新規fileのSHA-256、`git diff --check`、019 docsのrelative-link/placeholder/末尾空白検査を実行する。今回のscope外のruntime source、`src/components/features/KoFiSupport.tsx`、`.specify/feature.json`、既存dirty test、本番変更が混入していないかを親が再確認する。commit、push、PRは行わない。

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
- **Phase 8 Final**: T047 production review PASS後にT048〜T052。

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
