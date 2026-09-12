# Implementation Plan: 会話編集画面UX改善

**Branch**: `011-discussion-edit-ux` | **Date**: 2026-07-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/011-discussion-edit-ux/spec.md`

## Summary

会話詳細・監査ログ・編集を「会話｜監査ログ｜編集」の共通タブに統合し、編集画面のモバイル横溢れ、固定ルビ切替コントロールの重なり、未ログイン時の導線不足、権限メッセージと戻る導線の重複、削除操作の危険性、会話データ取得状態の誤表示を改善する。

実装は既存の `DiscussionTabLayout`、`DiscussionEditPage`、`PermissionGuards`、`LoginModal`、グローバルなルビ切替スタイルを中心に行う。会話データ、Nostrイベント、認可ルールは変更せず、画面構造・状態表示・レスポンシブな操作配置を改善する。

## Technical Context

**Language/Version**: TypeScript 5 strict、React 19、Next.js 15 App Router

**Primary Dependencies**: Tailwind CSS 4、DaisyUI 5、既存の認証コンテキスト、Nostrサービス、React Testing Library、Jest

**Storage**: N/A（本機能では新規永続化なし。既存の会話データ取得とブラウザ上の一時状態を利用）

**Testing**: Jest + React Testing Library、既存のNext.js lint、手動レスポンシブ確認

**Target Platform**: デスクトップおよび幅320px以上のモバイルブラウザ

**Project Type**: Next.js Webアプリケーション

**Performance Goals**: 既存の会話取得体験を悪化させず、状態表示を不要に遅延させない。既存のAPI応答p95 200ms以内の方針を維持する。

**Constraints**: 横方向オーバーフロー0件、主要操作のタッチ領域44px以上、ルビを除くユーザー向け文字14px以上、既存の認証・認可・Nostrイベント仕様を維持する。

**Scale/Scope**: 会話詳細配下の3ページ（会話、監査ログ、編集）と共通タブ、編集ページのフォーム・操作群・状態表示。新規データモデルや公開APIは追加しない。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Clear Naming / Simple Logic**: PASS。タブ状態、権限状態、取得状態を既存のドメイン語彙で分離し、深い条件分岐を増やさない。
- **Structured Organization**: PASS。UI変更は既存のコンポーネント層、取得・認証処理は既存サービス層に留める。
- **Type Safety**: PASS。タブ定義と取得状態は既存の型を拡張して表現し、`any`を追加しない。
- **Test-First Development**: PASS。タブ3件化、権限別ログイン導線、削除セクション、取得状態、モバイル溢れを先にテストシナリオ化する。
- **Accessibility & UX**: PASS。WCAG 2.2 AAを意識し、44pxタッチ領域、キーボードフォーカス、単一mainランドマーク、見出し階層、14px最小文字サイズを検証する。
- **Nostr実装方針**: PASS。Nostrリレーを正本とする既存取得経路を変更せず、画面状態のみを改善する。
- **セキュリティ・認可**: PASS。編集者、未ログイン、非作成者、モデレーターの既存判定を維持し、UI上の表示変更で権限を拡大しない。

## Project Structure

### Documentation (this feature)

```text
specs/011-discussion-edit-ux/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── ui-state-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── app/discussions/[naddr]/
│   ├── page.tsx
│   ├── audit/page.tsx
│   ├── edit/page.tsx
│   └── __tests__/
├── components/discussion/
│   ├── DiscussionTabLayout.tsx
│   ├── PermissionGuards.tsx
│   ├── LoginModal.tsx
│   └── __tests__/
├── components/ui/RubyWrapper.tsx
└── app/globals.css
```

**Structure Decision**: 既存のNext.js App Router構成を維持し、共通タブは `DiscussionTabLayout`、編集画面固有の操作整理は `edit/page.tsx`、共通の未ログイン説明は `PermissionGuards` または同責務の小さなUI部品に置く。データ取得サービスやPrismaスキーマは変更しない。

## Complexity Tracking

違反なし。新規の複雑性追跡項目はない。

## Phase 0: Research

既存実装を確認した結果、技術選択の未解決事項はない。3タブは `DiscussionTabLayout`、ログイン導線は既存 `LoginModal`、ルビ切替は既存固定コントロールの配置調整、取得状態は既存の `isLoading` と `completionReason` を利用する。

## Phase 1: Design

- [research.md](./research.md): 採用判断と代替案。
- [data-model.md](./data-model.md): 画面状態、権限状態、操作グループ。
- [contracts/ui-state-contract.md](./contracts/ui-state-contract.md): タブ、権限、取得状態、レスポンシブ表示のUI契約。
- [quickstart.md](./quickstart.md): Jest、lint、ビルド、ブラウザ幅別の検証手順。

## Constitution Check: Post-Design

- UI、ナビゲーション、フォーム、状態メッセージのアクセシビリティ確認を設計資料と検証手順に含めた。
- Nostrイベントの生成・取得、認可判定、永続化は設計対象外とし、既存仕様を維持する。
- 既存のUIコンポーネント層に限定し、単一責務・型安全・テスト先行の方針に適合する。

**Gate status**: PASS
