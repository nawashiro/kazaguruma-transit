<!--
Sync Impact Report:
- Version Change: N/A → 1.0.0
- Reason: Initial constitution based on Readable Code principles and codebase analysis
- Modified Principles: N/A (initial creation)
- Added Sections:
  * Core Principles (7 principles)
  * Technology Stack & Constraints
  * Development Workflow
  * Governance
- Templates Status:
  ✅ plan-template.md: Constitution Check section references this file
  ✅ spec-template.md: User stories and requirements align with principles
  ✅ tasks-template.md: Task organization reflects Test-First and decomposition principles
- Follow-up TODOs: None
- Ratification Date: 2026-01-13 (initial adoption)
-->

# Kazaguruma Transit Constitution

千代田区福祉バス「風ぐるま」非公式ウェブアプリケーションの開発憲章

## Core Principles

### I. 明確な命名 (Clear Naming)

すべての命名は、その目的と振る舞いを明確に表現しなければならない。

- **変数・関数名は意図を表現する**: `findNearestStop()`, `canApprovePost()`, `isDbInitialized` のように、名前から処理内容が推測できること
- **ブール値は is/can/has で始める**: `isTestMode()`, `canEditDiscussion()`, `hasModerator` のように状態や能力を表現する
- **動詞ベースの関数名**: `calculateDistance()`, `formatTime()`, `validateInput()` のように動作を表す動詞を使用する
- **ドメイン言語を使用**: ビジネスロジックは業務用語を使用し(`Discussion`, `Evaluation`, `Transit`)、技術用語との混在を避ける
- **略語の制限**: 一般的な略語(id, url, api)以外は使用しない。`usr` ではなく `user`, `msg` ではなく `message` を使用する

**根拠**: 命名の明確性はコードの可読性の基盤である。名前が不明瞭なコードは、コメントで補うのではなく、名前を改善すべきである。

### II. シンプルなロジック (Simple Logic)

複雑なロジックは小さな関数に分解し、各関数は単一の責務を持たなければならない。

- **単一責任の原則**: 各関数は1つの明確な目的を持つ。`dedupeAndSortEvents()` は重複排除とソートのみを行う
- **早期リターン**: ガード節を使用し、ネストを減らす。エラー条件は早期にreturnする
- **深いネストの禁止**: if文のネストは3階層まで。それ以上は関数分割または早期リターンで対処する
- **マジックナンバーの排除**: すべての定数は名前付き定数として定義する(`RATE_LIMIT_WINDOW_MS`, `WALKING_SPEED_KM_H`)
- **複雑な条件式の抽出**: 複雑な条件は意味のある関数名で抽出する(`isTimeInRange()`, `isActiveService()`)

**根拠**: シンプルなロジックは理解しやすく、テストしやすく、バグが混入しにくい。複雑さは必要最小限に抑えるべきである。

### III. 構造化された整理 (Structured Organization)

コードは目的別に整理され、関連するコードは近くに配置されなければならない。

- **ディレクトリ構造の明確化**:
  - `src/app/`: Next.js App Routerのページ
  - `src/components/`: React コンポーネント(features/, layouts/, ui/, discussion/ に分類)
  - `src/lib/`: ビジネスロジックとサービス層
  - `src/types/`: 型定義の集約
  - `src/utils/`: 汎用ユーティリティ
- **レイヤー分離**: UI層、サービス層、データ層を明確に分離する。UIコンポーネントは直接データベースアクセスを行わない
- **シングルトンパターンの適用**: `TransitService.getInstance()` のように、状態を持つサービスクラスはシングルトンで管理する
- **型定義の集約**: 共通の型は `/src/types/` に集約し、各モジュールでの型定義重複を避ける
- **ファイル命名規則**:
  - コンポーネント: PascalCase (`Button.tsx`, `OriginSelector.tsx`)
  - サービス/ユーティリティ: kebab-case (`transit-service.ts`, `nostr-utils.ts`)
  - テスト: `*.test.ts` または `__tests__/` ディレクトリ

**根拠**: 一貫した構造により、新規参加者は素早くコードベースを理解できる。整理されたコードは発見しやすく、変更しやすい。

### IV. 型安全性 (Type Safety)

TypeScriptの型システムを活用し、コンパイル時にエラーを検出しなければならない。

- **strictモード必須**: `tsconfig.json` で strict オプションを有効化する
- **anyの禁止**: `any` 型の使用は禁止。不明な型は `unknown` を使用し、型ガードで絞り込む
- **インターフェースの優先**: オブジェクト構造は interface で定義し、JSDocコメントで説明を付加する
- **判別可能なユニオン型**: `type: "route" | "stop" | "timetable"` のように、型で処理を分岐できるようにする
- **型定義へのコメント**: 型定義には「なぜその型なのか」を説明するコメントを付ける
  ```typescript
  // 位置情報 - 緯度経度は数値精度が重要
  export interface Location {
    lat: number;
    lng: number;
    address?: string;
  }
  ```
- **Null安全性**: `null` と `undefined` を区別し、optional (`?`) を適切に使用する

**根拠**: 型安全性はバグの早期発見につながる。実行時エラーよりコンパイル時エラーの方が修正コストが低い。

### V. テスト駆動開発 (Test-First Development)

テストはコードより先に書かれ、すべてのテストが通るまで実装は完了しない。

- **TDDサイクルの厳守**: Red(テスト失敗) → Green(実装) → Refactor(リファクタリング) の順で開発する
- **仕様に基づくテスト**: 仕様に存在しない機能のテストは書かない(例: 「管理者ロールが存在しない」のテストは不要)
- **テスト名は仕様書**: テスト名は「何をテストするか」を日本語で明確に記述する
  ```typescript
  it("ボタンが正しくレンダリングされ、クリックイベントが発火すること", () => { ... })
  it("無効状態が適切に表示されること", () => { ... })
  ```
- **AAA パターン**: Arrange(準備) → Act(実行) → Assert(検証) の構造を守る
- **モックの明示**: モックは何をモックしているか、なぜモックが必要かをコメントで説明する
- **テスト実行の必須化**: 実装完了の定義は「tsc, lint, test, build がすべて成功すること」

**根拠**: テスト駆動開発は設計品質を高め、リグレッションを防ぐ。テストが先にあることで、実装がテストしやすい設計になる。

### VI. アクセシビリティ & ユーザー体験 (Accessibility & User Experience)

すべてのUIコンポーネントはWCAG 2.1 AA基準を満たし、誰もが使えるものでなければならない。

- **ARIA属性の必須化**: すべてのインタラクティブ要素に適切な `aria-label`, `aria-pressed`, `aria-expanded` などを付与する
- **タッチターゲットサイズ**: モバイルでのタッチターゲットは最小44px×44px (WCAG 2.5.5) を確保する
  ```typescript
  const accessibilityClass = "min-h-[44px] min-w-[44px]";
  ```
- **アクセシビリティ警告**: アイコンのみのボタンに `aria-label` がない場合は警告を出す
- **エラーバウンダリ**: すべてのページにエラーバウンダリとローディング状態を実装する
- **ユーザーフレンドリーなエラーメッセージ**: エラーメッセージは技術的詳細ではなく、ユーザーが理解できる日本語で表示する
- **レスポンシブデザイン**: デスクトップ、タブレット、モバイルのすべてで適切に動作する

**根拠**: アクセシビリティは後付けではなく、設計段階から組み込むべきである。すべてのユーザーが使えるアプリケーションを作ることは、開発者の責務である。

### VII. ドキュメントと適切なコメント (Documentation & Comments)

コードは自己文書化を目指し、コメントは「なぜ」を説明するために使用しなければならない。

- **「なぜ」を説明するコメント**: 「何をしているか」はコードから読み取れる。コメントは「なぜそうするのか」を説明する
  ```typescript
  // 歩行速度（時速キロメートル）
  // 3.5km/h は後期高齢者の一般的な歩行速度
  WALKING_SPEED_KM_H: 3,
  ```
- **JSDocの活用**: 公開API、複雑な関数、型定義にはJSDocを付与する
- **WCAG基準の明記**: アクセシビリティ対応コードには具体的なWCAG基準番号を記載する
  ```typescript
  // モバイルでのタッチターゲットサイズを確保（WCAG 2.5.5）
  ```
- **技術的制約の説明**: 回避策やワークアラウンドには、なぜそれが必要かを説明する
  ```typescript
  // @ts-expect-error - モック関数の戻り値型の不一致を無視
  ```
- **TODOの明確化**: TODOコメントには担当者と期限を含める
- **コメントアウトの禁止**: 使わないコードはコメントアウトではなく削除する。Gitが履歴を保持する

**根拠**: 良いコメントは未来の自分と他の開発者への贈り物である。コードが「何を」するかは読めるが、「なぜ」そうするかは読めない。

## Technology Stack & Constraints

### 技術スタック

- **フレームワーク**: Next.js 15 (App Router), React 19
- **言語**: TypeScript 5 (strictモード)
- **UI**: Tailwind CSS 4 + DaisyUI 5
- **データベース**: SQLite + Prisma ORM
- **テスト**: Jest + React Testing Library
- **分散プロトコル**: Nostr (NIP-72, NIP-25)

### 制約事項

- **パフォーマンス**: API応答時間は95パーセンタイルで200ms以内
- **データベース**: GTFSデータのインポートはビルド時に自動実行される
- **画像処理**: 外部URLからの画像は `<img>` タグを使用(Next.js `<Image>` は使用不可)
- **ボタンスタイリング**: DaisyUIのカップケーキ型角丸が機能しない場合は `rounded-full dark:rounded-sm` を使用
- **日本語対応**: ルビ表示は `ruby-text` クラスを使用
- **セキュリティ**: レート制限は1時間あたり60リクエスト(IPベース)

## Development Workflow

### コミット前チェックリスト

すべてのコミット前に以下を実行し、すべてが成功することを確認する:

1. `npx tsc --noEmit` - TypeScript型チェック
2. `npm run lint` - ESLint
3. `npm test` - Jestテスト
4. `npm run build` - ビルド確認

### ブランチ戦略

- **mainブランチ**: `master` (本番環境)
- **機能ブランチ**: `feature/###-feature-name` または `fix/###-issue-number` の形式
- **マージ前**: すべてのテストが通ることを確認する

### コードレビュー要件

- **憲章準拠の確認**: すべてのPRは本憲章の原則に準拠していることを確認する
- **テストカバレッジ**: 新規コードには対応するテストが存在すること
- **型安全性**: `any` 型が使用されていないこと
- **アクセシビリティ**: 新規UIコンポーネントはARIA属性とタッチターゲットサイズを満たすこと

### ディレクトリ作成時の検証

新規ディレクトリやファイルを作成する前に、親ディレクトリの存在を `ls` で確認する。

## Governance

### 憲章の位置付け

本憲章はすべての開発プラクティスに優先する。本憲章と他の文書が矛盾する場合、本憲章が優先される。

### 改定手続き

- **提案**: 改定提案はGitHub Issueで行う
- **議論**: 最低7日間の議論期間を設ける
- **承認**: プロジェクトメンテナーの過半数の承認が必要
- **移行計画**: 後方互換性のない変更には、既存コードの移行計画を含める
- **バージョン管理**:
  - MAJOR: 後方互換性のないガバナンス変更、原則の削除・再定義
  - MINOR: 新原則の追加、セクションの重要な拡張
  - PATCH: 明確化、表現の改善、誤字修正

### 準拠確認

- **PR/レビュー時**: すべてのPR/レビューで憲章への準拠を確認する
- **複雑性の正当化**: 憲章の原則に違反する複雑性は、その必要性を文書化しなければならない
- **実行時ガイダンス**: 日々の開発ガイダンスは `CLAUDE.md` を参照する

### 違反時の対応

原則違反が発見された場合:

1. **軽微な違反**: コードレビューで修正を要求
2. **重大な違反**: PRをブロックし、設計の見直しを要求
3. **意図的な違反**: 正当な理由がある場合は、PR説明で理由を文書化し、承認を得る

**Version**: 1.0.0 | **Ratified**: 2026-01-13 | **Last Amended**: 2026-01-13
