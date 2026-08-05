# Research: AIエージェント向け経路案内

## Decision 1: ネイティブ `details`／`summary` を DaisyUI Collapse と組み合わせる

- **Decision**: 既存の `Card` 内に、`collapse`、`collapse-title`、`collapse-content` を付けた `details`／`summary` を配置する。`open` 属性を設定しないため、初期状態は閉じる。
- **Rationale**: DaisyUI 5 の現行公式ドキュメントは、内容の表示・非表示に Collapse を用い、`details`／`summary` 形式を提供している。この形式は開閉のための独自のクライアント状態を要さず、本文をブラウザ検索の対象に保てる。標準の要素がキーボード操作、フォーカス、開閉状態を提供するため、WCAG 2.2 の 2.1.1 と 4.1.2 の意図に適合する。
- **Alternatives considered**:
  - `div` に `tabIndex` を付けるフォーカス型 Collapse: フォーカスを外すと閉じるため、「もう一度操作すると閉じる」という明示的なトグル操作と合わない。
  - チェックボックス型 Collapse: 同じ挙動は得られるが、表示用カードに操作のためのフォーム入力を導入する必要があり、ネイティブ開閉要素より意味が弱い。
  - React state で独自のボタンと領域を実装する: 状態とARIAの同期を新たに管理する必要があり、静的な案内には過剰である。

## Decision 2: 既存のトップページに直接追加する

- **Decision**: 新規コンポーネントを作らず、`src/app/page.tsx` の既存非公式サービス案内 `Card` の直後に追加する。
- **Rationale**: 要求はトップページに1つだけ表示する静的な案内であり、他画面での再利用、データ取得、状態共有を必要としない。既存ページはすでにクライアントコンポーネントであり、追加による境界変更もない。
- **Alternatives considered**:
  - 共有UIコンポーネント化: 再利用の根拠がなく、props・テスト対象だけを増やす。
  - ルート結果ページへ表示: 指定された「ルートページ」は既存の検索入力トップページを意味し、非公式サービス案内カードもそこにある。

## Decision 3: 長いURL形式は折り返し可能にする

- **Decision**: URLテンプレートをテキストとして提示し、狭い表示幅でも内容が失われない折り返しスタイルを付ける。
- **Rationale**: 仕様は375px幅で横スクロールなしの閲覧を求める。WCAG 2.2 1.4.10 は、320 CSS px相当の幅で情報や機能を失わず二次元スクロールを不要にすることを求める。
- **Alternatives considered**:
  - 横スクロール可能なコードブロック: URLを読むために横スクロールが必要となり、要件に反する。
  - URLを短縮または省略: AIエージェントが使用する正確なパラメータ形式を失う。

## Sources consulted

- [daisyUI Collapse component documentation](https://daisyui.com/components/collapse/) — v5.7.15。`collapse`、`collapse-title`、`collapse-content` と、`details`／`summary` を使う実装例を確認。
- `docs/accessibility/Understanding/1-4/1-4-10.md` — 狭い幅・拡大時のリフロー要件を確認。
- `docs/accessibility/Understanding/2-1/2-1-1.md` — ポインタ操作にキーボード同等操作が必要であることを確認。
- `docs/accessibility/Understanding/2-4/2-4-7.md` — キーボードフォーカスの可視性を確認。
- `docs/accessibility/Understanding/4-1/4-1-2.md` — 標準UI要素による名前、役割、状態の公開を確認。
