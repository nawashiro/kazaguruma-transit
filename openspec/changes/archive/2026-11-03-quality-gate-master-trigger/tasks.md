# Tasks

## 1. specの作成とYAMLとの一致確認

- [x] 1.1 `specs/quality-gate/spec.md` を delta 形式で作成する。検証: `openspec validate 2026-11-03-quality-gate-master-trigger` を通す。
- [x] 1.2 `quality-gate.yml` のトリガー（push:master・pull_request:master・workflow_dispatch）がspecの requirement どうりであることを目で確認する。workflow定義は変更しない。
