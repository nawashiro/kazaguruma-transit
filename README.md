## プロジェクト概要

これは千代田区の福祉バス「風ぐるま」の非公式ウェブアプリケーションです。地域バスサービスの経路検索および時刻表情報を提供します。

## 主要コマンド

### 開発

```bash
npm run dev          # Turbopackを使用した開発サーバーの起動
npm install          # 依存関係のインストール
```

### テスト

```bash
npm test             # Jestテストの実行
npm test:watch       # Jestをウォッチモードで実行
npm run lint         # ESLintによるコードチェック
npx tsc --noEmit     # TypeScriptの型チェックのみ実行
```

### データベース & ビルド

```bash
npm run prisma:generate  # Prismaクライアントの生成
npm run prisma:migrate   # データベースマイグレーションの実行
npm run prisma:studio    # Prisma Studioの起動
npm run import-gtfs      # GTFS交通データのインポート
npm run build            # 本番環境向けフルビルド（GTFSインポートを含む）
npm start                # 本番環境サーバーの起動
```

## アーキテクチャ

### 主要コンポーネント

- **Next.js 15** with App Router および React 19 を採用
- **Prisma ORM**と SQLite を使用した GTFS 交通データ管理
- **DaisyUI + Tailwind CSS**による UI コンポーネント
- **交通サービス層**（`src/lib/transit/`）：経路アルゴリズムを実装
- **Nostr 統合機能**（`src/lib/nostr/`）：分散型ディスカッション機能を実装

### データベーススキーマ

本アプリケーションは GTFS（General Transit Feed Specification）形式のデータを SQLite に格納しています：

- 交通データ用の`Stop`、`Route`、`Trip`、`StopTime`モデル
- スケジュール管理用の`Calendar`、`CalendarDate`
- API レート制限用の`RateLimit`

### 主要サービス

- **TransitService**（`src/lib/transit/transit-service.ts`）：経路検索、停留所検索、時刻表問い合わせを統括するメインサービスクラス
- **TimeTableRouter**（`src/lib/transit/route-algorithm.ts`）：ダイクストラ法に基づく経路探索アルゴリズムを実装
- **NostrService**（`src/lib/nostr/nostr-service.ts`）：ディスカッション機能のための Nostr プロトコル通信を処理
- **EvaluationService**（`src/lib/evaluation/evaluation-service.ts`）：Polis ベースの合意形成分析によるディスカッション投稿評価
- **API 保護用レート制限ミドルウェア**

### API 構造

メイン API エンドポイント`/api/transit`は以下の処理を担当：

- 経路問い合わせ（type: "route"）
- 停留所検索（type: "stop"）
- 時刻表リクエスト（type: "timetable"）

### 経路探索アルゴリズム

2 つの探索戦略を採用：

1. **従来型探索**：起点/終点に最も近い停留所を使用
2. **速度優先探索**：最適な経路のため周辺の複数停留所を考慮
3. 直行便と乗り換えルートの両方に対応（最大 2 回乗り換え、3 時間の時間枠）

## 開発環境のセットアップ

1. プロジェクトルートに`transit-config.json`を作成（`transit-config.json.example`を参照）
2. `.env.local`に環境変数を設定：
   - `GOOGLE_MAPS_API_KEY`
   - `NEXT_PUBLIC_APP_URL`
   - `NEXT_PUBLIC_GA_MEASUREMENT_ID`
   - `NEXT_PUBLIC_DISCUSSIONS_ENABLED`（オプション、ディスカッション機能用）
   - `NEXT_PUBLIC_ADMIN_PUBKEY`（オプション、ディスカッション管理用）
   - `NEXT_PUBLIC_NOSTR_RELAYS`（オプション、Nostr リレー用）
3. ビルド時に Prisma クライアントが自動生成され、GTFS データがインポートされます

## テスト

- React Testing Library を使用した Jest テスト
- `__tests__`ディレクトリ内のテストファイルまたは`.test.ts/.test.tsx`形式のファイル
- 外部依存関係のモックは`__mocks__/`および`src/__mocks__/`ディレクトリに配置

## ファイル構造に関する注意点

- コンポーネントは TypeScript を使用し、厳格な型チェックを実施
- 日本語テキスト表示用の Ruby テキストサポートを実装
- 経路情報の PDF エクスポート機能を装備
- Google Maps 連携による位置情報サービスを採用
- Google Analytics 4 を使用した分析機能を実装

## 重要な設計パターン

- TransitService クラスはシングルトンパターンを採用
- エラー境界処理とローディング状態管理を実装
- ARIA ラベルを使用したアクセシブルな UI 設計
- API エンドポイントへのレート制限を適用
- SEO 最適化のための構造化データ実装

## UI

UI には Tailwind + DaisyUI5 を採用しています。

## img

画像は外部 URL から読み込む場合があります。この場合、Image コンポーネントは使用できず、img タグを使用します。

## btn

daisyui のカップケーキ型角丸処理が機能しない場合があるため、`rounded-full dark:rounded-sm`を使用しています。

## ディスカッション機能

本アプリケーションには Nostr ベースの分散型ディスカッション機能を実装しています：

- **NIP-72 準拠**：kind:34550（コミュニティ定義）と kind:4550（承認イベント）をサポートし、モデレートされたコミュニティを実現
- **NIP-25 リアクション機能**：kind:7 イベントを使用して投稿評価を実施（評価タグではなくコンテンツベースの評価）
- **合意形成分析**：Polis 風のアルゴリズムを実装し、投稿に対するグループ合意形成を分析
- **権限管理システム**：作成者とモデレーターベースのアクセス制御を採用（ディスカッションにはグローバル管理者を設けない設計）

### 主要プロトコル

- 投稿には kind:1111（コミュニティ投稿）を使用（kind:1 との後方互換性あり）
- 評価には kind:7 を使用し、コンテンツフィールドを採用（"-"で否定評価、その他は肯定評価として処理）
- 承認システムでは、承認イベントのコンテンツフィールドに元の投稿データを保存
