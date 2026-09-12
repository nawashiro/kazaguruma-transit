# Implementation Plan: ふりがな（ルビ）表示トグルの永続化

**Branch**: `004-ruby-toggle-persistence` | **Date**: 2026-02-04 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-ruby-toggle-persistence/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

ユーザーがふりがな（ルビ）表示のトグルボタンを操作したときの設定をブラウザのlocalStorageに永続化し、ページ再読み込みやブラウザ再起動後も同じ設定が維持されるようにする。RubyfulV2ライブラリの初期化時に保存された設定を読み込み、トグル操作時に設定を保存する仕組みを実装する。

## Technical Context

**Language/Version**: TypeScript 5 (strict mode)
**Primary Dependencies**: React 19, Next.js 15 (App Router), RubyfulV2 (外部CDNライブラリ)
**Storage**: ブラウザのlocalStorage (Web Storage API)
**Testing**: Jest + React Testing Library
**Target Platform**: Web (モダンブラウザ - localStorage API対応必須)
**Project Type**: Web アプリケーション (Next.js)
**Performance Goals**: トグル状態の変更は即座に反映され、localStorage読み書きは50ms以内
**Constraints**:
- RubyfulV2ライブラリは外部CDNから読み込まれ、変更不可
- RubyfulV2にはlocalStorage連携機能が存在しない
- RubyfulV2には状態変更コールバック機構がない
- DOM監視でトグル状態の変更を検知する必要がある
**Scale/Scope**: 単一の設定値（boolean）の永続化、影響範囲は全ページ

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

この機能は `.specify/memory/constitution.md` の原則に準拠していることを確認してください:

### 必須チェック項目

- [x] **明確な命名**: `RubyPreferenceService`, `saveRubyPreference()`, `loadRubyPreference()` など意図が明確な命名を使用
- [x] **シンプルなロジック**: localStorage操作とRubyfulV2初期化は独立した関数に分解される
- [x] **構造化された整理**: `src/lib/preferences/ruby-preference.ts` に配置し、サービス層として実装
- [x] **型安全性**: boolean型の設定値を厳密に型定義、`any`は使用しない
- [x] **テスト駆動開発**: localStorage操作、初期化ロジック、エラーハンドリングの各テストを先に作成
- [x] **アクセシビリティ**: UIコンポーネントの変更なし（既存のRubyfulV2トグルボタンを使用）
- [x] **適切なコメント**: localStorage使用の理由、RubyfulV2制約の説明、エラーハンドリングの意図を記述

### 技術制約チェック

- [x] **パフォーマンス**: localStorage操作は同期的で高速（50ms以内）、API応答時間への影響なし
- [x] **データベース**: データベース使用なし（クライアントサイドのみ）
- [x] **Nostr統合**: Nostr機能には影響なし

### コミット前チェックリスト遵守

実装完了時に以下がすべて成功することを確認する計画があるか?
- [x] `npx tsc --noEmit` - TypeScript型チェック
- [x] `npm run lint` - ESLint
- [x] `npm test` - Jestテスト
- [x] `npm run build` - ビルド確認

## Project Structure

### Documentation (this feature)

```text
specs/004-ruby-toggle-persistence/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── lib/
│   └── preferences/
│       ├── ruby-preference.ts       # ルビ表示設定の永続化サービス
│       └── __tests__/
│           └── ruby-preference.test.ts  # ユニットテスト
├── components/
│   └── layouts/
│       └── SidebarLayout.tsx        # RubyfulV2初期化コード（変更対象）
└── __tests__/
    └── components/
        └── layouts/
            └── SidebarLayout.test.tsx   # 統合テスト

```

**Structure Decision**:
- 永続化ロジックは `src/lib/preferences/` に新規作成し、サービス層として独立させる
- `SidebarLayout.tsx` は既存のRubyfulV2初期化コードを修正し、永続化サービスと連携する
- テストは各モジュールの `__tests__/` ディレクトリに配置する

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

この機能には憲章違反はありません。すべてのチェック項目が合格しています。

## Phase 0: Research & Technical Investigation

### Research Tasks

#### R1: RubyfulV2ライブラリの制約調査 ✅

**調査内容**:
- RubyfulV2のAPI仕様とイベント機構
- トグル状態変更の検知方法
- localStorage連携機能の有無

**調査結果** (WebFetchで完了):
- RubyfulV2にはlocalStorage連携機能が存在しない
- 状態変更コールバック機構がない
- `RubyfulV2.instance.state.isEnabled`で現在の状態を取得可能
- トグルボタンは`toggleRuby()`メソッドを呼び出す
- DOM監視（MutationObserver）でトグル状態の変更を検知する必要がある

**設計への影響**:
- localStorage操作は独自実装が必要
- トグル状態の変更検知にMutationObserverまたはDOMイベントリスナーを使用
- RubyfulV2初期化時に`defaultDisplay`オプションでlocalStorageの値を適用

#### R2: localStorage使用のベストプラクティス

**調査内容**:
- localStorage使用不可環境のフォールバック戦略
- プライベートブラウジングモードでのlocalStorageの挙動
- 型安全なlocalStorage操作パターン

**ベストプラクティス**:
```typescript
// localStorage使用可能性の検証
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

// 型安全なlocalStorage操作
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

**設計への影響**:
- すべてのlocalStorage操作をtry-catchで保護
- localStorage使用不可の場合はデフォルト値（true）を使用
- 不正な値はデフォルト値にフォールバック

#### R3: Next.js 15でのクライアントサイド初期化パターン

**調査内容**:
- `"use client"`コンポーネントでのuseEffectフック使用
- Script onLoadコールバックのタイミング
- グローバルwindowオブジェクトへのアクセスパターン

**ベストプラクティス**:
```typescript
// SidebarLayout.tsx での初期化パターン
useEffect(() => {
  // RubyfulV2がロードされているか確認
  if (typeof window !== 'undefined' && (window as any).RubyfulV2) {
    const savedPreference = loadRubyPreference();

    (window as any).RubyfulV2.init({
      selector: '.ruby-text',
      defaultDisplay: savedPreference, // localStorageから読み込んだ値
      observeChanges: true,
      styles: {
        toggleButtonClass: 'my-toggle',
        toggleButtonText: {
          on: 'ルビ ON',
          off: 'ルビ OFF',
        },
      },
    });

    // トグル状態変更の監視を開始
    observeRubyToggle((newState) => {
      saveRubyPreference(newState);
    });
  }
}, []);
```

**設計への影響**:
- `SidebarLayout.tsx`の`Script onLoad`コールバックで初期化処理を実行
- useEffectフックは使用しない（Script onLoadで十分）
- トグル状態監視の開始も同じコールバック内で行う

#### R4: トグル状態変更の検知方法

**調査内容**:
- MutationObserverでのDOM変更監視
- トグルボタンのクリックイベント監視
- RubyfulV2内部状態の変更検知

**推奨アプローチ**:
```typescript
// トグルボタンのクリックイベントを監視
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

**設計への影響**:
- トグルボタンのクリックイベントにリスナーを追加
- RubyfulV2の状態更新後に少し遅延させてから状態を取得
- useEffectのクリーンアップ関数でイベントリスナーを削除

### Research Summary

すべての技術調査が完了しました。主要な発見:

1. **RubyfulV2の制約**: localStorage連携機能がないため、独自実装が必要
2. **状態検知**: トグルボタンのクリックイベント監視が最も確実な方法
3. **localStorage操作**: try-catchでの保護とフォールバック処理が必須
4. **初期化タイミング**: Script onLoadコールバック内で初期化とイベント監視を設定

## Phase 1: Design & Contracts

### Data Model

[data-model.md](./data-model.md) を参照

### API Contracts

この機能はクライアントサイドのみで完結するため、サーバーAPIは不要です。

代わりに、クライアントサイドの公開関数インターフェースを定義します:

#### Ruby Preference Service API

```typescript
/**
 * ルビ表示設定の永続化サービス
 * @module ruby-preference
 */

/**
 * ルビ表示設定を読み込む
 * @returns {boolean} 保存された設定、または存在しない場合はデフォルト値（true）
 */
export function loadRubyPreference(): boolean;

/**
 * ルビ表示設定を保存する
 * @param {boolean} isEnabled - ルビ表示の有効/無効
 * @returns {boolean} 保存に成功したかどうか
 */
export function saveRubyPreference(isEnabled: boolean): boolean;

/**
 * localStorageが使用可能かチェックする
 * @returns {boolean} localStorageが使用可能な場合はtrue
 */
export function isLocalStorageAvailable(): boolean;

/**
 * RubyfulV2のトグル状態変更を監視する
 * @param {(isEnabled: boolean) => void} callback - 状態変更時に呼ばれるコールバック
 * @returns {() => void} 監視を停止するクリーンアップ関数
 */
export function observeRubyToggle(callback: (isEnabled: boolean) => void): () => void;
```

**型定義**:

```typescript
/**
 * localStorageのキー名
 */
export const RUBY_PREFERENCE_KEY = 'rubyful-display-preference' as const;

/**
 * デフォルト設定値（ルビ表示オン）
 */
export const DEFAULT_RUBY_DISPLAY = true as const;
```

### Quick Start

[quickstart.md](./quickstart.md) を参照

## Phase 2: Task Generation

このフェーズは `/speckit.tasks` コマンドで実行されます。
`tasks.md` はこのコマンドで生成されます。

## Implementation Notes

### Critical Path

1. **localStorage操作サービスの作成** (最優先)
   - `src/lib/preferences/ruby-preference.ts`
   - テストファースト開発

2. **SidebarLayoutの修正**
   - RubyfulV2初期化時にlocalStorageから設定を読み込む
   - トグル状態変更の監視を開始

3. **統合テスト**
   - 実際のブラウザ環境でのテスト
   - localStorage操作の検証

### Risk Mitigation

**リスク1: RubyfulV2が未ロード**
- 対策: `typeof window !== 'undefined' && (window as any).RubyfulV2` で確認
- フォールバック: RubyfulV2が存在しない場合は何もしない

**リスク2: localStorage使用不可**
- 対策: `isLocalStorageAvailable()` で事前チェック
- フォールバック: デフォルト値（true）を使用

**リスク3: トグルボタンが見つからない**
- 対策: `document.querySelector()`の結果をnullチェック
- フォールバック: イベントリスナーを追加せず、初期化のみ実行

### Testing Strategy

1. **ユニットテスト** (`ruby-preference.test.ts`)
   - localStorage操作の各関数
   - エラーハンドリング
   - フォールバック動作

2. **統合テスト** (`SidebarLayout.test.tsx`)
   - RubyfulV2との連携
   - 初期化フロー
   - トグル状態の永続化

3. **手動テスト**
   - 実際のブラウザでのページリロード
   - プライベートブラウジングモードでの動作確認
   - 異なるページ間での設定共有

## Constitution Re-Check (Post-Design)

Phase 1完了後、再度憲章への準拠を確認:

### 設計レビュー

- [x] **明確な命名**: すべての関数名、変数名が意図を明確に表現している
- [x] **シンプルなロジック**: 各関数は単一責任の原則に従っている
- [x] **構造化された整理**: `src/lib/preferences/` という明確なディレクトリ構造
- [x] **型安全性**: すべての関数に型定義があり、`any`の使用を最小限に抑えている
- [x] **テスト駆動開発**: すべてのロジックにテストケースが定義されている
- [x] **アクセシビリティ**: UIコンポーネントの変更なし、既存のアクセシビリティを維持
- [x] **適切なコメント**: 各関数にJSDocコメント、制約や理由を説明するコメント

### 複雑性の評価

この実装には不必要な複雑性は含まれていません。すべての設計決定は仕様要件とRubyfulV2の制約から導かれています。

## Next Steps

1. `/speckit.tasks` コマンドで `tasks.md` を生成
2. タスクを優先順位順に実装
3. 各タスク完了時にコミット前チェックリストを実行
4. すべてのテストが通ることを確認してPR作成
