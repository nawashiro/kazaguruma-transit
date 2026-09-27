# Implementation Plan: UI 最小フォントサイズ準拠

**Branch**: `010-ui-font-compliance` | **Date**: 2026-07-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/010-ui-font-compliance/spec.md`

## Summary

ルビの補助テキスト以外の全ユーザー向けUIテキストを、算出 `font-size` 14px 以上にそろえる。既存の
小サイズ指定を画面・状態・表示幅ごとに棚卸しし、14px 未満になる指定を置換する。
ルビの `rt` は唯一の例外として維持する。再発を防ぐため、14px 未満のUI用サイズ指定を
検出する自動テストを先に追加する。静的監査だけでは継承・メディアクエリ・動的クラスの算出値を保証できないため、画面状態マトリクスに基づくブラウザ実測も広い・狭い画面幅で行う。

## Technical Context

**Language/Version**: TypeScript 5.x（strict）

**Primary Dependencies**: Next.js 15、React 19、Tailwind CSS 4、DaisyUI 5

**Storage**: N/A（UI表示のみで永続データの変更なし）

**Testing**: Jest、React Testing Library、静的なサイズ指定監査テスト、ブラウザでの算出 `font-size` 確認、画面状態マトリクスに基づく手動表示確認

**Target Platform**: 対応ブラウザ上のレスポンシブWeb UI

**Project Type**: Next.js App Router のWebアプリケーション

**Performance Goals**: 既存の画面表示と操作応答を維持し、追加のネットワーク要求を発生させない

**Constraints**: ルビ補助テキスト以外の算出 `font-size` は 14px 以上。小画面でも縮小により下限を破らない。
既存のルビ表示・アクセシビリティ・レスポンシブ挙動を維持する。

**Scale/Scope**: `src/app`、`src/components`、共通スタイルの利用者向けUI全体。ページ、
ナビゲーション、フォーム、ダイアログ、通知、空・読み込み・エラー状態を含む。PDF出力、
画像内の文字、第三者コンテンツは仕様の対象外。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **結果: PASS（Phase 0）**。`AGENTS.md` の型安全、TDD、アクセシビリティ、
  レスポンシブ、検証要件に従う。実装前にサイズ違反を検出するテストを作成する。
- **アクセシビリティ**: 憲章の「ルビの補助テキストを除くユーザー向けテキストは 14px 以上」を
  直接満たす。`rt` だけを例外にし、通常本文には適用しない。
- **UI境界**: ユーザーが操作・閲覧するアプリケーションUIを対象とする。PDFは画面UIではないため
  対象外だが、実装時にブラウザUIへ小サイズ指定を流用しないことを確認する。
- **検証**: lint、テスト、ビルド、および広い・狭い表示幅での手動確認を完了条件とする。
- **結果: PASS（Phase 1）**。データモデルや外部APIを追加せず、既存のUI層だけで完結する。

## Project Structure

### Documentation (this feature)

```text
specs/010-ui-font-compliance/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── screen-state-matrix.md # 対象ルート・状態・表示幅の検証台帳
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── globals.css                       # 全体の文字サイズとルビ例外
│   ├── */page.tsx                        # ページと状態表示
│   └── __tests__/                        # ページの表示テスト
├── components/
│   ├── discussion/                       # 議論画面の状態表示・補助情報
│   ├── features/                         # 経路・場所機能のUI
│   ├── layouts/                          # ナビゲーションとフッター
│   └── ui/                               # 再利用UI
└── lib/                                  # 既存のUI支援ロジック
```

**Structure Decision**: 既存の単一Next.jsアプリ構造を維持する。小サイズ指定の修正は
所有するページまたはコンポーネントに置き、全体ルールとルビ例外は `src/app/globals.css` に置く。
テストは既存の `__tests__` 配置規則に従い、対象コードの近傍に追加する。画面の網羅性は
`screen-state-matrix.md` を単一の検証台帳として管理し、各行に算出値確認の結果を記録する。

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| なし | — | — |
