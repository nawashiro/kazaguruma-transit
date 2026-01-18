# Implementation Plan: 監査ページのヘッダー要素レイアウト移動

**Branch**: `001-audit-header-layout` | **Date**: 2026-01-15 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-audit-header-layout/spec.md`

## Summary

会話詳細ページと監査ページで共通表示されるべきヘッダー要素（戻るリンク、会話タイトル、会話説明）を、メインページからレイアウトコンポーネント（`DiscussionTabLayout`）に移動します。これにより、監査ページでもコンテキスト情報が表示され、コード重複が削減されます。

**技術的アプローチ**:
- `DiscussionTabLayout` にデータ取得ロジックを追加（既存の `audit/page.tsx` のパターンを踏襲）
- `streamDiscussionMeta` を使用したリアルタイムデータ取得
- ローディング状態は段階的表示（タブ+戻るリンク → タイトル+説明）
- メインページと監査ページは独立してデータ取得（Context不要、キャッシュで最適化）

## Technical Context

**Language/Version**: TypeScript 5 (strict モード)
**Primary Dependencies**: Next.js 15 (App Router), React 19, nostr-tools
**Storage**: N/A（Nostrリレーからのストリーミングデータ）
**Testing**: Jest + React Testing Library
**Target Platform**: Web (デスクトップ、タブレット、モバイル)
**Project Type**: Web application (Next.js)
**Performance Goals**:
- レイアウトのデータ取得は3秒以内
- タブ切り替えは即座（<100ms）
- API応答は95パーセンタイルで200ms以内（全体の制約）

**Constraints**:
- WCAG 2.1 AA準拠（タッチターゲット44px×44px、ARIA属性）
- TypeScript strict モード必須、`any` 禁止
- DaisyUI + Tailwind: `rounded-full dark:rounded-sm` パターン
- ruby-text クラスで日本語レンダリング
- テストモード（`isTestMode`）のサポート

**Scale/Scope**:
- 影響範囲: 2ファイル修正（layout.tsx削除部分、page.tsx削除部分）+ 1コンポーネント拡張（DiscussionTabLayout）
- 会話一覧ページは対象外

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

この機能は `.specify/memory/constitution.md` の原則に準拠していることを確認してください:

### 必須チェック項目

- [x] **明確な命名**: 新規作成される変数・関数・コンポーネント名は意図が明確か?
  - `discussion`, `isDiscussionLoading`, `loadDiscussionData` など明確な命名
  - `extractDiscussionFromNaddr`, `pickLatestDiscussion` のような既存パターンを踏襲

- [x] **シンプルなロジック**: 複雑なロジックは小さな関数に分解される設計か?
  - データ取得: `loadDiscussionData()` として分離
  - エラー処理: 早期リターンパターン
  - ローディング状態: 段階的表示で複雑なネストを回避

- [x] **構造化された整理**: ファイルは適切なディレクトリ(`src/lib/`, `src/components/`等)に配置されるか?
  - `src/components/discussion/DiscussionTabLayout.tsx` に実装
  - 既存のディレクトリ構造を維持

- [x] **型安全性**: TypeScript strict モードで型定義が明確か? `any` は使用されないか?
  - `Discussion | null` による型安全な状態管理
  - `unknown` と型ガードで不明な型を処理
  - 既存の `Discussion`, `DiscussionInfo` 型を使用

- [x] **テスト駆動開発**: テストファーストで開発される計画か? (仕様に基づくテストのみ)
  - 既存の `DiscussionTabLayout.test.tsx` を拡張
  - データ取得ロジックのテスト追加
  - ローディング状態のテスト追加

- [x] **アクセシビリティ**: UIコンポーネントはWCAG 2.1 AA基準を満たすか? (ARIA属性、44px×44pxタッチターゲット)
  - 既存のタブナビゲーションはWCAG準拠済み
  - 新規要素もアクセシブルな構造を維持

- [x] **適切なコメント**: 「なぜ」を説明するコメント、JSDocが計画されているか?
  - データ取得ロジックに「なぜこの方法か」を説明
  - ローディング状態の設計判断を文書化

### 技術制約チェック

- [x] **パフォーマンス**: API応答は95パーセンタイルで200ms以内に収まる設計か?
  - Nostrストリーミングは既存実装で検証済み
  - 重複データ取得はブラウザキャッシュで軽減

- [x] **データベース**: Prisma ORMとSQLiteの制約内で実装可能か?
  - N/A（Nostrプロトコルのみ使用）

- [x] **Nostr統合**: 既存のNIP-72/NIP-25実装と整合性があるか?
  - `streamDiscussionMeta` を使用（既存パターン）
  - kind:34550 の取得方法は監査ページと同一

### コミット前チェックリスト遵守

実装完了時に以下がすべて成功することを確認する計画があるか?
- [x] `npx tsc --noEmit` - TypeScript型チェック
- [x] `npm run lint` - ESLint
- [x] `npm test` - Jestテスト
- [x] `npm run build` - ビルド確認

## Project Structure

### Documentation (this feature)

```text
specs/001-audit-header-layout/
├── spec.md              # 機能仕様書
├── plan.md              # このファイル（実装計画）
├── research.md          # Phase 0 アウトプット（リサーチ結果）
├── data-model.md        # Phase 1 アウトプット（データモデル）
├── quickstart.md        # Phase 1 アウトプット（クイックスタート）
├── contracts/           # Phase 1 アウトプット（API契約）
├── checklists/          # 品質チェックリスト
│   └── requirements.md  # 仕様品質チェックリスト（完了済み）
└── tasks.md             # Phase 2 アウトプット（/speckit.tasks で生成）
```

### Source Code (repository root)

```text
src/
├── app/
│   └── discussions/
│       └── [naddr]/
│           ├── layout.tsx          # [修正] レイアウトコンポーネント
│           ├── page.tsx            # [修正] 会話詳細ページ（削除部分）
│           └── audit/
│               └── page.tsx        # [修正] 監査ページ（見出し削除）
│
├── components/
│   └── discussion/
│       ├── DiscussionTabLayout.tsx  # [拡張] データ取得追加
│       └── AuditLogSection.tsx      # [参照] 既存実装パターン
│
├── lib/
│   ├── nostr/
│   │   ├── nostr-service.ts        # [使用] streamDiscussionMeta
│   │   ├── nostr-utils.ts          # [使用] parseDiscussionEvent
│   │   └── naddr-utils.ts          # [使用] extractDiscussionFromNaddr
│   └── test/
│       └── test-data-loader.ts     # [使用] isTestMode, loadTestData
│
└── types/
    └── discussion.ts                # [使用] Discussion, DiscussionInfo

__tests__/
└── components/
    └── discussion/
        └── DiscussionTabLayout.test.tsx  # [拡張] テスト追加
```

**Structure Decision**: Next.js App Router の標準構造を採用。既存のディレクトリ構造を維持し、`DiscussionTabLayout` コンポーネントを拡張する形で実装します。

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

本機能は憲章の原則に完全に準拠しており、複雑性の違反はありません。

---

## Phase 0: Outline & Research

*このセクションは `/speckit.plan` コマンドによって自動生成されます。*

### Research Tasks

本機能は既存の実装パターンを踏襲するため、大規模なリサーチは不要です。以下の既存実装を参照します：

1. **データ取得パターン**
   - 参照元: `src/app/discussions/[naddr]/audit/page.tsx`
   - 参照元: `src/components/discussion/AuditLogSection.tsx`
   - パターン: `streamDiscussionMeta` + `loadDiscussionIndependently`

2. **エラーハンドリング**
   - 参照元: `src/app/discussions/[naddr]/page.tsx`
   - パターン: try-catch + エラー状態管理

3. **ローディング状態**
   - 参照元: 既存の `renderInlineLoading` パターン
   - 新規: 段階的ローディング（タブ+戻るリンク → タイトル+説明）

4. **テストモード対応**
   - 参照元: `src/lib/test/test-data-loader.ts`
   - パターン: `isTestMode()` 判定 + `loadTestData()`

### Design Decisions (research.md で詳細化)

1. **データ取得方法**: `streamDiscussionMeta` を使用
   - 理由: リアルタイム更新、既存パターンとの整合性
   - 代替案: `getReferencedUserDiscussions` (却下: ストリーミング不可)

2. **状態管理**: useState + useRef (Context不要)
   - 理由: 軽量、既存パターン踏襲、重複データ取得はキャッシュで対応
   - 代替案: React Context (却下: 過剰設計)

3. **ローディング表示**: 段階的表示
   - 理由: UX向上、データ依存関係の明確化
   - 代替案: 全要素同時表示 (却下: 瞬間的な空白が発生)

---

## Phase 1: Design & Contracts

*このセクションは `/speckit.plan` コマンドによって自動生成されます。*

### Data Model (data-model.md)

**既存エンティティの使用**:
- `Discussion`: 会話データ（kind:34550）
- `DiscussionInfo`: NADDR から抽出した識別情報

**新規状態**:
```typescript
// DiscussionTabLayout の新規状態
const [discussion, setDiscussion] = useState<Discussion | null>(null);
const [isDiscussionLoading, setIsDiscussionLoading] = useState(true);
const [discussionError, setDiscussionError] = useState<string | null>(null);
const discussionStreamCleanupRef = useRef<(() => void) | null>(null);
const loadSequenceRef = useRef(0);
```

### Component Contracts (contracts/)

**DiscussionTabLayout Props (拡張後)**:
```typescript
interface DiscussionTabLayoutProps {
  baseHref: string;           // タブナビゲーションのベースURL
  children: React.ReactNode;  // ページコンテンツ
  // 新規propsは不要（useParams() でnaddr取得）
}
```

**Internal Functions**:
```typescript
// データ取得関数
function loadDiscussionData(): Promise<void>

// 最新ディスカッション選択
function pickLatestDiscussion(events: Event[]): Discussion | null

// テストデータロード
function loadTestDiscussionData(): Promise<Discussion>
```

### Quickstart (quickstart.md)

開発者向けクイックスタート手順を生成します。

---

## Phase 2: Implementation Tasks

*このセクションは `/speckit.tasks` コマンドで生成されます（このコマンドでは生成されません）。*

タスクの詳細は `tasks.md` に記載されます。

---

## Notes

### 既存実装との統合ポイント

1. **メインページ (`page.tsx`) との関係**
   - レイアウトとメインページは独立してデータ取得
   - 重複取得はブラウザキャッシュで軽減（明確化された設計判断）
   - メインページからヘッダー要素を削除（502-507行目、509-511行目、553-557行目）

2. **監査ページ (`audit/page.tsx`) との関係**
   - 「監査ログ」見出しを削除（40行目）
   - レイアウトで表示されるタイトルに統一

3. **タブナビゲーションとの統合**
   - 既存のWCAG 2.1 AA準拠を維持
   - ヘッダー要素はタブの上に配置

### パフォーマンス考慮事項

- **ストリーミング**: `streamDiscussionMeta` によるリアルタイム更新
- **キャッシュ**: Nostrリレーとブラウザキャッシュによる重複軽減
- **非同期制御**: `loadSequenceRef` による古いデータの破棄

### アクセシビリティ考慮事項

- 既存のタブナビゲーションのアクセシビリティを維持
- ローディング状態には `role="status"` と `aria-live="polite"` を使用
- エラーメッセージには `role="alert"` を使用
