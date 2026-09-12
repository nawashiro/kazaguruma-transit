# Specification Quality Checklist: 場所詳細ページのアクセシビリティと情報構造の改善

**Purpose**: 場所詳細ページの意味構造、native navigation、16px全体契約、状態、metadata、既存操作維持を実装可能な仕様として確認する。
**Created**: 2026-08-16
**Feature**: [../spec.md](../spec.md)
**Plan**: [../plan.md](../plan.md)

## Content Quality

- [x] CHK001 利用者が場所詳細を読み取り、移動し、状態を理解する独立したUser Storyを定義している。
- [x] CHK002 詳細ページ固有の16px契約と、アプリ全体16px監査契約を区別せず同期している。
- [x] CHK003 既存の場所resolver、目的地query、共通main、Ko-fi支援欄を維持する境界を明記している。
- [x] CHK004 新規データ形式、永続化、認証の振る舞い・データフロー、レート制限、UIライブラリ全面移行を対象外としている。認証UIの通常文字監査・是正は対象としている。
- [x] CHK005 Clarificationの回答（アプリ全体も16px相当以上）を関連する要求・成功基準・scopeへ反映している。

## Requirement Completeness

- [x] CHK006 成功状態の一意な場所名`h1`、重複見出し削除、「提供情報」`h2`を要求している。
- [x] CHK007 地域と提供情報の`dt`/`dd`、任意項目欠落時のpair omissionを要求している。
- [x] CHK008 `img alt=""`、不要な`role="img"`削除、明示的な画像比率を要求している。
- [x] CHK009 上部の戻るリンク1つ、native destination anchor、既存destination query、外部link securityを要求している。
- [x] CHK010 loading、success、not-found、data-load-error、invalid/duplicate errorの表示差を定義している。
- [x] CHK011 有効な場所の動的titleと`千代田区役所 - 場所詳細`の厳密な例を定義している。
- [x] CHK012 detail-pageの16px、全体16px、`rt`厳密例外、unknown arbitraryのfail-closed監査を定義している。
- [x] CHK013 normal text color、low contrast/opacity、button既定font-sizeの監査境界を分離している。
- [x] CHK014 `LocationDetailContent`統合はbehavior Green後のP2 refactorであると明記している。

## Accessibility & UX

- [x] CHK015 共通layoutの単一`main`を維持し、routeがnested mainを作らないことを定義している。
- [x] CHK016 heading order、native anchor、keyboard focus、external link name、touch targetを要求している。
- [x] CHK017 decoration imageのempty altとexplicit role不在を、矛盾しないDOM契約として定義している。
- [x] CHK018 light/dark themeでのcomputed font-size、contrast、focus-visibleを実ブラウザ確認へ含めている。
- [x] CHK019 Ko-fiカードを通常提供情報のcard撤去から明示的に除外している。

## Existing Behavior & Scope

- [x] CHK020 `convertToLocation`と既存`destination` query形式を変更しないことを要求している。
- [x] CHK021 `loadKeyLocationsDataResult`と`resolveLocationDetail`のtransport/duplicate/not-found分類を再利用する計画になっている。
- [x] CHK022 CDN `v2.1.1`のID一意性とarea欠落を観測事実として記録し、duplicate-IDは回帰fixtureとしてresolverを弱めず検証する。
- [x] CHK023 認証の振る舞い・データフロー、レート制限、場所一覧、Ko-fi、データ形式、永続化の変更をscope外に置いている。認証UIの通常文字監査・是正と、Ko-fiファイルのwriter除外を明記している。
- [x] CHK024 dirty worktreeをリセットせず、commit/pushをこのfeatureの承認範囲外としている。

## Success Criteria & Testability

- [x] CHK025 page/content/font baseline command、実測結果、既存warningをplan/researchへ記録している。
- [x] CHK026 すべての新規test chapterにRED、fresh test review、GREEN、fresh production reviewの順序を指定している。
- [x] CHK027 focused Jest、TypeScript、Lint、diff check、full Jest、browser、buildを別々の検証ゲートとして定義している。
- [x] CHK028 test編集またはproduction編集後に旧review verdictを再利用しないことを要求している。
- [x] CHK029 外部実dataのduplicateをsuccess fixtureと混同せず、browser acceptanceで両方を記録する手順がある。
- [x] CHK030 plan成果物に未置換placeholderがなく、tasks.mdはplan承認後まで作成しない境界がある。

## Implementation Readiness

- [x] CHK031 すべての主要source/test pathがplan、contract、quickstartのいずれかで固定されている。
- [x] CHK032 global 16px remediationを認証UIを含む責務別sliceへ分割し、Ko-fi支援欄をwriter範囲から除外して、巨大な未レビュー編集を避けている。
- [x] CHK033 metadata/page data boundary、temporary component integration、Ko-fi preservationの設計判断を記録している。
- [x] CHK034 仕様・計画の成果物は準備済みで、実装完了やレビューPASSを先取りしていない。

## Notes

- このチェックリストの`[x]`は仕様・計画の品質確認を示し、本番実装やproduction reviewの完了を示さない。
- `tasks.md`はこの計画が受け入れられた後、各テスト章の直後にblocking test-code reviewを挿入する形で作成する。
