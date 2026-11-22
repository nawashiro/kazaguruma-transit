# Spec Delta

## MODIFIED Requirements

### Requirement: 一発コマンドでテストが完結する

`npm test` は、本番サーバに依存するテストを含めて、事前にサーバ起動やビルドコマンドを実行しなくても完結しなければならない（SHALL）。テスト実行系は、既存のビルド成果物を再利用してよいかを成果物の健全性で判定し、成果物が無いか、本番サーバの起動に必要な manifest を欠く場合は production ビルドを作ってから本番サーバを起動する（SHALL）。

#### Scenario: サーバ未起動・ビルド未作成からテストする

- **WHEN** 3100ポートに対応するサーバが動いておらず `.next/BUILD_ID` も無い状態で `npm test` を実行する
- **THEN** production ビルドが実行され、その後本番サーバが起動して server プロジェクトが完了し、テスト実行後に起動されたサーバは停止する

#### Scenario: 壊れたビルド成果物からテストする

- **WHEN** `.next/BUILD_ID` はあるが、本番サーバの起動に必要な manifest が欠けている状態で `npm test` を実行する
- **THEN** production ビルドが実行され、その後本番サーバが起動して server プロジェクトが完了する

#### Scenario: 揃ったビルド成果物を再利用する

- **WHEN** `.next` のビルド成果物が揃っている状態で `npm test` を実行する
- **THEN** production ビルドは実行されず、server プロジェクトが完了する
