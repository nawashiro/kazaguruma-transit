# Quickstart: ライセンス情報自動生成

## 目的

ライセンスページを3セクションで自動生成し、`repository` / `funding` を含む本ソフトウェア情報表示と、オープンデータJSON管理、導入パッケージ自動収集を実装する。

## 実装順序（TDD）

1. **Red**: 変換ロジックのユニットテストを追加
- package.json から必須4項目を取得できること
- `repository` / `funding` は値がある場合のみ表示対象になること
- 欠損時のフォールバック表示値が判別可能であること

2. **Red**: オープンデータJSON読み込みテストを追加
- 必須フィールド不足時に検出できること
- 正常データがOpenDataセクションに反映されること

3. **Red**: 導入パッケージ収集結果の統合テストを追加
- デフォルト設定の収集対象がそのまま表示payloadに入ること
- ライセンス不明項目が判別可能な値で残ること

4. **Red**: UIレンダリングテストを追加
- 3セクション見出しが表示されること
- DaisyUIベースのコンポーネント構成（Card/List/Badge等）で表示されること
- `repository` / `funding` が未設定時に非表示であること

5. **Green**: 最小実装
- `src/lib/license` で収集・正規化・統合
- `src/app/api/licenses/route.ts` で統合レスポンス返却
- `src/app/license/page.tsx` で表示

6. **Refactor**
- 重複ロジック抽出、型定義整理、コメントの最小追加（Why中心）
- 独自UI部品を増やさず DaisyUI 利用へ寄せる

## 推奨コマンド

```bash
npx tsc --noEmit
npm run lint
npm test
npm run build
```

## 完了条件

- Spec の FR-001〜FR-011 を満たす
- `specs/005-license-page-autogen/contracts/license-api.openapi.yaml` と実装が一致する
- 4つの検証コマンドがすべて成功する
