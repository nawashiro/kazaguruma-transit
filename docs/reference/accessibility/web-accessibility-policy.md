# ウェブアクセシビリティ方針

## 位置づけ

この方針は、サイトで実施するアクセシビリティの方法を定めます。開発原則の正本は[`docs/reference/constitution.md`](../constitution.md)です。この文書は憲章を複製せず、ウェブ画面の運用へ具体化します。

目標は[WCAG 2.2](https://www.w3.org/TR/WCAG22/)レベルAAです。目標を示す文書であり、適合証明ではありません。

保存した外部原文[`external-docs/accessibility/Understanding/**`](../../../external-docs/accessibility/Understanding/)は変更しません。判定項目は[`wcag-22-checklist.md`](./wcag-22-checklist.md)で管理します。

## 現行方針

### 意味構造

ネイティブの意味論・HTML要素を優先します。各画面に目的を示す見出しを置きます。共通レイアウトは`main#main-content`を1つ提供します。

### 表示とレスポンシブ対応

画面幅320pxから1440pxまで内容を確認します。場所カテゴリのタブは折り返し、横方向の強制スクロールを使いません。文字拡大時も内容と操作対象を確認します。

ルビはRubyful v2による補助表示です。外部スクリプトが利用できなくても、本文と操作名を失わない構造にします。

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
