# Docker 開発用・本番用構成

## 概要

千代田区福祉交通「風ぐるま」の乗り換え案内アプリケーションでは、開発環境と本番環境で異なる Docker 構成を使用しています。これにより、開発効率を保ちながら、本番環境では最適化されたアプリケーションを提供することができます。

## 開発用と本番用の Docker 構成の違い

### 開発用（Dockerfile.dev）

- ホットリロード対応（コード変更をリアルタイムで反映）
- デバッグツールのインストール
- ソースコードのマウント（コンテナ内で直接編集可能）
- テスト環境のセットアップ
- 開発用の環境変数設定

### 本番用（Dockerfile.prod）

- 最適化されたビルド
- 最小限の依存関係
- セキュリティ強化
- 本番用の環境変数設定
- パフォーマンス最適化

## 使用方法

### 開発環境の起動

```powershell
# 開発用コンテナのビルドと起動
docker compose up --build
```

### 本番環境の起動

```powershell
# 本番用コンテナのビルドと起動
docker compose -f compose.prod.yml up --build -d
```

## ファイル構成

```
.
├── Dockerfile.dev      # 開発用Dockerfile
├── Dockerfile.prod     # 本番用Dockerfile
├── compose.yml         # 開発用設定
└── compose.prod.yml    # 本番用設定
```

## 開発用 Dockerfile（Dockerfile.dev）の特徴

- ソースコードをマウントして開発
- ホットリロード対応
- デバッグツールのインストール
- テスト環境のセットアップ

## 本番用 Dockerfile（Dockerfile.prod）の特徴

- マルチステージビルド
- 最適化された依存関係
- セキュリティ強化
- パフォーマンス最適化

## 開発用 compose.yml の特徴

- ボリュームマウント
- 開発用ポート設定
- デバッグ設定
- テスト環境設定

## 本番用 compose.prod.yml の特徴

- 本番用ポート設定
- 本番用環境変数
- スケーリング設定
- ヘルスチェック設定

## 開発ワークフロー

1. 開発時は`docker compose up --build`で開発環境を起動
2. コードを編集すると自動的に変更が反映
3. テストを実行しながら開発を進める
4. 本番デプロイ時は`docker compose -f compose.prod.yml up --build`で本番環境を構築
