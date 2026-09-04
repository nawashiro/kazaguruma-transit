# Docker 開発用・本番用構成

## 概要

千代田区福祉交通「風ぐるま」の乗り換え案内アプリケーションでは、開発環境と本番環境で異なる Docker 構成を使用しています。

## 使用方法

`transit-config.json` はサーバー側の秘密設定です。公開設定は
`app-config.json.example`を`app-config.json`へコピーして用意します。`app-config.json`は配布先ごとの
設定でありGit管理しません。Composeのビルドでは
BuildKit secret、実行時は SELinux 対応の read-only bind mount として渡します。
SELinux が有効な Linux では、Compose が `container_file_t` ラベルへ relabel
するため、別途 `chcon` を実行する必要はありません。

起動前に設定ファイルを用意し、秘密情報を含むため所有者だけが読める権限にします。

```bash
cp app-config.json.example app-config.json
# 必要な公開URL、GA、Discussion、Ko-fiの値を編集
cp transit-config.json.example transit-config.json
chmod 600 transit-config.json
```

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

## 開発ワークフロー

1. 開発時は`docker compose up --build`で開発環境を起動
2. コードを編集すると自動的に変更が反映
3. テストを実行しながら開発を進める
4. 本番デプロイ時は`docker compose -f compose.prod.yml up --build -d`で本番環境を構築
