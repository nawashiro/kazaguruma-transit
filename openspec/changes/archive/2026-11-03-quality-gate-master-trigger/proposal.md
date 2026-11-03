# Proposal

## Why

CIの起動条件がworkflow定義とチームの運用決定の中にしかなく、specの世界から読み取れない（2026-11-03現在、`quality-gate.yml` のトリガーは push:master・pull_request:master・workflow_dispatch のみで、devへのpushで自動起動しないのはNawashiroの決定）。workflow定義の文言だけでは「dev push 直後にrunが無いのは意図どおり」なのか事故なのか区別できない。

## What Changes

- 新capability `quality-gate` を作り、Quality Gate の起動条件をspecに足す。自動起動はmaster起源のイベントに限ること、手動起動は workflow_dispatch で行うことを requirement にする。
- workflow定義（`quality-gate.yml`）は現在のまま変更しない。specが実装の起動条件を記述する。
- dev push後の workflow_dispatch 手動起動をしない運用はspecの対象から外す。人の判断であってworkflow定義では強制できないため、チームメモリの決定として残す。

## Capabilities

### ADDED Capabilities

- `quality-gate`: Quality Gate workflow の起動条件（master起源のイベントでの自動起動、workflow_dispatchによる手動起動）。

## Impact

- `openspec/changes/2026-11-03-quality-gate-master-trigger/`（このchangeのみ。実装ファイルには触れない）
