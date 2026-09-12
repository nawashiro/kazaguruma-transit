# 開発ワークフロー

この手順は、`dev`から始めてOpenSpecで計画し、検証済みのPull Requestを作る流れを示します。

## 手順の順序

次の順序を守ります。

`dev` → 作業branch → OpenSpec proposal → spec → design → tasks → 実装 → 検証

### 1. devから作業branchを作る

変更前に状態を確認し、`dev`を更新してから作業branchを作ります。

```bash
git status --short --branch
git switch dev
git pull --ff-only origin dev
git switch -c docs/<short-task-name>
```

通常のprefixは`feat/`、`fix/`、`docs/`、`chore/`です。未コミットの変更を残したままbranchを切り替えません。

### 2. OpenSpecのproposalを作る

現行CLIは`@fission-ai/openspec`です。リポジトリのOpenSpec設定は`openspec/config.yaml`です。

```bash
npx -y @fission-ai/openspec@latest new change "<lowercase-kebab-name>"
npx -y @fission-ai/openspec@latest status --change "<lowercase-kebab-name>" --json
```

変更の計画資料は次の場所に置きます。

```text
openspec/changes/<change-name>/proposal.md
openspec/changes/<change-name>/specs/<capability>/spec.md
openspec/changes/<change-name>/design.md
openspec/changes/<change-name>/tasks.md
```

### 3. proposal、spec、design、tasksを作る

次の順で資料を作ります。

1. `proposal.md`に目的、変更範囲、非目標を記載します。
2. `specs/`の`spec.md`に検証可能な要件とScenarioを記載します。
3. `design.md`に実装方針、境界、リスクを記載します。
4. `tasks.md`に依存関係を含む実装単位を記載します。

各資料のテンプレートと依存関係は次で確認します。

```bash
npx -y @fission-ai/openspec@latest instructions proposal --change "<change-name>" --json
npx -y @fission-ai/openspec@latest instructions specs --change "<change-name>" --json
npx -y @fission-ai/openspec@latest instructions design --change "<change-name>" --json
npx -y @fission-ai/openspec@latest instructions tasks --change "<change-name>" --json
```

`tasks.md`を作る前に、次の正本と実体を参照します。

- [constitution](../reference/constitution.md)
- [writing-style](../reference/writing-style.md)
- [technology-stack](../reference/technology-stack.md)
- 変更対象の`src/`、`scripts/`、設定、生成物
- 対応する`__tests__/`と`.test.ts`、`.test.tsx`
- `.github/workflows/quality-gate.yml`

OpenSpecの成果物は日本語で書きます。構造見出しと`SHALL`、`MUST`はCLIの形式を維持します。

## 実装

承認済みの`tasks.md`だけを実装します。実装、設定、テスト、workflow、生成物を照合します。生成artifactを直接編集せず、入力と生成コマンドを更新します。

## 変更前の検証

設定ファイルと依存関係を準備した後、変更前の状態で次を実行します。

```bash
npm ci
npm run lint
npx tsc --noEmit --incremental false
npm run build
npm test -- --runInBand --ci
git diff --check
```

`npm run build`は場所データartifactと本番buildを生成します。`app-config.json`と`transit-config.json`を先に用意します。

## 変更後の検証

実装後に次を実行します。

```bash
npm run lint
npx tsc --noEmit --incremental false
npm run build
npm test -- --runInBand --ci
npx -y @fission-ai/openspec@latest validate --all --json
git diff --check
git status --short --untracked-files=all
git diff --name-status
```

`git diff --check`の警告を残しません。OpenSpecの`status`は計画資料の状態を示すため、task checkbox、差分、実行結果も確認します。

## Pull Request後の確認

`.github/workflows/quality-gate.yml`は`dev`または`master`を対象に実行します。workflowはNode.js 22.xを準備し、次を順に実行します。

1. `app-config.json.example`から一時的な`app-config.json`を作ります。
2. `npm ci`を実行します。
3. `npm run lint`を実行します。
4. `npx tsc --noEmit --incremental false`を実行します。
5. `npm run build`を実行します。
6. production serverをport 3100で起動します。
7. `npm test -- --runInBand --ci`を実行します。
8. serverを停止します。

Pull RequestのChecksで、最新commitに対する`Quality Gate`の終了状態が成功であることを確認します。新しいcommitをpushした後は、古いCheckを成功扱いにしません。
