# Spec Delta

## Purpose

lint が `any` の使用をどのファイルで禁止するかを定める。本番コードの型の緩みは止め、テストコードでは意図的な `any` を許す。

## ADDED Requirements

### Requirement: 本番コードの明示的な any は lint エラーにする

テストにもモックにも当たらない TypeScript ファイルで `any` を明示したとき、lint は `@typescript-eslint/no-explicit-any` をエラーとして報告しなければならない（SHALL）。

#### Scenario: 本番コードに any を書く

- **WHEN** `src` 配下のテストでもモックでもない TypeScript ファイルで `any` を明示する
- **THEN** lint は `@typescript-eslint/no-explicit-any` をエラーとして報告する

### Requirement: テストとテスト用モックの any は lint で報告しない

`__tests__` 配下、`*.test.ts`、`*.test.tsx`、`__mocks__` 配下の TypeScript ファイルでは、lint は `@typescript-eslint/no-explicit-any` を報告してはならない（MUST NOT）。

#### Scenario: テストファイルに any を書く

- **WHEN** `__tests__` 配下または `*.test.ts(x)` のファイルで `any` を明示する
- **THEN** lint は `@typescript-eslint/no-explicit-any` を報告しない

#### Scenario: テスト用モックに any を書く

- **WHEN** `__mocks__` 配下の TypeScript ファイルで `any` を明示する
- **THEN** lint は `@typescript-eslint/no-explicit-any` を報告しない

#### Scenario: テスト以外のファイルは対象外にしない

- **WHEN** テストでもモックでもないファイルで `any` を明示する
- **THEN** lint はテスト向けの除外を適用せず、`@typescript-eslint/no-explicit-any` をエラーとして報告する
