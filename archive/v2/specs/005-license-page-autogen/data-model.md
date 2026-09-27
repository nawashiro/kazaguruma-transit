# Data Model: ライセンス情報自動生成

## 1. ProjectMetadata

- **Purpose**: 本ソフトウェア（このプロジェクト）のライセンス表示用メタデータ
- **Fields**:
  - `name` (string, required)
  - `version` (string, required)
  - `license` (string, required)
  - `author` (string, required, normalized)
  - `repository` (string, optional, normalized URL)
  - `funding` (string[], optional, normalized URLs)
  - `homepage` (string, optional)
  - `description` (string, optional)
- **Validation Rules**:
  - 必須4項目は空文字不可
  - `repository`/`funding` は値がある場合のみ表示対象
  - URL項目は `http`/`https` のみ許容

## 2. OpenDataLicenseEntry

- **Purpose**: オープンデータ1件分のライセンス情報
- **Fields**:
  - `id` (string, required, unique)
  - `name` (string, required)
  - `provider` (string, optional)
  - `licenseName` (string, required)
  - `licenseUrl` (string, optional)
  - `sourceUrl` (string, optional)
  - `description` (string, optional)
- **Validation Rules**:
  - `id` は一意
  - `name` と `licenseName` は必須
  - URL項目は `http`/`https` のみ許容

## 3. DependencyLicenseEntry

- **Purpose**: 導入パッケージ1件分のライセンス情報
- **Fields**:
  - `packageName` (string, required)
  - `version` (string, required)
  - `license` (string, required, fallback allowed)
  - `author` (string, optional)
  - `repository` (string, optional)
  - `homepage` (string, optional)
- **Validation Rules**:
  - `packageName` + `version` の組み合わせで実質一意
  - `license` 欠損時は判別可能な代替値（例: `UNKNOWN`）
  - 収集対象はライセンス収集ツールのデフォルト設定準拠

## 4. LicensePagePayload

- **Purpose**: UIに返す統合レスポンス
- **Fields**:
  - `software` (ProjectMetadata, required)
  - `openData` (OpenDataLicenseEntry[], required)
  - `dependencies` (DependencyLicenseEntry[], required)
  - `generatedAt` (string, required, ISO-8601)
- **Validation Rules**:
  - 3セクションは常に配下に存在
  - `openData` / `dependencies` は0件でも配列で返却

## Relationships

- LicensePagePayload `1 - 1` ProjectMetadata
- LicensePagePayload `1 - n` OpenDataLicenseEntry
- LicensePagePayload `1 - n` DependencyLicenseEntry

## State Transitions

1. **Collect**: package.json / open-data JSON / dependency report を収集
2. **Normalize**: 形式差分（author/repository/funding等）を統一
3. **Validate**: 必須項目・URL・欠損値を検証
4. **Render-ready**: UI表示可能な payload を確定
