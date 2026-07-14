# Specification Quality Checklist: アクセシビリティ違反の修正

**Purpose**: アクセシビリティ違反の修正仕様が、計画工程へ進める品質を満たすことを確認する
**Created**: 2026-07-14
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## WCAG 2.2 AA Document Review

憲章のリンク先本文を読み、対象性と現状を次のように判定した。対象外の達成基準も、対象画面に時間依存メディア、音声、動画、ドラッグ操作、モーション起動、文字キーショートカット、法的・財務データの送信がないことを確認したうえで対象外とした。

- [x] 1.1.1 非テキストコンテンツ (`docs/accessibility/Understanding/1-1/1-1-1.md`) — 手書き SVG と装飾・意味伝達アイコンを監査対象にした。
- [x] 1.3.1 情報及び関係性 (`docs/accessibility/Understanding/1-3/1-3-1.md`) — 入力ラベル、fieldset、タブとパネルの関係を監査対象にした。
- [x] 1.4.1 色の使用 (`docs/accessibility/Understanding/1-4/1-4-1.md`) — 色だけで状態・エラーを伝えない要件を追加した。
- [x] 1.4.3 コントラスト（最低） (`docs/accessibility/Understanding/1-4/1-4-3.md`) — `text-gray-400` 等の候補を検査対象にした。
- [x] 1.4.4 テキストのサイズ変更 (`docs/accessibility/Understanding/1-4/1-4-4.md`) — 200% 拡大時の受け入れ条件を追加した。
- [x] 1.4.10 リフロー (`docs/accessibility/Understanding/1-4/1-4-10.md`) — 狭い画面幅での情報・操作欠落を検査対象にした。
- [x] 1.4.11 非テキストのコントラスト (`docs/accessibility/Understanding/1-4/1-4-11.md`) — アイコン、境界線、フォーカス表示を検査対象にした。
- [x] 2.1.1 キーボード、2.1.2 キーボードトラップなし (`docs/accessibility/Understanding/2-1/2-1-1.md`, `2-1-2.md`) — サイドバー開閉、モーダル、タブ、フォームを検査対象にした。
- [x] 2.4.1、2.4.2、2.4.3、2.4.4、2.4.6、2.4.7 (`docs/accessibility/Understanding/2-4/`) — スキップリンク、ページタイトル、見出し、リンク・タブ名、フォーカス順序と可視性を検査対象にした。
- [x] 2.5.2、2.5.3、2.5.8 (`docs/accessibility/Understanding/2-5/`) — ポインターのキャンセル、可視ラベルと名前の一致、44px 操作領域を検査対象にした。
- [x] 3.1.1、3.2.3、3.2.4 (`docs/accessibility/Understanding/3-1/3-1-1.md`, `3-2-3.md`, `3-2-4.md`) — `lang`、共通ナビゲーション、同一目的の識別を確認対象にした。
- [x] 3.3.1、3.3.2、3.3.3 (`docs/accessibility/Understanding/3-3/`) — 入力ラベル、エラーの特定、修正提案を検査対象にした。
- [x] 4.1.2、4.1.3 (`docs/accessibility/Understanding/4-1/4-1-2.md`, `4-1-3.md`) — `area-selected` 誤記、タブ状態、名前・役割・値、動的ステータスを検査対象にした。

## Implementation Audit Findings (Open by Design)

以下は仕様品質の不合格項目ではなく、次の計画・実装工程で解消する現状違反である。

- [ ] 手書きインライン SVG を共通UIと対象画面から除去し、装飾・意味伝達の扱いを統一する。
- [ ] ログインモーダルの `area-selected` 誤記を修正し、タブ状態をプログラムから判定可能にする。
- [ ] 出発地選択の fieldset と凡例の関連付けを適正化する。
- [ ] 場所検索の住所入力に可視ラベルを関連付ける。
- [ ] サイドバーのメニュー開閉をキーボードで確実に操作できるようにする。
- [ ] タブ・tabpanel の役割、選択状態、関連付け、フォーカス管理を全箇所で統一する。
- [ ] 44px 未満のボタン・操作領域を修正し、対象ユーザーを識別できる名前を付ける。
- [ ] 通常テキスト、アイコン、境界線、フォーカス表示のコントラストをテーマ別に測定し、基準未達を修正する。
- [ ] 200% 拡大と狭い画面幅でのリフローを確認する。

## Validation Notes

- 初回レビューで、対象画面、既存の操作目的、受け入れシナリオ、境界条件を確認した。
- 実装上の違反として、設定画面・会話作成画面・場所検索画面の手書きインライン SVG、会話作成・編集画面の 16px 相当のモデレーター削除ボタン、場所検索画面の住所入力ラベル未関連付けを仕様の対象に含めた。
- 憲章の WCAG 2.2 AA チェック項目に対応する検証は、計画・タスク工程でリンク先の達成基準本文を参照して行う。
- 仕様上の残存課題なし。上記の実装監査指摘を解消するため、`/speckit-clarify` を経ずに `/speckit-plan` へ進める。
