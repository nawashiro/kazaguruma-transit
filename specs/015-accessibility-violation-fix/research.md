# Research: アクセシビリティ違反の修正

## 調査対象と参照方法

憲章の WCAG 2.2 AA チェックリストから、現行UIに関係する達成基準のリポジトリ内 Understanding 本文を読み、達成基準、意図、適用範囲、関連する達成方法を確認した。対象外の基準は、時間依存メディア、音声、動画、ドラッグ操作、モーション起動、文字キーショートカットが対象機能に存在しないことをソース検索で確認したうえで除外する。

## Decision: アイコンは既存のReactアイコンコンポーネントへ統一する

- **Rationale**: 憲章が手書きインライン SVG を避けることを明示しており、既存依存に `@heroicons/react` と `react-icons` がある。装飾アイコンは支援技術から無視し、意味を持つ情報はテキストで提供する。
- **Alternatives considered**: 新しいアイコンライブラリの追加は、依存とライセンス確認の範囲を増やすため採用しない。SVGを残して属性だけで補う方法は憲章違反を解消しないため採用しない。
- **Referenced documents**: `docs/accessibility/Understanding/1-1/1-1-1.md`, `docs/accessibility/Understanding/4-1/4-1-2.md`

## Decision: ナビゲーションと同一ページタブを区別する

- **Rationale**: ページ遷移用のリンクに `role="tab"` を付けると、タブパネルを伴うウィジェットとしての状態・関連付けが必要になる。ページ遷移は通常のリンクナビゲーションへ戻し、同一ページの承認・カテゴリ切替だけを `tablist` / `tab` / `tabpanel` の完全な組み合わせとして検証する。
- **Alternatives considered**: すべてをタブとして維持する方法は、ページ遷移とパネル切替の意味を混同し、`aria-controls` やフォーカス管理の不整合を残すため採用しない。
- **Referenced documents**: `docs/accessibility/Understanding/1-3/1-3-1.md`, `docs/accessibility/Understanding/2-4/2-4-4.md`, `docs/accessibility/Understanding/4-1/4-1-2.md`

## Decision: ラベルとグループ名はプログラムから判定可能にする

- **Rationale**: 住所入力は可視ラベルを持たず、出発地選択の fieldset は凡例を `aria-describedby` で参照している。入力目的は可視ラベルと `label` / `for`、グループ目的は `legend` / `aria-labelledby` で表現する。
- **Alternatives considered**: プレースホルダーや `aria-label` のみで補う方法は、可視ラベルとの一致や再利用性が弱く、ラベル・説明の達成基準を満たす根拠にならないため採用しない。
- **Referenced documents**: `docs/accessibility/Understanding/1-3/1-3-1.md`, `docs/accessibility/Understanding/2-5/2-5-3.md`, `docs/accessibility/Understanding/3-3/3-3-2.md`

## Decision: 44px、フォーカス、キーボードを共通契約として検証する

- **Rationale**: 共通 `Button` は 44px の最小サイズを持つ一方、モデレーター削除、モーダル閉じる、タブ、サイドバー開閉などに例外候補がある。全インタラクティブ要素をキーボードだけで操作し、フォーカスを視認できることを、共通契約と画面別テストで確認する。
- **Alternatives considered**: `btn` クラスが暗黙に保証するとみなす方法は、個別上書きや `btn-sm` でサイズが変わるため採用しない。
- **Referenced documents**: `docs/accessibility/Understanding/2-1/2-1-1.md`, `docs/accessibility/Understanding/2-4/2-4-7.md`, `docs/accessibility/Understanding/2-5/2-5-8.md`

## Decision: 色・リフローは実表示で受け入れる

- **Rationale**: `text-gray-400` などは通常テキスト上で低コントラストになる可能性があり、テーマや背景によって判定が変わる。200%拡大と狭い画面幅も、クラス文字列だけでは判定できないため、実ブラウザで検証する。
- **Alternatives considered**: Tailwindクラス名の有無だけで合否を決める方法は、合成された色、境界線、フォーカス状態、オーバーフローを評価できないため採用しない。
- **Referenced documents**: `docs/accessibility/Understanding/1-4/1-4-3.md`, `docs/accessibility/Understanding/1-4/1-4-4.md`, `docs/accessibility/Understanding/1-4/1-4-10.md`, `docs/accessibility/Understanding/1-4/1-4-11.md`

## Decision: 動的状態は重複なく通知する

- **Rationale**: 検索、読み込み、保存、エラー、承認状態はフォーカスを奪わず更新される。既存の `role="status"` / `role="alert"` を整理し、状態の種類に合う通知と `aria-describedby` を使い、同じ文言を複数のlive regionで読み上げない。
- **Alternatives considered**: すべてを `role="alert"` にする方法は通知が過剰になり、作業を中断させるため採用しない。
- **Referenced documents**: `docs/accessibility/Understanding/3-3/3-3-1.md`, `docs/accessibility/Understanding/4-1/4-1-3.md`
