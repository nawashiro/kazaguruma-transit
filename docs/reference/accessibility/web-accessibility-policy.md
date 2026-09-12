# ウェブアクセシビリティ方針

## 位置づけ

この方針は、サイトで実施するアクセシビリティの方法を定めます。開発原則の正本は[`docs/reference/constitution.md`](../constitution.md)です。この文書は憲章を複製せず、ウェブ画面の運用へ具体化します。

目標は[WCAG 2.2](https://www.w3.org/TR/WCAG22/)レベルAAです。目標を示す文書であり、適合証明ではありません。

## 対象

次の画面と共通部品を対象にします。

- `src/app`が提供する公開画面、認証画面、設定画面、意見交換画面
- `src/components/layouts`の共通レイアウトとナビゲーション
- `src/components/features`の経路検索、場所検索、出力、支援機能
- `src/components/discussion`の投稿、評価、承認、権限表示
- `src/components/ui`のボタン、入力欄、カード、通知、フォーカス移動
- 外部データの読み込み失敗、通信遅延、権限不足を示す画面

保存した外部原文[`docs/accessibility/Understanding/**`](../../accessibility/Understanding/)は変更しません。判定項目は[`wcag-22-checklist.md`](./wcag-22-checklist.md)で管理します。

## 現行方針

### 意味構造

ネイティブのHTML要素を優先します。各画面に目的を示す見出しを置きます。共通レイアウトは`main#main-content`を1つ提供します。

### 移動

[`SkipToContent`](../../../src/components/ui/SkipToContent.tsx)でメイン領域へ移動できるようにします。サイドバーは`nav`と`aria-label="サイトナビゲーション"`を使います。リンクには遷移先を示す名前を付けます。

場所カテゴリと意見交換のタブは、URLを持つネイティブリンクで実装します。現在項目には`aria-selected`、`aria-current`、`tabindex`を設定します。矢印キー、Home、Endでフォーカスを移動します。

### フォーム

`label`と入力要素を関連付けます。必須項目、入力上限、エラーを明示します。入力エラーは対象と修正方法を日本語で示します。認証画面ではパスキーを使う利用者が入力を転記せずに操作できるようにします。

### フォーカスと操作

キーボードで全ての重要な操作を実行できるようにします。フォーカス表示を隠しません。操作対象には実用的な最小サイズを設定します。ドラッグだけに依存する操作は追加しません。

### 状態と通知

読み込み中、部分取得、通信エラー、権限不足を画面へ示します。状態通知には適切な`role`と`aria-live`を使います。ボタンの無効化理由を、視覚情報だけに頼らずテキストでも示します。

### 表示とレスポンシブ対応

画面幅320pxから1440pxまで内容を確認します。場所カテゴリのタブは折り返し、横方向の強制スクロールを使いません。文字拡大時も内容と操作対象を確認します。

ルビはRubyful v2による補助表示です。外部スクリプトが利用できなくても、本文と操作名を失わない構造にします。

### プライバシーと権限表示

意見交換画面では、作成者とモデレーターの役割をバッジで示します。監査用の名前表示は管理者またはモデレーターに限定します。権限のない利用者へ操作理由を説明します。

## 検証

変更後は、対象に応じて次の確認を実行します。

1. `npx tsc --noEmit --incremental false`
2. `npm run lint`
3. `npm test -- --runInBand --ci`
4. `npm run accessibility`
5. `npm run accessibility:strict`

Lighthouseの既定値は[`scripts/accessibility-audit-config.ts`](../../../scripts/accessibility-audit-config.ts)で管理します。ルート、ベースURL、出力先、Chromeフラグは次の設定名で変更します。

- `LIGHTHOUSE_ROUTES`
- `LIGHTHOUSE_BASE_URL`
- `LIGHTHOUSE_OUTPUT_DIR`
- `LIGHTHOUSE_CHROME_FLAGS`
- `LIGHTHOUSE_ASSERTION_LEVEL`

自動検査に加えて、キーボード、フォーカス、読み上げ、拡大表示、狭い画面、エラー回復を手動確認します。監査の未達を文書の変更だけで隠しません。未対応の実装は別の修正課題として扱います。
