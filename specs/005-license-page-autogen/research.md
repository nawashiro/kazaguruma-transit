# Phase 0 Research: ライセンス情報自動生成

## Decision 1: 導入パッケージのライセンス収集方式

- **Decision**: 導入パッケージ情報は `webpack-license-plugin` を採用し、表示対象範囲はツールのデフォルト設定に一致させる。
- **Rationale**: 仕様の Clarification で「デフォルト準拠」が確定済みであり、独自フィルタ条件を持ち込むと検証軸が増えるため。既存Nodeエコシステムとの整合性も高い。
- **Alternatives considered**:
  - 独自スクリプトで `package-lock.json` を解析: 柔軟だが保守負荷が高い
  - 別ライブラリ（license-checker等）: 可能だが既定方針との差異検証が必要

## Decision 2: package.json メタデータ正規化

- **Decision**: 本ソフトウェア表示は `name` `version` `license` `author` を必須扱い、`repository` `funding` は値がある場合のみ表示する。`author`/`repository`/`funding` の複数形式（文字列・オブジェクト・配列）は表示用に正規化する。
- **Rationale**: 仕様要件（FR-002/FR-010）と edge case を両立し、未設定の任意項目でUIが冗長にならないため。
- **Alternatives considered**:
  - 任意項目も常時表示して「未設定」と出す: 情報密度が低下しやすい
  - 必須項目を減らす: 仕様と不一致

## Decision 3: オープンデータ管理JSONのスキーマ

- **Decision**: 1エントリあたり `name`, `provider`, `licenseName`, `licenseUrl`, `sourceUrl`, `description` を持つ配列形式を採用し、`name` と `licenseName` を必須項目とする。
- **Rationale**: 現行ページの記載情報を過不足なく移行でき、表示項目（名称/提供者/ライセンス/参照先）を満たせるため。
- **Alternatives considered**:
  - 任意フィールド中心の自由形式JSON: 柔軟だが型安全とテスト容易性が低下
  - JSONではなくTS定数: 非エンジニア更新性が低い

## Decision 4: ライセンス表示取得インターフェース

- **Decision**: 表示データの取得窓口を `GET /api/licenses` で統一し、UIはこの統合ペイロードを描画する。
- **Rationale**: テスト（contract/integration）を分離しやすく、将来の表示変更時にUIを薄く保てるため。
- **Alternatives considered**:
  - `page.tsx` から直接3データソースを読む: 実装は早いがテスト分離が難しい
  - 複数APIに分割: 初期スコープに対して過剰

## Decision 5: UIコンポーネント方針（ユーザー追加入力反映）

- **Decision**: 独自UI部品の新規作成は最小限にし、DaisyUIの既存コンポーネント（Card/List/Divider/Badge等）を優先利用する。
- **Rationale**: ユーザー指定に沿い、既存スタイルとの一貫性・実装速度・保守性を改善できるため。
- **Alternatives considered**:
  - 完全カスタムコンポーネント化: 表現自由度は高いが保守コストが上がる
  - 既存Cardのみ固定利用: 柔軟性が不足し要件追加時に詰まりやすい

## Resolved Clarifications

Technical Context 上の `NEEDS CLARIFICATION` は全て解消済み。
