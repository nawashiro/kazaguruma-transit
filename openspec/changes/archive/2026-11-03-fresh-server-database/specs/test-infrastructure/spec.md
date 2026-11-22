# test-infrastructure Specification

## Purpose

テストがローカルでもCIでも同じ前提で回ることを保証する。ねらいは、実行前の暗黙の状態（サーバ起動、ビルド成果物、環境変数、データベース）が存在しなくても、テスト コマンドが作る。

## ADDED Requirements

### Requirement: テスト用データベースをコマンドが用意する

テスト実行系は、`transit-config.json` の `sqlitePath` が指すデータベースの親ディレクトリとスキーマを実行前に用意しなければならない（SHALL）。データベースファイルが既に存在するときは、それに対してスキーマの適用を行ってはならない（MUST）。

#### Scenario: fresh checkout から server テストを実行する

- **WHEN** `transit-config.json` の `sqlitePath` が指すデータベースファイルが存在しない状態で server プロジェクトのテストを実行する
- **THEN** 親ディレクトリが作られ、Prisma スキーマが適用された空のデータベースが作成されたうえで、本番サーバが起動してテストが完結する

#### Scenario: 既存データベースをそのまま使う

- **WHEN** `sqlitePath` が指すデータベースファイルが既に存在する状態でテストを実行する
- **THEN** スキーマの適用は行われず、そのデータベースの内容は変えられない
