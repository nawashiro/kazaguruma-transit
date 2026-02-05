# Quick Start: ふりがな（ルビ）表示トグルの永続化

**Feature**: 004-ruby-toggle-persistence
**Date**: 2026-02-04
**Phase**: 1 - Design & Contracts

## Overview

このドキュメントは、開発者がこの機能を理解し、実装を開始するためのクイックスタートガイドです。

## Prerequisites

- TypeScript 5の基礎知識
- React 19とNext.js 15の基本的な理解
- localStorage APIの基礎知識
- Jestとテスト駆動開発（TDD）の経験

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    SidebarLayout.tsx                     │
│  (RubyfulV2初期化 + トグル状態監視の開始)                │
└────────────┬────────────────────────────┬───────────────┘
             │                            │
             │ import                     │ import
             ▼                            ▼
┌──────────────────────┐      ┌──────────────────────────┐
│  ruby-preference.ts  │      │  RubyfulV2 (外部CDN)     │
│  ・loadRubyPreference│      │  ・init()                │
│  ・saveRubyPreference│◀─────│  ・instance.state        │
│  ・observeRubyToggle │      │  ・toggleRuby()          │
└──────────┬───────────┘      └──────────────────────────┘
           │
           │ read/write
           ▼
┌──────────────────────┐
│   localStorage       │
│   [rubyful-display-  │
│    preference]       │
└──────────────────────┘
```

## Key Components

### 1. Ruby Preference Service (`src/lib/preferences/ruby-preference.ts`)

localStorage操作とトグル状態監視を担当するサービス層。

**主要な関数**:
- `loadRubyPreference()` - localStorageから設定を読み込む
- `saveRubyPreference(isEnabled)` - localStorageに設定を保存する
- `isLocalStorageAvailable()` - localStorage使用可能性をチェック
- `observeRubyToggle(callback)` - トグル状態変更を監視

### 2. SidebarLayout Component (`src/components/layouts/SidebarLayout.tsx`)

RubyfulV2の初期化と永続化サービスの連携を担当するレイアウトコンポーネント。

**変更箇所**:
- Script onLoadコールバック内で`loadRubyPreference()`を呼び出す
- RubyfulV2.init()の`defaultDisplay`に保存された値を使用
- `observeRubyToggle()`でトグル状態変更を監視し、`saveRubyPreference()`を呼び出す

## Step-by-Step Implementation Guide

### Step 1: 環境準備

```bash
# ブランチの確認
git branch  # 004-ruby-toggle-persistence にいることを確認

# 依存関係のインストール（必要に応じて）
npm install
```

### Step 2: ディレクトリ構造の作成

```bash
# preferencesディレクトリの作成
mkdir -p src/lib/preferences
mkdir -p src/lib/preferences/__tests__
```

### Step 3: テストファーストで開発開始

TDD原則に従い、まずテストを書きます。

**3.1. テストファイルの作成**

`src/lib/preferences/__tests__/ruby-preference.test.ts`

```typescript
import {
  loadRubyPreference,
  saveRubyPreference,
  isLocalStorageAvailable,
  RUBY_PREFERENCE_KEY,
  DEFAULT_RUBY_DISPLAY,
} from '../ruby-preference';

describe('Ruby Preference Service', () => {
  beforeEach(() => {
    // 各テストの前にlocalStorageをクリア
    localStorage.clear();
  });

  describe('isLocalStorageAvailable', () => {
    it('localStorage が使用可能な場合は true を返すこと', () => {
      expect(isLocalStorageAvailable()).toBe(true);
    });
  });

  describe('loadRubyPreference', () => {
    it('localStorage に設定がない場合はデフォルト値を返すこと', () => {
      expect(loadRubyPreference()).toBe(DEFAULT_RUBY_DISPLAY);
    });

    it('localStorage に "true" が保存されている場合は true を返すこと', () => {
      localStorage.setItem(RUBY_PREFERENCE_KEY, 'true');
      expect(loadRubyPreference()).toBe(true);
    });

    it('localStorage に "false" が保存されている場合は false を返すこと', () => {
      localStorage.setItem(RUBY_PREFERENCE_KEY, 'false');
      expect(loadRubyPreference()).toBe(false);
    });

    it('localStorage に不正な値が保存されている場合はデフォルト値を返すこと', () => {
      localStorage.setItem(RUBY_PREFERENCE_KEY, 'invalid');
      expect(loadRubyPreference()).toBe(DEFAULT_RUBY_DISPLAY);
    });
  });

  describe('saveRubyPreference', () => {
    it('true を保存できること', () => {
      const result = saveRubyPreference(true);
      expect(result).toBe(true);
      expect(localStorage.getItem(RUBY_PREFERENCE_KEY)).toBe('true');
    });

    it('false を保存できること', () => {
      const result = saveRubyPreference(false);
      expect(result).toBe(true);
      expect(localStorage.getItem(RUBY_PREFERENCE_KEY)).toBe('false');
    });
  });
});
```

**3.2. テストの実行**

```bash
npm test ruby-preference.test.ts
```

この時点ではテストが失敗します（Red）。これは期待通りです。

### Step 4: 実装

**4.1. サービスの実装**

`src/lib/preferences/ruby-preference.ts`

```typescript
import { logger } from '@/utils/logger';

/**
 * localStorageのキー名
 */
export const RUBY_PREFERENCE_KEY = 'rubyful-display-preference' as const;

/**
 * デフォルト設定値（ルビ表示オン）
 */
export const DEFAULT_RUBY_DISPLAY = true as const;

/**
 * localStorageが使用可能かチェックする
 * @returns {boolean} localStorageが使用可能な場合はtrue
 */
export function isLocalStorageAvailable(): boolean {
  try {
    const test = '__localStorage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * ルビ表示設定を読み込む
 * @returns {boolean} 保存された設定、または存在しない場合はデフォルト値（true）
 */
export function loadRubyPreference(): boolean {
  if (!isLocalStorageAvailable()) {
    logger.warn('localStorage is not available, using default value');
    return DEFAULT_RUBY_DISPLAY;
  }

  try {
    const stored = localStorage.getItem(RUBY_PREFERENCE_KEY);
    if (stored === null) {
      return DEFAULT_RUBY_DISPLAY; // 初回アクセス
    }
    if (stored !== 'true' && stored !== 'false') {
      logger.warn(`Invalid ruby preference value: ${stored}, using default`);
      return DEFAULT_RUBY_DISPLAY;
    }
    return stored === 'true';
  } catch (error) {
    logger.error('Failed to load ruby preference:', error);
    return DEFAULT_RUBY_DISPLAY;
  }
}

/**
 * ルビ表示設定を保存する
 * @param {boolean} isEnabled - ルビ表示の有効/無効
 * @returns {boolean} 保存に成功したかどうか
 */
export function saveRubyPreference(isEnabled: boolean): boolean {
  if (!isLocalStorageAvailable()) {
    logger.warn('localStorage is not available, cannot save preference');
    return false;
  }

  try {
    localStorage.setItem(RUBY_PREFERENCE_KEY, String(isEnabled));
    logger.log(`Ruby preference saved: ${isEnabled}`);
    return true;
  } catch (error) {
    logger.error('Failed to save ruby preference:', error);
    return false;
  }
}

/**
 * RubyfulV2のトグル状態変更を監視する
 * @param {(isEnabled: boolean) => void} callback - 状態変更時に呼ばれるコールバック
 * @returns {() => void} 監視を停止するクリーンアップ関数
 */
export function observeRubyToggle(
  callback: (isEnabled: boolean) => void
): () => void {
  const handleClick = () => {
    // RubyfulV2が状態を更新した後に実行
    setTimeout(() => {
      const currentState =
        (window as any).RubyfulV2?.instance?.state?.isEnabled ?? DEFAULT_RUBY_DISPLAY;
      callback(currentState);
    }, 100);
  };

  // トグルボタンを取得してイベントリスナーを追加
  const toggleButton = document.querySelector('.my-toggle');
  if (toggleButton) {
    toggleButton.addEventListener('click', handleClick);
    logger.log('Ruby toggle observer started');
    return () => {
      toggleButton.removeEventListener('click', handleClick);
      logger.log('Ruby toggle observer stopped');
    };
  }

  logger.warn('Ruby toggle button not found, observer not started');
  return () => {}; // cleanup関数
}
```

**4.2. テストの再実行**

```bash
npm test ruby-preference.test.ts
```

すべてのテストが通ることを確認します（Green）。

### Step 5: SidebarLayoutの修正

`src/components/layouts/SidebarLayout.tsx`

**変更前**:
```typescript
onLoad={() => {
  (window as any).RubyfulV2?.init({
    selector: ".ruby-text",
    defaultDisplay: true,  // ← 常にtrue
    observeChanges: true,
    styles: {
      toggleButtonClass: "my-toggle",
      toggleButtonText: {
        on: "ルビ ON",
        off: "ルビ OFF",
      },
    },
  });

  logger.log("Rubyful v2 loaded");
}}
```

**変更後**:
```typescript
import { loadRubyPreference, saveRubyPreference, observeRubyToggle } from '@/lib/preferences/ruby-preference';

// ... (その他のコードは変更なし)

onLoad={() => {
  // localStorageから設定を読み込む
  const savedPreference = loadRubyPreference();

  (window as any).RubyfulV2?.init({
    selector: ".ruby-text",
    defaultDisplay: savedPreference,  // ← 保存された値を使用
    observeChanges: true,
    styles: {
      toggleButtonClass: "my-toggle",
      toggleButtonText: {
        on: "ルビ ON",
        off: "ルビ OFF",
      },
    },
  });

  // トグル状態変更の監視を開始
  observeRubyToggle((newState) => {
    saveRubyPreference(newState);
  });

  logger.log("Rubyful v2 loaded with saved preference");
}}
```

### Step 6: テストの実行

```bash
# TypeScript型チェック
npx tsc --noEmit

# ESLint
npm run lint

# すべてのテスト
npm test

# ビルド確認
npm run build
```

すべてが成功することを確認します。

### Step 7: 手動テスト

1. **開発サーバーの起動**
   ```bash
   npm run dev
   ```

2. **ブラウザでテスト**
   - http://localhost:3000 にアクセス
   - ルビトグルボタンをクリックしてオフにする
   - ページをリロード
   - ルビがオフのままであることを確認 ✓

3. **プライベートブラウジングモードでテスト**
   - プライベートウィンドウで http://localhost:3000 にアクセス
   - デフォルトでルビがオンになっていることを確認 ✓
   - トグルボタンをクリックしてオフにする
   - ページをリロード
   - （一部のブラウザでは）設定が保持されないことを確認（期待通り） ✓

4. **異なるページ間での設定共有**
   - ホームページでルビをオフにする
   - /locations ページに遷移
   - ルビがオフのままであることを確認 ✓

## Testing Strategy

### Unit Tests

`src/lib/preferences/__tests__/ruby-preference.test.ts`

**テスト対象**:
- `isLocalStorageAvailable()`
- `loadRubyPreference()`
- `saveRubyPreference()`
- `observeRubyToggle()`（DOM操作を含むため、統合テストでも検証）

**モック**:
- localStorage（jest-localstorage-mockを使用）

### Integration Tests

`src/__tests__/components/layouts/SidebarLayout.test.tsx`

**テスト対象**:
- RubyfulV2の初期化時にlocalStorageの値が使用されること
- トグルボタンクリック時にlocalStorageに保存されること

**モック**:
- RubyfulV2（windowオブジェクトにモックを追加）
- localStorage

### E2E Tests（手動）

実際のブラウザでの動作確認:
- ページリロード後の設定保持
- プライベートブラウジングモードでの動作
- 異なるページ間での設定共有

## Common Issues & Troubleshooting

### Issue 1: テストでlocalStorageが未定義

**症状**: `ReferenceError: localStorage is not defined`

**原因**: Jestのテスト環境にlocalStorageが存在しない

**解決策**:
```bash
npm install --save-dev jest-localstorage-mock
```

`jest.config.js`:
```javascript
module.exports = {
  setupFiles: ['jest-localstorage-mock'],
  // ... その他の設定
};
```

### Issue 2: RubyfulV2が未定義でテストが失敗

**症状**: `TypeError: Cannot read property 'init' of undefined`

**原因**: テスト環境にRubyfulV2が存在しない

**解決策**: テストでRubyfulV2をモック

```typescript
beforeEach(() => {
  (window as any).RubyfulV2 = {
    init: jest.fn(),
    instance: {
      state: {
        isEnabled: true,
      },
    },
  };
});
```

### Issue 3: トグル状態が保存されない

**症状**: ページリロード後にルビ設定が常にオンになる

**原因**:
- localStorageが使用できない環境
- トグルボタンが見つからない
- イベントリスナーが正しく追加されていない

**デバッグ手順**:
1. ブラウザのコンソールで `localStorage.getItem('rubyful-display-preference')` を確認
2. コンソールログで "Ruby toggle observer started" が表示されているか確認
3. トグルボタンをクリックして "Ruby preference saved: false" が表示されるか確認

## Performance Monitoring

### 測定ポイント

1. **localStorage読み込み時間**
   ```typescript
   const start = performance.now();
   const preference = loadRubyPreference();
   const end = performance.now();
   logger.log(`loadRubyPreference took ${end - start}ms`);
   ```

2. **トグル操作の応答時間**
   - クリックからlocalStorage保存までの時間
   - 目標: 200ms以内

### パフォーマンス目標

- localStorage読み込み: < 1ms
- localStorage書き込み: < 1ms
- トグル操作全体: < 200ms（RubyfulV2の状態更新時間を含む）

## Next Steps

1. **タスク生成**: `/speckit.tasks` コマンドで `tasks.md` を生成
2. **実装**: タスクを優先順位順に実装
3. **レビュー**: コードレビューで憲章への準拠を確認
4. **PR作成**: すべてのテストが通ったらPRを作成

## Additional Resources

- [Web Storage API - MDN](https://developer.mozilla.org/ja/docs/Web/API/Web_Storage_API)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Jest Testing Best Practices](https://jestjs.io/docs/getting-started)
- [CLAUDE.md](../../CLAUDE.md) - プロジェクト固有の開発ガイドライン
- [.specify/memory/constitution.md](../../.specify/memory/constitution.md) - 開発憲章
