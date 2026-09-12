# Implementation Plan: UI KISS観点の整備

**Branch**: `013-ui-kiss-maintenance` | **Date**: 2026-07-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/013-ui-kiss-maintenance/spec.md`

## Summary

既存機能の挙動と、009のNostr同期・ルビ外部ライブラリ・PDFサーバー生成を保ったまま、UI周辺の重複、不要状態、暗黙的な共通UI APIを整理する。

今回の実装範囲は、ジオコーディング検索、ルート表示とPDFの意味モデル・時刻計算、BusStopのmoderation snapshot後の表示用投影、`Button` の薄いラッパー化、対象箇所の回帰テストに限定する。ホームページと場所一覧ページの大規模な責務分割は後続フェーズとする。

## Technical Context

**Language/Version**: TypeScript 5 strict、React 19、Next.js 15 App Router

**Primary Dependencies**: Tailwind CSS 4、DaisyUI 5、Jest、React Testing Library、既存のNostr gateway/service、Puppeteer、Google Maps Services

**Storage**: 新規永続化なし。既存のNostr relay、sessionStorage、SQLite/Prismaを変更せず利用する

**Testing**: Jest + React Testing Library。対象テスト、`npm run lint`、`npm test`、`npm run build` を実行する

**Target Platform**: Next.js Webアプリ（デスクトップ、タブレット、モバイル）とサーバー側PDF生成環境

**Project Type**: Web application

**Performance Goals**: 既存の009 read性能と部分取得開始時間を悪化させない。新しい共通変換は同期的な純粋処理として、表示に不要な追加relay readや追加API呼び出しを発生させない。009の代表readシナリオで変更前ベースラインのp95を記録し、変更後もAPI p95 200ms以下かつベースラインからの悪化を確認可能にする

**Constraints**: 009のrelay選択・completion・partial/unknown・承認結合・既知データ契約を変更しない。ルビ外部契約を変更しない。PDF APIの未使用入力項目は互換性のため保持し、廃止予定を明記する。新規DB変更なし

**Scale/Scope**: 対象は既存の主要UI・BusStop表示・経路表示・PDF出力の重複整理。`src/app/page.tsx` と `src/app/locations/page.tsx` の大規模分割、全画面の一括UI移行、Nostr read基盤の再設計は対象外

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Clear Naming**: PASS。新規の型・変換関数は `RouteDisplayModel`、`projectBusStopSnapshot`、`useGeocodingSearch` のように意図を表す名前とする。
- **Simple Logic**: PASS。共通処理を純粋な変換と小さなフックへ分離し、`Button` のクラス文字列解析と重複状態を除去する。
- **Structured Organization**: PASS。UI、ドメイン変換、通信境界、PDF APIを分離し、UIからrelay/API実装へ新たな直接依存を追加しない。
- **Type Safety**: PASS。共有型を `src/types` に置き、`any` を追加しない。PDF DTOは意味モデルから明示的に変換する。
- **Test-First Development**: PASS。対象の共通変換・UI状態・契約テストを先に追加または更新し、実装後に全体検証する。
- **Accessibility & UX**: PASS。ボタンのフォーカス表示、ARIA、キーボード操作、DaisyUI規約、日本語文言、最小フォントサイズを維持する。
- **Documentation & Comments**: PASS。共通UI境界、PDF互換項目、009保護対象を契約文書に記録する。
- **Nostr方針**: PASS。`specs/009-coracle-style-sync` の共通moderation snapshotとread契約を再利用し、read戦略を変更しない。

## Project Structure

### Documentation (this feature)

```text
specs/013-ui-kiss-maintenance/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── ui-component-boundary.md
│   └── pdf-route-input.md
└── checklists/requirements.md
```

### Source Code (repository root)

```text
src/
├── types/
│   └── route-display.ts                         # 画面/PDF共有の意味モデル
├── lib/
│   ├── location/
│   │   └── geocoding-search.ts                  # 検索入力・レスポンスの共通処理
│   ├── transit/
│   │   └── route-display-model.ts               # ルートの表示用変換・時刻計算
│   └── discussion/
│       └── bus-stop-projection.ts               # snapshot後の投稿/評価/代表メモ投影
├── components/
│   ├── ui/
│   │   ├── Button.tsx                           # 明示的な薄いButton API
│   │   └── __tests__/Button.test.tsx
│   ├── features/
│   │   ├── OriginSelector.tsx
│   │   ├── DestinationSelector.tsx
│   │   ├── IntegratedRouteDisplay.tsx
│   │   ├── RoutePdfExport.tsx
│   │   └── __tests__/
│   └── discussion/
│       ├── BusStopDiscussion.tsx
│       ├── BusStopMemo.tsx
│       └── __tests__/
└── app/api/pdf/generate/route.ts                # DTO境界と廃止予定項目の契約
```

**Structure Decision**: 既存のNext.js単一Webアプリ構造を維持する。新規コードは、共有意味モデルを `src/types`、副作用のないドメイン変換を `src/lib`、表示と操作を `src/components`、外部PDF入力契約を `src/app/api` に置く。大規模ページの分割用ディレクトリは今回追加しない。

## Phase 0: Research

1. 009仕様と実装の保護境界を確認し、BusStopのprojectionがread戦略を変更しないことを確認する。
2. 画面ルート表示、PDF UI、PDF API、PDF HTML生成の入力・出力を照合し、共有可能な意味モデルとPDF専用レイアウトを分離する。
3. 出発地・目的地の検索処理を比較し、共通化する失敗状態と出発地固有のGPS処理を分離する。
4. `Button` の既存利用箇所とテストを調査し、移行対象と直接DaisyUI記述を許容する境界を定義する。
5. ルビ外部ライブラリの処理は変更対象にせず、回帰確認だけを行う。

**Research Output**: [research.md](research.md)

## Phase 1: Design & Contracts

1. `RouteDisplayModel`、BusStop projection、ジオコーディング結果・状態のデータモデルを定義する。
2. 画面表示とPDFが共有するルートの意味契約、およびPDF APIの入力項目・廃止予定項目を定義する。
3. `Button` の明示的Props、ARIA、結合表示、アイコンのみ、送信中、フォーカス表示の契約を定義する。
4. 共通変換のユニットテストを先に追加し、既存の画面テストを共通契約に接続する。
5. 009のmoderation snapshot fixtureで、partial/timeout/unknown、重複イベント、承認遅延を検証する。
6. [quickstart.md](quickstart.md) に対象テストと全体検証コマンドを記録する。

**Design Outputs**: [data-model.md](data-model.md)、[contracts/](contracts/)、[quickstart.md](quickstart.md)

## Implementation Sequence

1. 共有型と純粋なBusStop projectionを追加し、T031〜T032のルート変換をUS1のT020〜T021に先行する共通前提として追加する。
2. ジオコーディング共通処理を追加し、Origin/Destination selectorを移行する。
3. `IntegratedRouteDisplay` と `RoutePdfExport` を共有ルート変換へ移行する。PDFのHTMLレイアウトは独立して維持する。
4. `RoutePdfExport` の `error`、`pdfGenerating`、`pdfLoading` の重複状態を整理し、PDF APIの互換項目を契約化する。
5. `BusStopDiscussion`、`BusStopMemo`、PDF用メモ取得を共通projectionへ移行する。read境界は `useBusStopModeration` と009実装を維持する。
6. `Button` を薄い明示APIへ整理し、今回の変更対象の利用箇所とテストを移行する。全画面の一括移行は行わない。
7. 必要なエラー表示・モーダルの重複は、変更対象の範囲でのみ整理する。汎用化が複雑性を増す場合は直接DaisyUI記述を許容する。
8. 対象テスト、lint、全テスト、buildを実行し、009・ルビ・PDFの回帰を確認する。

## Complexity Tracking

| 事項 | 必要な理由 | 単純な代替を採用しない理由 |
|---|---|---|
| 画面用モデルとPDF DTOの分離 | ブラウザ表示とサーバーPDFで実行環境・レイアウトが異なるため | PDF HTMLを画面React markupと共有すると環境依存とエスケープ責務が混ざるため |
| BusStop projection層 | 009のmoderation snapshotをread境界として保ち、複数の表示面で承認状態を一致させるため | 各UIで直接parseすると承認・評価の重複と画面間乖離が再発するため |
| PDF APIの廃止予定入力保持 | 既存呼び出しとの互換性を維持するため | 即時削除は未確認の外部・将来呼び出しを壊す可能性があるため |

## Post-Design Constitution Re-Check

- **Simple Logic**: PASS。設計はread境界を増やさず、重複する投影・検索・時刻計算とButtonの暗黙判定だけを共通化する。
- **Structured Organization**: PASS。`src/types`、`src/lib`、`src/components`、PDF APIの境界を分け、大規模ページの一括分割は今回行わない。
- **Type Safety**: PASS。共有意味モデルとPDF DTOを区別し、未使用互換項目も契約上の状態として明示する。
- **Test-First Development**: PASS。共通変換、UI状態、PDF契約、009保護fixtureを先に固定し、対象テストから全体検証へ進む。
- **Accessibility & UX**: PASS。Buttonのフォーカス表示・ARIA、入力エラー、タブ、モーダル、状態通知を契約とquickstartに含めた。
- **Nostr実装方針**: PASS。009のmoderation snapshotとread契約は変更せず、snapshot後の表示投影だけを整理する。
- **Complexity violations**: なし。PDFの別レイアウト、BusStop projection、互換入力保持は、仕様上必要な境界として理由を記録済み。
