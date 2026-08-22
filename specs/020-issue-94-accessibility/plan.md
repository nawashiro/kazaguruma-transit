# Issue #94: 主要画面のアクセシビリティ回帰修正 Implementation Plan

> **For Hermes:** `AGENTS.md` と `.specify/memory/constitution.md` に従い、テストRED→fresh test-code review→本番実装→GREEN→fresh production-code reviewの順で実行する。レビューはサブエージェントへ委任し、親エージェントが書込境界・SHA・受入条件・検証結果を管理する。

**Goal:** ホームのキーボードフォーカスを見た目のないdrawer内部checkboxから外し、経路検索条件の変更中に前回のエラーalertが残らないようにする。

**Architecture:** drawerの開閉方式は維持し、表示上のメニューボタンを操作入口として内部checkboxだけをTab順から除外する。経路検索結果は、表示中の検索条件と結果stateの対象条件を紐付け、古い結果を表示せずloading stateへ切り替える。API、データ形式、既存のエラー・成功表示は変更しない。

**Tech Stack:** TypeScript 5 strict、React 19、Next.js 15 App Router、Tailwind CSS 4、DaisyUI 5、Jest、React Testing Library。

---

**Branch**: `fix/issue-94-accessibility` | **Date**: 2026-08-22 | **Spec**: [spec.md](./spec.md)

**Input**: Issue #94 と [research.md](./research.md)

## Summary

Issue #94 の2つの疑いを、対象パスを限定して修正する。

1. `SidebarLayout`のdrawer内部checkboxへ `tabIndex={-1}` を設定し、モバイルのTab順から0×0・透明な制御要素を除外する。
2. `RouteSearchResults`の結果stateへ検索条件を持たせ、表示中の条件に対応しない旧error/success stateを描画せず、loading statusを表示する。

## Technical Context

**Language/Version**: TypeScript 5 strict、Node.js 22.x、React 19、Next.js 15 App Router

**Primary Dependencies**: React Testing Library、Jest、`next/navigation`、DaisyUI 5、既存のTransit API/query parser

**Storage**: N/A。新規永続化なし。既存のNostr、SQLite/Prisma、sessionStorage、localStorage、GTFSデータを変更しない。

**Testing**: Jest + React Testing Library、`npx tsc --noEmit --incremental false`、`npm run lint`、`npm run build`、`git diff --check`。必要に応じてPuppeteerでTab順とDOMのalert/statusを確認する。

**Target Platform**: Next.jsのモダンブラウザWebアプリ。特にモバイル幅のdrawerと、クライアント遷移による`/routes`の再検索を対象とする。

**Project Type**: Web application

**Performance Goals**:

- 検索条件変更時に追加fetchを発生させず、既存の1検索1fetchを維持する。
- 古い結果の表示抑制はrender時のstate判定だけで行い、API・relay・DBへの追加処理を導入しない。

**Constraints**:

- `SidebarLayout`のdrawer checked state、メニューボタン、DaisyUI class、共通`main`を維持する。
- `/routes`のAPI URL、rate-limit遷移、invalid/error/successの文言と復帰リンクを維持する。
- UI変更は2つの原因に必要な最小範囲に限定する。共通alert抽象化や他画面の一括修正は行わない。
- 新規テストを本番コードより先に作成し、期待どおりの理由でREDになることを確認する。

**Scale/Scope**:

- Production: `src/components/layouts/SidebarLayout.tsx`、`src/components/features/RouteSearchResults.tsx`
- Tests: `src/components/layouts/__tests__/SidebarLayout.test.tsx`、`src/app/routes/__tests__/page.test.tsx`
- Docs: `specs/020-issue-94-accessibility/`のみ

## Constitution Check

*GATE: Phase 0 investigation and Phase 1 design both pass.*

| Gate | Result | Evidence |
|---|---|---|
| AGENTS.mdを先に読む | PASS | repository rootの`AGENTS.md`を読み、TDD、strict型、Lint/test/build、UI境界を確認した。 |
| Clear Naming | PASS | `resultState.searchParams`と`tabIndex`という既存概念に沿い、検索条件に対応するstateを明示する。 |
| Simple Logic | PASS | drawerの開閉方式を変えず、旧state判定と1つの属性追加に限定する。 |
| Structured Organization | PASS | layoutの修正はlayout、検索結果の修正はfeature、契約は既存の隣接testへ置く。 |
| Type Safety | PASS | `ResultState`のdiscriminated unionへ対象検索条件を明示し、`any`や型抑制を追加しない。 |
| Test-First Development | PASS | 2つの回帰テストを先に追加し、RED→レビュー→productionの順にする。 |
| Accessibility & UX | PASS | 見えないTab stopを除外し、検索中は`role="status"`、エラー時のみ`role="alert"`を表示する。 |
| Documentation & Comments | PASS | issue、根拠、対象外、検証方法を`spec.md`/`research.md`/`tasks.md`に記録する。 |
| Persistence/API boundary | PASS | DB、Nostr、GTFS、検索API契約、URL形式を変更しない。 |
| Review gates | PASS | `tasks.md`にtest writer/reviewer、本番 writer/reviewerを直列で明記する。 |

**Constitution violations:** なし。`Complexity Tracking`は不要。

## Project Structure

```text
specs/020-issue-94-accessibility/
├── spec.md
├── research.md
├── plan.md
└── tasks.md

src/components/layouts/
├── SidebarLayout.tsx
└── __tests__/SidebarLayout.test.tsx

src/components/features/
└── RouteSearchResults.tsx

src/app/routes/__tests__/
└── page.test.tsx
```

## Design Details

### US1: drawer内部checkboxのTab除外

- `SidebarLayout.tsx`の`id="drawer"` checkboxへ`tabIndex={-1}`を追加する。
- `aria-label="ナビゲーションメニュー"`、controlled `checked`、`onChange`は維持する。
- 後続の`button.drawer-button`はそのままTabで到達でき、`aria-expanded`と`aria-controls`も維持する。
- `SidebarLayout.test.tsx`でcheckboxの`tabIndex`が`-1`、メニューボタンがbuttonかつdrawer制御属性を持つことを検証する。

### US2: 検索条件に対応しない結果の描画抑制

- `ResultState`の全variantに`searchParams: string`を追加する。
- 初期stateは受け取った`searchParams`を対象にしたloadingとする。
- fetch開始時は`{ status: "loading", searchParams }`を保存する。
- success/errorにも、そのfetchを開始した`searchParams`を保存する。
- `parsed.isValid`を先に判定する既存順序を維持する。
- validな検索条件で`resultState.searchParams !== searchParams`の場合はloadingを描画する。これにより、effectがstateを更新する前の1renderでも旧alertを出さない。
- loadingのDOMは既存の`role="status"`を維持し、invalid/API error/429は既存の`SearchError`（`role="alert"`）を維持する。
- `RoutesPage` testで、APIエラー表示後に別queryへrerenderし、未解決fetch中はalertがなくstatusだけがあることを検証する。

## Implementation Sequence and Blocking Gates

1. **Baseline and write boundary**: `dev`/`origin/dev`のSHA、作業branch、status、対象ファイルを親が再確認する。
2. **Test RED**: 既存の2 test pathへUS1/US2の回帰契約を追加する。production sourceは変更しない。focused Jestでcollection/setup errorではなく、未実装契約によるREDを確認する。
3. **Fresh test-code review**: test bytesを固定し、fresh read-only reviewerへ委任する。PASSでない場合はテストを修正し、REDとレビューをやり直す。
4. **Production implementation**: PASS後、production writerは`SidebarLayout.tsx`と`RouteSearchResults.tsx`だけを変更する。テストや仕様書、他画面は変更しない。
5. **Focused GREEN and static gates**: 対象tests、strict TypeScript、対象Lint、`git diff --check`を実行する。変更後のbytesはレビュー前に固定する。
6. **Fresh production-code review**: production bytesとfocused GREEN結果をfresh read-only reviewerへ委任する。findingがあれば新しいREDを追加してから修正し、レビューを失効させてやり直す。
7. **Final verification**: full Jest、strict TypeScript、Lint、Build、`git diff --check`、Spec Kit prerequisite/checkを実行し、既存warning・環境依存warning・今回のfailureを分離して記録する。最後にstatus、diff、SHA、staged pathを確認する。

## Acceptance-to-Evidence Matrix

| Acceptance | Evidence |
|---|---|
| drawer内部checkboxがTab順外 | SidebarLayout回帰test、DOMの`tabIndex === -1`、必要ならPuppeteerのfocus順 |
| 検索中にalert不在 | RoutesPage rerender test、`queryByRole("alert")`不在、`getByRole("status")`存在 |
| invalid/API error/429のalert維持 | 既存RoutesPage tests（invalid、500、429） |
| API/URL/検索結果の非退行 | 既存RoutesPage成功test、fetch引数、rate-limit push assertion |
| 品質ゲート | full Jest、strict tsc、lint、build、diff check、status実測 |

## Risks and Rollback

- `tabIndex={-1}`がdrawer開閉に影響するリスク: label/button操作はcheckboxのchecked変更を使うため、メニューボタンのDOM契約をテストし、必要ならブラウザで開閉を確認する。
- result stateに検索条件を追加することで、state初期化の型漏れが出るリスク: union全variantの生成箇所を検索し、strict TypeScriptとfocused testsで確認する。
- 変更を戻す場合は、対象2 production fileと追加testの差分だけをrevertできる。DB/API/外部状態のrollbackは不要。
