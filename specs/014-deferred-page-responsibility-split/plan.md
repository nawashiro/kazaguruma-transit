# Implementation Plan: 後続ページ責務分離

**Branch**: `014-deferred-page-responsibility-split` | **Date**: 2026-07-14 | **Spec**: [spec.md](./spec.md)

**Input**: [Feature specification](./spec.md)

## Summary

013仕様で延期した大規模ページの責務分離を、経路検索ページ、場所一覧ページ、会話タブの順に段階導入する。各段階で、データ取得・状態遷移・利用者操作・表示を明示的な境界へ整理し、既存のURL、ディープリンク、ブラウザ履歴、表示、Nostr/PDF/認証契約を維持する。見た目は原則変更せず、アクセシビリティまたは明らかな表示不具合の修正だけを許容する。

## Technical Context

**Language/Version**: TypeScript 5 strict、React 19、Next.js 15 App Router

**Primary Dependencies**: Tailwind CSS 4、DaisyUI 5、既存のNostr gateway/service、Prisma/SQLite、Jest、React Testing Library

**Storage**: 新規永続化なし。既存のNostr relay、sessionStorage、SQLite/Prismaを変更せず利用する

**Testing**: Jest、React Testing Library、TypeScript noEmit、Next.js lint、production build、既存の手動ブラウザ確認

**Target Platform**: 既存のWebアプリ（モバイル、タブレット、デスクトップのレスポンシブ表示）

**Project Type**: Next.js App Router Web application

**Performance Goals**: `/api/transit` と `/api/geocode` の代表シナリオでAPI応答 p95 200ms以内を維持し、実装後のp95がベースラインを10%超上回らない

**Constraints**: 既存のURL・ディープリンク・履歴・表示・エラー・再試行を維持する。Nostrのpartial/unknown/completion/read境界、PDF生成、認証、ルビ外部契約を変更しない。ルビを除くユーザー向け文字サイズは14px未満にしない

**Scale/Scope**: 3段階の既存画面整理。対象は経路検索、場所一覧、会話メタデータ取得境界。全画面の共通UI一括移行、新規永続化、RubyWrapper置換は対象外

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Clear Naming**: PASS。責務境界を「取得」「状態」「操作」「表示」として命名し、既存ドメイン語彙を維持する。
- **Simple Logic**: PASS。大規模ページを一度に再設計せず、1領域ずつ段階導入する。新しい抽象化は複数の変更理由を実際に分離する場合に限定する。
- **Structured Organization**: PASS。ページ固有のUI、`src/lib`の副作用のない変換、既存サービスの取得境界を分ける。UIからDBへ直接アクセスしない。
- **Type Safety**: PASS。責務間の入力・出力を明示型で表し、`any`を追加しない。API応答と表示状態を混同しない。
- **Test-First Development**: PASS。各段階で既存テストを先に拡張し、古い非同期結果、空・失敗状態、アクセシビリティを先に固定する。
- **Accessibility & UX**: PASS。既存のARIA、フォーカス、キーボード操作、44px以上の操作領域、日本語エラー、14px下限を回帰テストと手動確認に含める。
- **Documentation & Comments**: PASS。直接DaisyUI記述を残す境界と、契約を変更しない理由を設計文書に記録する。
- **Nostr方針**: PASS。009仕様のrelay選択、既知データ、partial/unknown、completion、重複排除を取得アダプターの外部契約として保持する。

## Project Structure

### Documentation (this feature)

```text
specs/014-deferred-page-responsibility-split/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── responsibility-boundaries.md
└── tasks.md                 # /speckit-tasksで作成
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── page.tsx                         # 経路検索ページの公開入口
│   ├── __tests__/page.test.tsx          # 経路検索ページ回帰
│   └── locations/
│       ├── page.tsx                     # 場所一覧ページの公開入口
│       └── __tests__/page.test.tsx      # 場所一覧ページ回帰
├── components/
│   ├── features/                        # 入力・経路・場所固有の表示
│   ├── discussion/
│   │   ├── DiscussionTabLayout.tsx      # タブ表示とメタデータ境界
│   │   ├── DiscussionMetaReadState.tsx  # 会話取得結果の表示境界
│   │   └── __tests__/DiscussionTabLayout.test.tsx
│   └── ui/                              # 共通UIとアクセシビリティ契約
├── lib/
│   ├── location/                        # 場所状態・ジオコーディング処理
│   │   └── location-list-state.ts
│   ├── discussion/                      # 009 read/cache/状態境界
│   └── transit/                         # 経路状態・意味モデル・変換
│       └── route-search-state.ts
└── types/                               # 責務間で共有する明示型
```

**Structure Decision**: 既存の単一Next.jsアプリ構造を維持する。公開ページは薄い調整役としてURL初期化とイベント接続、表示コンポーネントの構成だけを担い、外部取得・API応答変換・ドメイン計算・relay/cache操作を直接行わない。共有可能な純粋変換・状態型は既存の`src/lib`と`src/types`へ置く。既存の取得サービスをページへ再実装せず、会話取得は009 read境界を維持する。新しい大規模な抽象レイヤーや全画面移行用ディレクトリは追加しない。

## Phase 0: Research

`research.md`で、ページ責務分離の粒度、非同期競合の扱い、Next.js App RouterでのURL互換、009 Nostr read境界、アクセシビリティ回帰の検証方針を確定する。

## Phase 1: Design & Contracts

`data-model.md`に、3ページの状態モデルと責務間の入力・出力を定義する。`contracts/responsibility-boundaries.md`に、経路検索、場所一覧、会話メタデータ取得、共通UIの外部から観測可能な契約を定義する。`quickstart.md`に段階導入順のテスト・lint・型検査・build・手動確認手順を記録する。

## Phase 2: Implementation Planning

`/speckit-tasks`で、次の順序を満たすTDDタスクへ分解する。

1. 経路検索ページのテストと境界整理を実装し、全回帰を確認する。
2. 場所一覧ページのテストと境界整理を実装し、全回帰を確認する。
3. 会話タブの表示とメタデータ取得を分離し、009保護テストを確認する。
4. 3領域の共通UI境界、URL互換、アクセシビリティ、性能を横断検証する。

## Post-Design Constitution Re-Check

- **Simple Logic**: PASS。各段階で責務を増やすのではなく、既存ページ内の混在を分離する。共通化は再利用される明確な契約がある場合だけに限定する。
- **Structured Organization**: PASS。ページ入口、表示コンポーネント、純粋な状態・変換、既存外部サービスの境界を混在させない。
- **Test-First Development**: PASS。各段階の実装前に、現在の成功・失敗・競合・アクセシビリティの振る舞いをテストへ固定する。
- **Accessibility & UX**: PASS。UI変更を原則行わず、既存のキーボード操作、ARIA、フォーカス、touch target、日本語案内を契約として再確認する。
- **Nostr実装方針**: PASS。取得の分離はread契約の再設計ではなく、既存結果を表示へ渡す境界の整理に限定する。
- **Performance**: PASS。追加取得を作らず、`/api/transit` と `/api/geocode` のp95を同一環境で測定し、200ms以内かつベースライン比10%超の悪化なしを検証する。

## Complexity Tracking

No constitution violations requiring justification.
