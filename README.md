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
```

### データベース＆ビルド

```bash
npm run prisma:generate  # Prismaクライアントの生成
npm run prisma:migrate   # データベースマイグレーションの実行
npm run prisma:studio    # Prisma Studioの起動
npm run import-gtfs      # GTFS交通データのインポート
npm run build            # 本番環境向けフルビルド（GTFSデータのインポート含む）
npm start                # 本番環境向けサーバーの起動
```

## アーキテクチャ

### 主要コンポーネント

- **Next.js 15** with App RouterおよびReact 19を採用
- **Prisma ORM**とSQLiteを使用したGTFS交通データ管理
- **DaisyUI + Tailwind CSS**によるUIコンポーネント
- **交通サービス層**（`src/lib/transit/`ディレクトリ）による経路アルゴリズム処理

### データベーススキーマ

本アプリケーションはGTFS（General Transit Feed Specification）形式のデータをSQLiteに格納して使用します：

- 交通データ用の`Stop`、`Route`、`Trip`、`StopTime`モデル
- スケジュール管理用の`Calendar`、`CalendarDate`
- APIレート制限用の`RateLimit`

### 主要サービス

- **TransitService**（`src/lib/transit/transit-service.ts`）：経路検索、停留所検索、時刻表照会を統括するメインサービスクラス
- **TimeTableRouter**（`src/lib/transit/route-algorithm.ts`）：ダイクストラ法に基づく経路探索アルゴリズムを実装
- API保護のためのレート制限ミドルウェア

### API構造

メインAPIエンドポイント`/api/transit`では以下の処理を行います：

- 経路照会リクエスト（type: "route"）
- 停留所検索リクエスト（type: "stop"）
- 時刻表リクエスト（type: "timetable"）

### 経路探索アルゴリズム

2つの探索戦略を採用：

1. **従来型探索**：出発地/目的地に最も近い停留所を基準とした経路探索
2. **速度優先探索**：複数の近隣停留所を考慮し、最適な経路を探索
3. 直行便および乗り換えルートに対応（最大2回乗り換え、3時間の時間枠）

## 開発環境のセットアップ

1. プロジェクトルートに`transit-config.json`を作成（`transit-config.json.example`を参照）
2. `.env.local`ファイルで環境変数を設定：
   - `GOOGLE_MAPS_API_KEY`
   - `NEXT_PUBLIC_APP_URL`
   - `NEXT_PUBLIC_GA_MEASUREMENT_ID`
3. ビルド時にPrismaクライアントが自動生成され、GTFSデータがインポートされます

## テスト

- React Testing Libraryを使用したJestテスト
- テストファイルは`__tests__`ディレクトリまたは`.test.ts/.test.tsx`形式で配置
- 外部依存関係のモックは`__mocks__/`および`src/__mocks__/`ディレクトリに配置

## ファイル構成に関する注意点

- コンポーネントはTypeScriptを使用し、厳格な型チェックを実施
- 日本語テキスト表示用にRubyテキストをサポート
- 経路情報のPDFエクスポート機能を実装
- Google Maps連携による位置情報サービスを採用
- Google Analytics 4を使用したアクセス解析を実装

## 重要な設計パターン

- TransitServiceクラスはシングルトンパターンを採用
- エラー境界処理とローディング状態表示
- ARIAラベルを使用したアクセシブルなUI設計
- APIエンドポイントへのレート制限実装
- SEO最適化のための構造化データマークアップ

## UI

UIにはTailwind + DaisyUI5を採用しています。

## img

画像は外部URLから読み込む場合があります。この場合、Imageコンポーネントは使用できず、imgタグを使用します。

## btn

daisyuiのカップケーキ型角丸処理が機能しない場合があるため、`rounded-full dark:rounded-sm`を使用しています。
