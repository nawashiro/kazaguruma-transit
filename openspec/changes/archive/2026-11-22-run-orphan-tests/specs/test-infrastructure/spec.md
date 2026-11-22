# Spec Delta

## ADDED Requirements

### Requirement: すべてのテストファイルが実行経路を持つ

テストファイルは、`npm test` か専用の npm スクリプトから実行されなければならない（MUST）。どのコマンドからも実行されないテストファイルを残してはならない（MUST NOT）。実ブラウザを動かす検証は、production ビルドを起動する専用のコマンドで実行する。

#### Scenario: 単体テストを追加する

- **WHEN** `scripts/__tests__` に jest で書いたテストを追加する
- **THEN** `npm test` の unit プロジェクトがそのテストを実行する

#### Scenario: ブラウザ検証を実行する

- **WHEN** `npm run test:skip-link` を実行する
- **THEN** ビルド済みのアプリが3000で起動し、スキップリンクのブラウザ検証が実行され、終了後に起動したサーバが停止する

### Requirement: Quality Gate はブラウザ検証を実行する

Quality Gate は、本番ビルドと Jest のテストのあとに、ブラウザ検証のコマンドを実行しなければならない（SHALL）。

#### Scenario: Quality Gate がブラウザ検証を含む

- **WHEN** Quality Gate が起動する
- **THEN** スキップリンクのブラウザ検証のステップが実行される
