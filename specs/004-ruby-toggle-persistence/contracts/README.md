# API Contracts: ふりがな（ルビ）表示トグルの永続化

**Feature**: 004-ruby-toggle-persistence
**Date**: 2026-02-04
**Phase**: 1 - Design & Contracts

## Overview

この機能はクライアントサイドのみで完結するため、サーバーAPIは不要です。

代わりに、クライアントサイドの公開関数インターフェース（TypeScript API）を定義します。

## Client-Side API Contract

### Module: `@/lib/preferences/ruby-preference`

**Purpose**: ルビ表示設定の永続化を担当するサービスモジュール

**Exports**:
- 関数: `loadRubyPreference`, `saveRubyPreference`, `isLocalStorageAvailable`, `observeRubyToggle`
- 定数: `RUBY_PREFERENCE_KEY`, `DEFAULT_RUBY_DISPLAY`

---

## API Specification

### Function: `isLocalStorageAvailable()`

**Purpose**: localStorageが使用可能かチェックする

**Signature**:
```typescript
function isLocalStorageAvailable(): boolean
```

**Parameters**: なし

**Returns**:
- `boolean` - localStorageが使用可能な場合は`true`、使用不可の場合は`false`

**Behavior**:
1. テスト用のキー・バリューペアをlocalStorageに書き込む
2. 書き込みが成功したら、そのキーを削除する
3. 例外が発生した場合は`false`を返す

**Throws**: なし（すべての例外はキャッチされる）

**Side Effects**: テスト用のlocalStorageキー（`__localStorage_test__`）の一時的な作成と削除

**Example**:
```typescript
if (isLocalStorageAvailable()) {
  // localStorageを使用する処理
} else {
  // フォールバック処理
}
```

---

### Function: `loadRubyPreference()`

**Purpose**: ルビ表示設定をlocalStorageから読み込む

**Signature**:
```typescript
function loadRubyPreference(): boolean
```

**Parameters**: なし

**Returns**:
- `boolean` - ルビ表示が有効（`true`）か無効（`false`）か
- 設定が存在しない場合、または読み込みに失敗した場合は`DEFAULT_RUBY_DISPLAY`（`true`）

**Behavior**:
1. `isLocalStorageAvailable()`で使用可能性をチェック
   - 使用不可の場合、`DEFAULT_RUBY_DISPLAY`を返す
2. `localStorage.getItem(RUBY_PREFERENCE_KEY)`で値を取得
   - `null`の場合（初回アクセス）、`DEFAULT_RUBY_DISPLAY`を返す
   - `"true"`の場合、`true`を返す
   - `"false"`の場合、`false`を返す
   - その他の値の場合、警告をログに出力し`DEFAULT_RUBY_DISPLAY`を返す
3. 例外が発生した場合、エラーをログに出力し`DEFAULT_RUBY_DISPLAY`を返す

**Throws**: なし（すべての例外はキャッチされる）

**Side Effects**:
- ログ出力（警告またはエラー）
- localStorage読み込み

**Example**:
```typescript
const isRubyEnabled = loadRubyPreference();
console.log(`Ruby display: ${isRubyEnabled ? 'ON' : 'OFF'}`);
```

---

### Function: `saveRubyPreference(isEnabled)`

**Purpose**: ルビ表示設定をlocalStorageに保存する

**Signature**:
```typescript
function saveRubyPreference(isEnabled: boolean): boolean
```

**Parameters**:
- `isEnabled: boolean` - ルビ表示が有効（`true`）か無効（`false`）か

**Returns**:
- `boolean` - 保存に成功した場合は`true`、失敗した場合は`false`

**Behavior**:
1. `isLocalStorageAvailable()`で使用可能性をチェック
   - 使用不可の場合、警告をログに出力し`false`を返す
2. `localStorage.setItem(RUBY_PREFERENCE_KEY, String(isEnabled))`で値を保存
   - 成功した場合、ログに出力し`true`を返す
3. 例外が発生した場合、エラーをログに出力し`false`を返す

**Throws**: なし（すべての例外はキャッチされる）

**Side Effects**:
- localStorage書き込み
- ログ出力

**Example**:
```typescript
const success = saveRubyPreference(false);
if (success) {
  console.log('Preference saved successfully');
}
```

---

### Function: `observeRubyToggle(callback)`

**Purpose**: RubyfulV2のトグル状態変更を監視し、変更時にコールバックを呼び出す

**Signature**:
```typescript
function observeRubyToggle(
  callback: (isEnabled: boolean) => void
): () => void
```

**Parameters**:
- `callback: (isEnabled: boolean) => void` - 状態変更時に呼ばれるコールバック関数
  - `isEnabled: boolean` - 変更後のルビ表示状態

**Returns**:
- `() => void` - 監視を停止するクリーンアップ関数

**Behavior**:
1. トグルボタン（`.my-toggle`）をDOMから検索
2. トグルボタンが見つかった場合:
   - クリックイベントリスナーを追加
   - リスナー内で100ms待機後、RubyfulV2の状態を取得
   - コールバックに新しい状態を渡して実行
   - ログに "Ruby toggle observer started" を出力
   - クリーンアップ関数を返す（イベントリスナーを削除）
3. トグルボタンが見つからない場合:
   - 警告をログに出力
   - 空のクリーンアップ関数を返す

**Throws**: なし（すべての例外はキャッチされる）

**Side Effects**:
- DOMイベントリスナーの追加
- ログ出力
- コールバック関数の実行（状態変更時）

**Example**:
```typescript
const cleanup = observeRubyToggle((isEnabled) => {
  console.log(`Ruby state changed to: ${isEnabled}`);
  saveRubyPreference(isEnabled);
});

// 監視を停止する場合（通常は不要）
cleanup();
```

**Notes**:
- このフックはuseEffectのクリーンアップ関数として使用できます
- 100msの遅延は、RubyfulV2が内部状態を更新するのを待つために必要です
- `window.RubyfulV2.instance.state.isEnabled`に直接アクセスしているため、RubyfulV2の内部実装に依存しています

---

## Constants

### `RUBY_PREFERENCE_KEY`

**Type**: `string`

**Value**: `'rubyful-display-preference'`

**Purpose**: localStorageのキー名

**Usage**:
```typescript
const value = localStorage.getItem(RUBY_PREFERENCE_KEY);
```

---

### `DEFAULT_RUBY_DISPLAY`

**Type**: `boolean`

**Value**: `true`

**Purpose**: デフォルトのルビ表示状態

**Usage**:
```typescript
const preference = loadRubyPreference() ?? DEFAULT_RUBY_DISPLAY;
```

---

## Type Definitions

### `RubyPreference`

```typescript
/**
 * ルビ表示設定の型
 */
export type RubyPreference = boolean;
```

---

### `RubyPreferenceStorageValue`

```typescript
/**
 * localStorage保存形式の型
 */
export type RubyPreferenceStorageValue = 'true' | 'false';
```

---

## Error Handling

すべての関数はエラーハンドリングを内部で行い、例外をスローしません。

**エラーケース**:
1. **localStorage使用不可**: デフォルト値を返す、警告をログ出力
2. **不正な値**: デフォルト値を返す、警告をログ出力
3. **読み込み/書き込み失敗**: デフォルト値を返す、エラーをログ出力
4. **トグルボタンが見つからない**: 空のクリーンアップ関数を返す、警告をログ出力

---

## Logging

すべてのログは`@/utils/logger`を使用して出力されます。

**ログレベル**:
- `logger.log()`: 正常な操作（保存成功、監視開始など）
- `logger.warn()`: 警告（localStorage使用不可、不正な値など）
- `logger.error()`: エラー（読み込み/書き込み失敗など）

---

## Testing Contract

### Unit Test Requirements

各関数は以下のテストケースを満たす必要があります：

#### `isLocalStorageAvailable()`
- ✓ localStorage が使用可能な場合は true を返すこと
- ✓ localStorage が使用不可の場合は false を返すこと

#### `loadRubyPreference()`
- ✓ localStorage に設定がない場合はデフォルト値を返すこと
- ✓ localStorage に "true" が保存されている場合は true を返すこと
- ✓ localStorage に "false" が保存されている場合は false を返すこと
- ✓ localStorage に不正な値が保存されている場合はデフォルト値を返すこと
- ✓ localStorage が使用不可の場合はデフォルト値を返すこと

#### `saveRubyPreference()`
- ✓ true を保存できること
- ✓ false を保存できること
- ✓ localStorage が使用不可の場合は false を返すこと
- ✓ 保存失敗時は false を返すこと

#### `observeRubyToggle()`
- ✓ トグルボタンが見つかった場合、イベントリスナーを追加すること
- ✓ トグルボタンクリック時にコールバックが呼ばれること
- ✓ クリーンアップ関数でイベントリスナーが削除されること
- ✓ トグルボタンが見つからない場合、空のクリーンアップ関数を返すこと

---

## Version History

**v1.0.0** (2026-02-04)
- 初回リリース
- 基本的なlocalStorage操作とトグル状態監視機能
