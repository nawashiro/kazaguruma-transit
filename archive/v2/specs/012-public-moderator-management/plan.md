# Implementation Plan: 公開モデレーター管理

**Branch**: `012-public-moderator-management` | **Date**: 2026-07-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/012-public-moderator-management/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

会話のモデレーター情報を、全利用者が閲覧できる公開ページへ分離する。公開画面は「モデレーターをしているユーザー」と「申請中のユーザー」の二一覧に限定し、ニーモニックと完全なユーザーIDを同一カードで示す。会話作成者だけは、申請許可・既存モデレーター削除をチェックボックスで選択し、直接追加と合わせて一つの「変更を確定」で現在のモデレーター構成を更新する。

申請中かどうかは、現在のkind 34550会話イベントの発行時刻以後のモデレーター申請イベントかつ、現在のモデレーターではないことから純粋に導出する。変更確定時のkind 34550には、現在の会話と選択した申請より必ず新しい発行時刻を付与し、削除済みの古い申請が同秒境界で復活しないようにする。基本情報の編集・掲載申請・会話削除は、会話作成者だけに表示する別の基本情報管理画面に残す。

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript 5.x（strict）

**Primary Dependencies**: Next.js 15 App Router、React 19、Tailwind CSS 4、DaisyUI 5、@nostr-dev-kit/ndk、nosskey-sdk

**Storage**: Nostrリレーが正本。ブラウザの既知データキャッシュは既存方針の範囲でのみ利用。新規永続ストレージなし。

**Testing**: Jest、React Testing Library、Puppeteerによるローカル画面確認

**Target Platform**: デスクトップおよびモバイルのモダンWebブラウザ（幅320px以上）

**Project Type**: Next.js Webアプリケーション

**Performance Goals**: 既存のリレー読取戦略・完了状態表示を維持し、対象画面を幅320px、390px、1440pxで横方向オーバーフローなく表示する。

**Constraints**: Nostrリレーを正本とする。kind 34550の発行時刻で申請状態を導出し、変更確定イベントの時刻は現在状態と選択申請より単調増加させる。会話作成者のみが基本情報とモデレーター構成を変更できる。ルビを除く文字サイズは14px以上、操作対象は実用上44px以上にする。

**Scale/Scope**: 会話詳細のタブナビゲーション、会話作成者専用の基本情報管理画面、公開モデレーター画面、モデレーター申請・一括変更ロジック、および対応テスト。グローバル管理者・却下状態・過去の取消履歴一覧は対象外。

## Constitution Check

*GATE: Phase 0開始前に合格。Phase 1設計後に再確認する。*

- **日本語と命名**: 合格。仕様・設計成果物は日本語で作成し、「会話作成者」を唯一の権限呼称にする。
- **責務分離と型安全性**: 合格。申請の時刻判定と一括差分の計算をUIから分離した純粋なドメイン関数に置き、UIは表示・選択・確定に限定する。共有型は `src/types/` または既存のNostrゲートウェイ型へ置く。
- **テストファースト**: 合格。時刻境界、重複申請、選択後未確定、単一イベントへの一括反映、権限別表示を先にテストする。
- **アクセシビリティとUX**: 合格。公開/非公開を権限で分け、チェックボックスには明確なラベル、選択件数と確定結果にはライブリージョン、タブには既存のキーボード操作を維持する。幅320px以上で確認する。
- **Nostr方針**: 合格。リレーを正本とし、申請の表示状態を現在のkind 34550と申請イベントから再導出する。新規DB・ローカル永続状態を導入しない。

**Phase 1再確認**: 合格。設計は既存の読み取り戦略・署名・公開経路を再利用し、UIから直接DBへアクセスしない。追加の憲章例外はない。

## Project Structure

### Documentation (this feature)

```text
specs/012-public-moderator-management/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
src/
├── app/discussions/[naddr]/
│   ├── page.tsx                         # 公開会話ページ
│   ├── layout.tsx                       # タブ共通レイアウト
│   ├── edit/page.tsx                    # 会話作成者専用の基本情報管理
│   ├── moderators/page.tsx              # 新規: 公開モデレーター画面
│   └── {edit,moderators}/__tests__/     # 画面・状態のテスト
├── components/discussion/
│   ├── DiscussionTabLayout.tsx          # 権限別タブ構成
│   ├── ModeratorManagementSection.tsx   # 新規: 公開一覧と作成者用選択UI
│   └── __tests__/
├── lib/discussion/
│   ├── moderator-application-state.ts   # 新規: 申請の導出と一括変更差分
│   └── __tests__/
├── lib/nostr/
│   └── discussion-ndk-gateway.ts        # kind 34550一括更新ドラフト
└── types/
    └── discussion.ts                    # 共有モデレーター状態型
```

**Structure Decision**: App Routerの会話ルートに公開モデレーター画面を追加し、既存`edit`ルートは基本情報管理に限定する。状態導出は`src/lib/discussion`、Nostrイベント草案は既存ゲートウェイ、共有型は`src/types`に置く。画面固有の再利用可能な表示・選択UIは`src/components/discussion`に置く。

## Complexity Tracking

憲章違反および例外はない。
