# WCAG 2.2チェックリスト

このチェックリストは、サイトのアクセシビリティ確認に使います。目標はWCAG 2.2のレベルAAです。チェック結果は適合証明を意味しません。

## 正本と参照資料

- [WCAG 2.2公式仕様](https://www.w3.org/TR/WCAG22/)
- [WCAG 2.2 Understanding一覧](https://www.w3.org/WAI/WCAG22/Understanding/)
- [リポジトリに保存したUnderstanding資料](../../accessibility/Understanding/)
- [ウェブアクセシビリティ方針](./web-accessibility-policy.md)

`docs/accessibility/Understanding/**`は保存した外部原文です。本文を変更しません。この文書から現行位置へリンクします。ローカル資料にない達成基準は、W3C公式Understandingへリンクします。

## 判定欄

各項目を実装、テスト、手動確認で判定します。

- [ ] 未確認
- [ ] 要対応
- [ ] 確認済み

## 1. 知覚可能

情報とユーザーインターフェースを知覚できる形で提供します。

### 1.1テキストによる代替

- [ ] [達成基準1.1.1非テキストコンテンツ（レベルA）](../../accessibility/Understanding/1-1/1-1-1.md)

### 1.2時間依存メディア

- [ ] [達成基準1.2.1音声のみ及び映像のみ（収録済）（レベルA）](../../accessibility/Understanding/1-2/1-2-1.md)
- [ ] [達成基準1.2.2キャプション（収録済）（レベルA）](../../accessibility/Understanding/1-2/1-2-2.md)
- [ ] [達成基準1.2.3音声解説又はメディアに対する代替（収録済）（レベルA）](../../accessibility/Understanding/1-2/1-2-3.md)
- [ ] [達成基準1.2.4キャプション（ライブ）（レベルAA）](../../accessibility/Understanding/1-2/1-2-4.md)
- [ ] [達成基準1.2.5音声解説（収録済）（レベルAA）](../../accessibility/Understanding/1-2/1-2-5.md)

### 1.3適応可能

- [ ] [達成基準1.3.1情報及び関係性（レベルA）](../../accessibility/Understanding/1-3/1-3-1.md)
- [ ] [達成基準1.3.2意味のある順序（レベルA）](../../accessibility/Understanding/1-3/1-3-2.md)
- [ ] [達成基準1.3.3感覚的な特徴（レベルA）](../../accessibility/Understanding/1-3/1-3-3.md)
- [ ] [達成基準1.3.4向き（レベルAA）](../../accessibility/Understanding/1-3/1-3-4.md)
- [ ] [達成基準1.3.5入力目的の特定（レベルAA）](https://www.w3.org/WAI/WCAG22/Understanding/identify-input-purpose.html)

### 1.4判別可能

- [ ] [達成基準1.4.1色の使用（レベルA）](../../accessibility/Understanding/1-4/1-4-1.md)
- [ ] [達成基準1.4.2音声の制御（レベルA）](../../accessibility/Understanding/1-4/1-4-2.md)
- [ ] [達成基準1.4.3コントラスト（最低）（レベルAA）](../../accessibility/Understanding/1-4/1-4-3.md)
- [ ] [達成基準1.4.4テキストのサイズ変更（レベルAA）](../../accessibility/Understanding/1-4/1-4-4.md)
- [ ] [達成基準1.4.5画像化された文字（レベルAA）](../../accessibility/Understanding/1-4/1-4-5.md)
- [ ] [達成基準1.4.10リフロー（レベルAA）](../../accessibility/Understanding/1-4/1-4-10.md)
- [ ] [達成基準1.4.11非テキストのコントラスト（レベルAA）](../../accessibility/Understanding/1-4/1-4-11.md)
- [ ] [達成基準1.4.12テキストの間隔（レベルAA）](../../accessibility/Understanding/1-4/1-4-12.md)
- [ ] [達成基準1.4.13ホバー又はフォーカス時の内容表示（レベルAA）](../../accessibility/Understanding/1-4/1-4-13.md)

## 2. 操作可能

ユーザーインターフェースとナビゲーションを操作できるようにします。

### 2.1キーボード操作可能

- [ ] [達成基準2.1.1キーボード（レベルA）](../../accessibility/Understanding/2-1/2-1-1.md)
- [ ] [達成基準2.1.2キーボードトラップなし（レベルA）](../../accessibility/Understanding/2-1/2-1-2.md)
- [ ] [達成基準2.1.4文字キーショートカット（レベルA）](../../accessibility/Understanding/2-1/2-1-4.md)

### 2.2十分な時間

- [ ] [達成基準2.2.1タイミング調整可能（レベルA）](../../accessibility/Understanding/2-2/2-2-1.md)
- [ ] [達成基準2.2.2一時停止、停止、非表示（レベルA）](../../accessibility/Understanding/2-2/2-2-2.md)

### 2.3発作と身体的反応

- [ ] [達成基準2.3.1 3回の閃光又は閾値以下（レベルA）](../../accessibility/Understanding/2-3/2-3-1.md)

### 2.4ナビゲーション可能

- [ ] [達成基準2.4.1ブロックスキップ（レベルA）](../../accessibility/Understanding/2-4/2-4-1.md)
- [ ] [達成基準2.4.2ページタイトル（レベルA）](../../accessibility/Understanding/2-4/2-4-2.md)
- [ ] [達成基準2.4.3フォーカス順序（レベルA）](../../accessibility/Understanding/2-4/2-4-3.md)
- [ ] [達成基準2.4.4リンクの目的（コンテキスト内）（レベルA）](../../accessibility/Understanding/2-4/2-4-4.md)
- [ ] [達成基準2.4.5複数の手段（レベルAA）](../../accessibility/Understanding/2-4/2-4-5.md)
- [ ] [達成基準2.4.6見出し及びラベル（レベルAA）](../../accessibility/Understanding/2-4/2-4-6.md)
- [ ] [達成基準2.4.7フォーカス可視（レベルAA）](../../accessibility/Understanding/2-4/2-4-7.md)
- [ ] [達成基準2.4.11フォーカスが隠されない（最低限）（レベルAA）](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html)

### 2.5入力モダリティ

- [ ] [達成基準2.5.1ポインターによるジェスチャー（レベルA）](../../accessibility/Understanding/2-5/2-5-1.md)
- [ ] [達成基準2.5.2ポインターのキャンセル（レベルA）](../../accessibility/Understanding/2-5/2-5-2.md)
- [ ] [達成基準2.5.3ラベル名（レベルA）](../../accessibility/Understanding/2-5/2-5-3.md)
- [ ] [達成基準2.5.4モーション起動（レベルA）](../../accessibility/Understanding/2-5/2-5-4.md)
- [ ] [達成基準2.5.7ドラッグ操作（レベルAA）](../../accessibility/Understanding/2-5/2-5-7.md)
- [ ] [達成基準2.5.8ターゲットサイズ（最小）（レベルAA）](../../accessibility/Understanding/2-5/2-5-8.md)

## 3. 理解可能

情報と操作方法を理解できるようにします。

### 3.1読み取り可能

- [ ] [達成基準3.1.1ページの言語（レベルA）](../../accessibility/Understanding/3-1/3-1-1.md)
- [ ] [達成基準3.1.2一部の言語（レベルAA）](../../accessibility/Understanding/3-1/3-1-2.md)

### 3.2予測可能

- [ ] [達成基準3.2.1フォーカス時の動作（レベルA）](../../accessibility/Understanding/3-2/3-2-1.md)
- [ ] [達成基準3.2.2入力時の動作（レベルA）](../../accessibility/Understanding/3-2/3-2-2.md)
- [ ] [達成基準3.2.3一貫したナビゲーション（レベルAA）](../../accessibility/Understanding/3-2/3-2-3.md)
- [ ] [達成基準3.2.4一貫した識別（レベルAA）](../../accessibility/Understanding/3-2/3-2-4.md)
- [ ] [達成基準3.2.6一貫したヘルプ（レベルA）](https://www.w3.org/WAI/WCAG22/Understanding/consistent-help.html)

### 3.3入力支援

- [ ] [達成基準3.3.1エラーの特定（レベルA）](../../accessibility/Understanding/3-3/3-3-1.md)
- [ ] [達成基準3.3.2ラベル又は説明（レベルA）](../../accessibility/Understanding/3-3/3-3-2.md)
- [ ] [達成基準3.3.3エラー修正の提案（レベルAA）](../../accessibility/Understanding/3-3/3-3-3.md)
- [ ] [達成基準3.3.4法的・財務・データのエラー防止（レベルAA）](../../accessibility/Understanding/3-3/3-3-4.md)
- [ ] [達成基準3.3.7冗長な入力（レベルA）](https://www.w3.org/WAI/WCAG22/Understanding/redundant-entry.html)
- [ ] [達成基準3.3.8アクセシブルな認証（最低限）（レベルAA）](https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html)

## 4. 堅牢性

コンテンツを現在と将来のユーザーエージェントや支援技術で解釈できるようにします。

### 4.1互換性

- [ ] [達成基準4.1.2名前・役割・値（レベルA）](../../accessibility/Understanding/4-1/4-1-2.md)
- [ ] [達成基準4.1.3ステータスメッセージ（レベルAA）](../../accessibility/Understanding/4-1/4-1-3.md)

WCAG2.2で削除された旧パーシング項目は、チェックリストの判定対象に含めません。保存済み資料に同名の原文があっても、現行の判定項目として扱いません。

## 実装とテストの照合先

- 共通構造は[`src/app/layout.tsx`](../../../src/app/layout.tsx)と[`SidebarLayout`](../../../src/components/layouts/SidebarLayout.tsx)で確認します。
- `SkipToContent`は[`src/components/ui/SkipToContent.tsx`](../../../src/components/ui/SkipToContent.tsx)で確認します。
- 共通のメイン領域は`main#main-content`とし、キーボード移動先を提供します。
- ナビゲーションは[`Sidebar`](../../../src/components/layouts/Sidebar.tsx)で確認します。ナビゲーション名、リンク名、ネイティブ要素を確認します。
- ルートの意味構造は[`accessible-route-pages.test.tsx`](../../../src/app/__tests__/accessible-route-pages.test.tsx)で確認します。
- 場所カテゴリのキーボード操作とレスポンシブ表示は[`location-pages-responsive-contract.test.tsx`](../../../src/app/__tests__/location-pages-responsive-contract.test.tsx)で確認します。
- サイドバーの構造と状態は[`Sidebar.test.tsx`](../../../src/components/layouts/__tests__/Sidebar.test.tsx)と[`SidebarLayout.test.tsx`](../../../src/components/layouts/__tests__/SidebarLayout.test.tsx)で確認します。
- Lighthouse監査の既定ルートと設定は[`scripts/accessibility-audit-config.ts`](../../../scripts/accessibility-audit-config.ts)で確認します。既定ルートは`/`、`/beginners-guide`、`/locations`、`/license`、`/login`です。
- 監査は`npm run accessibility`で実行します。通常実行は失敗項目を警告として出し、厳格な終了判定は`npm run accessibility:strict`で実行します。strictではアクセシビリティまたは色コントラストの未達で終了します。

## 確認時の注意

自動監査だけで適合を判断しません。キーボード操作、フォーカス表示、読み上げ順序、エラー内容、縮小画面を手動でも確認します。未対応の項目は要対応として記録し、文書だけで実装済みと扱いません。
