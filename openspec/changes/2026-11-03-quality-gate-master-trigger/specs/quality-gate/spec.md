# quality-gate Specification

## Purpose

Quality Gate（`.github/workflows/quality-gate.yml`）がどの起点で起動するかを扱う能力。テストの挙動自体はtest-infrastructureが扱い、この能力はworkflowの起動条件を明文化する。

## ADDED Requirements

### Requirement: Quality Gate の自動起動はmaster起源のイベントに限る

`quality-gate.yml` が自動で起動するのは、masterブランチへのpush と masterブランチを対象とするpull request のときに限らなければならない（SHALL）。master以外のブランチへのpush で workflow を自動起動してはならない（MUST）。

#### Scenario: masterへのpushで自動起動する

- **WHEN** コミットがmasterブランチへpushされる
- **THEN** Quality Gate workflow が自動で起動する

#### Scenario: master対象のpull requestで自動起動する

- **WHEN** masterブランチを対象とするpull request が開かれるか更新される
- **THEN** Quality Gate workflow が自動で起動する

#### Scenario: devへのpushでは自動起動しない

- **WHEN** コミットがdevブランチへpushされる
- **THEN** Quality Gate workflow は起動しない

### Requirement: 手動起動はworkflow_dispatchで行う

人が Quality Gate を起動するときは workflow_dispatch を使わなければならない（SHALL）。自動起動の起点を増やすためのトリガー追記をしない（MUST）。

#### Scenario: 手動で起動する

- **WHEN** workflow_dispatch で Quality Gate を起動する
- **THEN** workflow が1回実行される
