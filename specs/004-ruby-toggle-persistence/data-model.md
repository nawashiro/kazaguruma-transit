# Data Model: ふりがな（ルビ）表示トグルの永続化

**Feature**: 004-ruby-toggle-persistence
**Date**: 2026-02-04
**Phase**: 1 - Design & Contracts

## Overview

この機能のデータモデルは非常にシンプルです。単一のboolean値（ルビ表示の有効/無効）をブラウザのlocalStorageに保存します。

## Entities

### RubyPreference（ルビ表示設定）

**説明**: ユーザーのふりがな（ルビ）表示設定を表す。

**属性**:

| 属性名 | 型 | 必須 | デフォルト | 説明 |
|--------|-----|------|-----------|------|
| isEnabled | boolean | はい | true | ルビ表示が有効（true）か無効（false）か |

**保存場所**: ブラウザのlocalStorage

**保存形式**:
- キー: `rubyful-display-preference`
- 値: 文字列 `"true"` または `"false"`

**バリデーション**:
- 値が`"true"`または`"false"`以外の場合、デフォルト値（`true`）を使用
- localStorageが使用できない場合、デフォルト値（`true`）を使用
- nullまたは未定義の場合、デフォルト値（`true`）を使用

## State Transitions

```
[初回アクセス]
  ↓
[localStorage未設定] → デフォルト値（true）を使用
  ↓
[ユーザーがトグルボタンをクリック]
  ↓
[RubyfulV2が状態を更新]
  ↓
[新しい状態をlocalStorageに保存]
  ↓
[次回アクセス時にlocalStorageから読み込み]
```

### 状態遷移の詳細

1. **初回アクセス**
   - localStorage未設定
   - `loadRubyPreference()` → `true`（デフォルト）
   - RubyfulV2が`defaultDisplay: true`で初期化される

2. **トグルボタンクリック（オン→オフ）**
   - ユーザーがトグルボタンをクリック
   - RubyfulV2が内部状態を`isEnabled: false`に更新
   - クリックイベントリスナーが発火
   - 100ms遅延後、`RubyfulV2.instance.state.isEnabled`から状態を取得
   - `saveRubyPreference(false)`が呼ばれる
   - localStorage: `"rubyful-display-preference"` → `"false"`

3. **トグルボタンクリック（オフ→オン）**
   - 同様の流れで`isEnabled: true`に更新
   - localStorage: `"rubyful-display-preference"` → `"true"`

4. **ページリロード**
   - `loadRubyPreference()`がlocalStorageから値を読み込む
   - localStorage: `"rubyful-display-preference"` → `"false"` の場合
   - RubyfulV2が`defaultDisplay: false`で初期化される

5. **localStorage使用不可の場合**
   - `isLocalStorageAvailable()` → `false`
   - `loadRubyPreference()` → `true`（デフォルト）
   - 保存操作は失敗するが、エラーを表示せずデフォルト動作を継続

## Data Flow

```
┌─────────────────────┐
│  ユーザー           │
│  (トグルボタン      │
│   をクリック)       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  RubyfulV2          │
│  (状態を更新)       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  observeRubyToggle  │
│  (クリックイベント  │
│   リスナー)         │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  saveRubyPreference │
│  (localStorage保存) │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  localStorage       │
│  ["rubyful-display- │
│   preference"]      │
└─────────────────────┘


[ページリロード]
           │
           ▼
┌─────────────────────┐
│  loadRubyPreference │
│  (localStorage読込) │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  RubyfulV2.init()   │
│  (defaultDisplay設定)│
└─────────────────────┘
```

## Storage Schema

### localStorage

**キー**: `rubyful-display-preference`

**値の型**: string

**有効な値**:
- `"true"` - ルビ表示オン
- `"false"` - ルビ表示オフ

**無効な値の処理**:
- `null` → デフォルト値（`true`）
- `undefined` → デフォルト値（`true`）
- `"true"`, `"false"` 以外の文字列 → デフォルト値（`true`）、コンソールに警告を出力

**容量**: 約20バイト（キー + 値の合計）

**有効期限**: なし（ユーザーがブラウザデータを削除するまで永続）

## Type Definitions

### TypeScript型定義

```typescript
/**
 * localStorageのキー名
 */
export const RUBY_PREFERENCE_KEY = 'rubyful-display-preference' as const;

/**
 * デフォルト設定値（ルビ表示オン）
 */
export const DEFAULT_RUBY_DISPLAY = true as const;

/**
 * ルビ表示設定の型
 */
export type RubyPreference = boolean;

/**
 * localStorage保存形式の型
 */
export type RubyPreferenceStorageValue = 'true' | 'false';
```

## Relationships

この機能は独立しており、他のデータモデルとの関係はありません。

- **Nostr認証**: 無関係（ルビ設定はユーザーアカウントに紐付かない）
- **Transit データ**: 無関係（ルビ設定は交通データに影響しない）
- **Discussion データ**: 無関係（ルビ設定はディスカッション機能に影響しない）

## Migration & Backwards Compatibility

### 初回リリース時

既存ユーザー:
- localStorageに設定が存在しない
- `loadRubyPreference()` → `true`（デフォルト）
- 既存の動作（常にオン）と同じ

新規ユーザー:
- localStorageに設定が存在しない
- `loadRubyPreference()` → `true`（デフォルト）
- デフォルトでルビ表示がオン

### 将来の拡張性

将来的にルビ設定を拡張する場合の考慮事項:

**Option 1: キーを変更せず、値の形式を変更**
```typescript
// 現在: "true" | "false"
localStorage.setItem('rubyful-display-preference', 'true');

// 将来: JSON形式
localStorage.setItem('rubyful-display-preference', JSON.stringify({
  isEnabled: true,
  fontSize: 'medium',
  color: 'default'
}));
```

マイグレーション戦略:
```typescript
function loadRubyPreference(): RubyPreference {
  const stored = localStorage.getItem(RUBY_PREFERENCE_KEY);
  if (!stored) return { isEnabled: true };

  try {
    // 新形式（JSON）のパース
    return JSON.parse(stored);
  } catch {
    // 旧形式（文字列 "true"/"false"）の処理
    return { isEnabled: stored === 'true' };
  }
}
```

**Option 2: 新しいキーを使用**
```typescript
// 現在: 'rubyful-display-preference'
// 将来: 'rubyful-preferences-v2'
```

マイグレーション戦略:
```typescript
function migrateRubyPreference(): void {
  const oldValue = localStorage.getItem('rubyful-display-preference');
  if (oldValue && !localStorage.getItem('rubyful-preferences-v2')) {
    const newValue = {
      isEnabled: oldValue === 'true',
      fontSize: 'medium',
      color: 'default'
    };
    localStorage.setItem('rubyful-preferences-v2', JSON.stringify(newValue));
  }
}
```

**推奨**: 現時点では拡張性を考慮せず、シンプルな文字列形式を維持する。将来的に拡張が必要になった場合は、Option 1のマイグレーション戦略を採用する。

## Data Retention & Privacy

### データ保持期間

- **保存期間**: ユーザーがブラウザデータを削除するまで永続
- **削除方法**: ブラウザのクリアデータ機能、またはlocalStorageの手動削除

### プライバシー

- **個人情報**: 含まれない（boolean値のみ）
- **追跡**: 不可能（ユーザーIDやセッションIDは保存されない）
- **共有**: されない（ブラウザローカルのみ）
- **暗号化**: 不要（機密情報ではない）

### GDPR / プライバシー法への準拠

- **同意**: 不要（機能的なCookieであり、プライバシーに影響しない）
- **削除権**: ブラウザのクリアデータ機能で対応可能
- **移植性**: localStorageから手動でエクスポート可能（実装は不要）

## Error Handling

### エラーケース

1. **localStorage使用不可**
   - プライベートブラウジングモード
   - ブラウザ設定でストレージが無効化
   - 容量超過

   **処理**: デフォルト値（`true`）を使用、エラーをコンソールに記録

2. **不正な値**
   - `"true"`, `"false"` 以外の文字列が保存されている

   **処理**: デフォルト値（`true`）を使用、警告をコンソールに記録

3. **RubyfulV2未ロード**
   - CDNからのスクリプト読み込み失敗
   - ネットワークエラー

   **処理**: 初期化をスキップ、エラーログを出力

4. **トグルボタンが見つからない**
   - DOMが予期しない構造に変更された
   - RubyfulV2の初期化失敗

   **処理**: イベントリスナーを追加せず、初期化のみ実行

## Performance Considerations

### 読み込みパフォーマンス

- **localStorage読み込み**: 同期的、1ms未満
- **初期化処理**: Script onLoadコールバック内、5ms未満
- **影響**: ページ読み込み時間への影響は無視できるレベル

### 保存パフォーマンス

- **localStorage書き込み**: 同期的、1ms未満
- **トグル操作**: クリックからlocalStorage保存まで100-150ms（RubyfulV2の状態更新待ち時間を含む）
- **影響**: ユーザー体験への影響は無視できるレベル

### メモリ使用量

- **イベントリスナー**: 1つのクリックイベントリスナー
- **メモリ**: 約1KB未満
- **影響**: 無視できるレベル
