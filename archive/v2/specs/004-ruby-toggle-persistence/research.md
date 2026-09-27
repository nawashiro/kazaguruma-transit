# Research: ふりがな（ルビ）表示トグルの永続化

**Feature**: 004-ruby-toggle-persistence
**Date**: 2026-02-04
**Phase**: 0 - Research & Technical Investigation

## Overview

この文書は、ルビ表示設定の永続化機能を実装するために行った技術調査の結果をまとめたものです。

## Research Findings

### 1. RubyfulV2ライブラリの制約調査

**調査目的**: RubyfulV2ライブラリのAPI仕様を理解し、localStorage連携の可能性を評価する

**調査方法**: WebFetchでライブラリのソースコードを取得し、API仕様とイベント機構を分析

**調査結果**:

#### API仕様
- **初期化**: `RubyfulV2.init(config)` - 設定オブジェクトを受け取る
- **設定オプション**:
  - `selector`: 処理対象要素のCSSセレクタ（必須）
  - `defaultDisplay`: ルビ表示の初期状態（true/false）
  - `observeChanges`: DOM変更監視の有効化（オプション）
  - `styles`: カスタムスタイル設定（トグルボタンテキスト含む）

#### 制約事項
1. **localStorage連携機能が存在しない**
   - 状態管理は`this.state`オブジェクト内のメモリのみ
   - ページリロード時に初期値（`defaultDisplay`）にリセットされる

2. **状態変更コールバック機構がない**
   - トグルボタンは`toggleRuby()`メソッドを呼び出すが、外部イベントは発火しない
   - 状態変更を外部から検知する仕組みがない

3. **状態へのアクセス**
   - `RubyfulV2.instance.state.isEnabled` で現在の状態を取得可能
   - ただし、これは内部実装であり、公式APIではない

**設計への影響**:
- localStorage操作は完全に独自実装が必要
- トグル状態の変更検知には、DOMイベント監視またはMutationObserverを使用する必要がある
- RubyfulV2初期化時に`defaultDisplay`オプションでlocalStorageの値を渡す

**Decision**: RubyfulV2を変更せず、ラッパー層で永続化機能を実装する

**Rationale**:
- RubyfulV2は外部CDNから読み込まれており、変更不可
- ライブラリのアップデート時に互換性を保つため、内部実装に依存しない設計が望ましい

**Alternatives Considered**:
- RubyfulV2をフォークして機能追加：メンテナンスコストが高い、却下
- サーバーサイドで設定を保存：認証が必要になり過剰、却下

---

### 2. localStorage使用のベストプラクティス

**調査目的**: localStorage使用時のエラーハンドリングとフォールバック戦略を確立する

**調査方法**: Web Storage APIのMDNドキュメント、TypeScriptベストプラクティスの調査

**調査結果**:

#### localStorage使用不可の状況
1. **プライベートブラウジングモード**（Safari, Firefox）
   - `localStorage.setItem()`が例外をスローする
   - 一部のブラウザではアクセス可能だが容量が0

2. **古いブラウザ**（IE10以前）
   - `localStorage`オブジェクト自体が存在しない

3. **ユーザーによる無効化**
   - ブラウザ設定でCookieとストレージが無効化されている

4. **容量超過**（5MBの制限）
   - 他のサイトデータで容量が埋まっている場合

#### ベストプラクティス

**1. 使用可能性の検証**
```typescript
function isLocalStorageAvailable(): boolean {
  try {
    const test = '__localStorage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (e) {
    return false;
  }
}
```

**2. 型安全なlocalStorage操作**
```typescript
function loadRubyPreference(): boolean {
  if (!isLocalStorageAvailable()) {
    return true; // デフォルト値
  }
  try {
    const stored = localStorage.getItem('rubyful-display-preference');
    if (stored === null) return true; // 初回アクセス
    return stored === 'true';
  } catch (error) {
    console.error('Failed to load ruby preference:', error);
    return true;
  }
}
```

**3. エラーハンドリング**
- すべてのlocalStorage操作をtry-catchで保護
- エラー時はコンソールにログを出力し、デフォルト値を使用
- ユーザーには目に見えるエラーを表示しない（UX重視）

**設計への影響**:
- すべてのlocalStorage操作関数は、使用可能性チェックとエラーハンドリングを含む
- デフォルト値（true）を一貫して使用
- 不正な値（"true"/"false"以外）はデフォルト値にフォールバック

**Decision**: localStorage使用不可時は常にデフォルト値（ルビ表示オン）を使用

**Rationale**:
- 初回ユーザーへのデフォルト体験を一貫させる
- エラー状態でもアプリケーションは動作し続ける（graceful degradation）

**Alternatives Considered**:
- sessionStorageを使用：ブラウザ再起動で消えるため不適切、却下
- Cookieを使用：容量が小さく、HTTP通信に含まれるためオーバーヘッドが大きい、却下

---

### 3. Next.js 15でのクライアントサイド初期化パターン

**調査目的**: Next.js 15のApp Routerでクライアントサイドのみで動作するコードの実装パターンを確認

**調査方法**: Next.js 15公式ドキュメント、既存コードベース（SidebarLayout.tsx）の分析

**調査結果**:

#### 既存実装の分析（SidebarLayout.tsx）

現在の実装:
```typescript
<Script
  src="https://rubyful-v2.s3.ap-northeast-1.amazonaws.com/v2/rubyful.js?t=20250507022654"
  strategy="afterInteractive"
  onLoad={() => {
    (window as any).RubyfulV2?.init({
      selector: ".ruby-text",
      defaultDisplay: true, // ← ここが常にtrue
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
/>
```

#### 問題点
- `defaultDisplay: true` がハードコードされている
- トグル状態の変更を検知する仕組みがない

#### 推奨パターン

**Script onLoadコールバック内で初期化**
```typescript
<Script
  src="..."
  strategy="afterInteractive"
  onLoad={() => {
    const savedPreference = loadRubyPreference(); // localStorageから読み込み

    (window as any).RubyfulV2?.init({
      selector: ".ruby-text",
      defaultDisplay: savedPreference, // ← 保存された値を使用
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
    const cleanup = observeRubyToggle((newState) => {
      saveRubyPreference(newState);
    });

    // クリーンアップは不要（ページ遷移で自動的にクリーンアップされる）
    logger.log("Rubyful v2 loaded with saved preference");
  }}
/>
```

**設計への影響**:
- useEffectは不要（Script onLoadで十分）
- windowオブジェクトへのアクセスは`typeof window !== 'undefined'`でガード不要（onLoadは必ずクライアントサイド）
- クリーンアップ関数は保持する必要があるが、ページ遷移時に自動的にクリーンアップされる

**Decision**: Script onLoadコールバック内で初期化とイベント監視を設定

**Rationale**:
- RubyfulV2のロード完了を確実に待つことができる
- 既存パターンとの一貫性を保つ
- コードの複雑性を最小限に抑える

**Alternatives Considered**:
- useEffectで初期化：RubyfulV2のロードタイミングが不確実、却下
- 別のuseEffectで監視開始：useEffectの依存配列管理が複雑になる、却下

---

### 4. トグル状態変更の検知方法

**調査目的**: RubyfulV2のトグル状態が変更されたタイミングを検知する最適な方法を特定

**調査方法**: DOM APIの調査、MutationObserver、イベントリスナーパターンの比較

**調査結果**:

#### Option 1: MutationObserver

**概要**: DOMの変更を監視し、ルビ要素の追加/削除を検知

**実装例**:
```typescript
const observer = new MutationObserver((mutations) => {
  // ルビ要素の変更を検知
  const isEnabled = document.querySelectorAll('ruby, rt').length > 0;
  callback(isEnabled);
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});
```

**メリット**:
- 確実にルビの表示/非表示を検知できる

**デメリット**:
- パフォーマンスへの影響が大きい（document.body全体を監視）
- ルビ以外のDOM変更でも発火する可能性
- 複雑性が高い

#### Option 2: トグルボタンのクリックイベント監視（推奨）

**概要**: トグルボタンに直接クリックイベントリスナーを追加

**実装例**:
```typescript
function observeRubyToggle(callback: (isEnabled: boolean) => void): () => void {
  const handleClick = () => {
    // RubyfulV2が状態を更新した後に実行
    setTimeout(() => {
      const currentState = (window as any).RubyfulV2?.instance?.state?.isEnabled ?? true;
      callback(currentState);
    }, 100);
  };

  // トグルボタンを取得してイベントリスナーを追加
  const toggleButton = document.querySelector('.my-toggle');
  if (toggleButton) {
    toggleButton.addEventListener('click', handleClick);
    return () => toggleButton.removeEventListener('click', handleClick);
  }

  return () => {}; // cleanup関数
}
```

**メリット**:
- シンプルで理解しやすい
- パフォーマンスへの影響が最小限
- トグルボタンの存在を確認できる

**デメリット**:
- RubyfulV2の内部状態に依存（`instance.state.isEnabled`）
- setTimeoutによる遅延が必要（RubyfulV2の状態更新を待つ）

#### Option 3: カスタムイベントの使用

**概要**: RubyfulV2のコードを変更し、カスタムイベントを発火させる

**メリット**:
- クリーンなAPIデザイン

**デメリット**:
- RubyfulV2の変更が必要（不可能）
- 却下

**設計への影響**:
- トグルボタンのクリックイベント監視を採用
- 100msの遅延を設けてRubyfulV2の状態更新を待つ
- イベントリスナーのクリーンアップ関数を提供

**Decision**: トグルボタンのクリックイベント監視を採用

**Rationale**:
- シンプルで理解しやすい実装
- パフォーマンスへの影響が最小限
- 既存のトグルボタン実装（`.my-toggle`クラス）を活用できる

**Alternatives Considered**:
- MutationObserver：複雑性が高くパフォーマンスへの影響が大きい、却下
- カスタムイベント：RubyfulV2の変更が必要で不可能、却下

---

## Research Summary

すべての技術調査が完了しました。以下の主要な決定事項があります：

### 主要な決定

1. **RubyfulV2の制約**
   - localStorage連携機能がないため、独自実装が必要
   - 状態変更コールバック機構がないため、DOMイベント監視を使用

2. **状態検知方法**
   - トグルボタンのクリックイベント監視が最適
   - 100msの遅延でRubyfulV2の状態更新を待つ

3. **localStorage操作**
   - try-catchでの保護とフォールバック処理が必須
   - 使用不可時はデフォルト値（true）を使用

4. **初期化タイミング**
   - Script onLoadコールバック内で初期化とイベント監視を設定
   - useEffectは不要

### 技術スタック

- **クライアントサイド**: TypeScript 5 (strict mode), React 19, Next.js 15
- **ストレージ**: Web Storage API (localStorage)
- **外部ライブラリ**: RubyfulV2 (変更不可)
- **テスト**: Jest + React Testing Library

### 次のステップ

Phase 1のデザインフェーズに進み、以下を作成：
1. data-model.md - データモデルの定義
2. contracts/ - クライアントサイドAPI契約
3. quickstart.md - 開発者向けクイックスタートガイド
