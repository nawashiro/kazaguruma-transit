# Development Handoff

Last reviewed: 2026-07-09

## Default Branch

Use `dev` for normal development.

```bash
git switch dev
git pull --ff-only origin dev
```

`master` is the release branch. Start feature work from `dev`, then merge or open a PR back to `dev`. Promote `dev` to `master` only when preparing a release.

## One-command Start

From the repository root:

```bash
./scripts/start-work.sh
```

The script fetches remotes, switches to `dev`, fast-forwards it from `origin/dev`, installs dependencies with `npm ci` when needed, and generates the Prisma client.

## Spec Kit

This repository is initialized with the official GitHub Spec Kit CLI (`specify 0.12.8`) using the Codex integration.

Official project-local skills live in `.agents/skills/`:

```text
$speckit-specify
$speckit-plan
$speckit-tasks
$speckit-implement
$speckit-converge
```

Useful CLI checks:

```bash
specify --version
specify check
.specify/scripts/bash/create-new-feature.sh --dry-run --json --short-name example "Example feature"
```

Use `.specify/memory/constitution.md` as the project constitution. The repository keeps its customized constitution; Spec Kit generated scripts, templates, integration metadata, and workflow files are maintained under `.specify/`.

## Branch Inventory

| Branch | Status | Use |
| --- | --- | --- |
| `dev` / `origin/dev` | Current integration branch. Contains the former `008-document-discussion-spec` work and post-merge test/lockfile alignment. | Start here. |
| `master` / `origin/master` | Latest release branch, tagged `v1.1.1`. Behind `dev`. | Release baseline only. |

## Deleted Branches

Removed on 2026-07-09 after creating a local bundle checkpoint under `.git/branch-cleanup-backup-*.bundle`:

| Branch | Reason |
| --- | --- |
| `origin/008-document-discussion-spec` | Merged into `dev` at `105b5f6`; no separate branch needed. |
| `origin/007-migrate-ndk-nostr` | Detached experiment branch with several reverted NDK/discussion commits; not a development base. |
| `origin/006-migrate-nostr-ndk` | Older NDK migration experiment; not a development base. |
| `origin/dev-emergency` | Old hotfix branch superseded by later `dev` / `master` history. |

## Before Starting a Task

```bash
git status --short --branch
git switch dev
git pull --ff-only origin dev
git switch -c <type>/<short-task-name>
```

Recommended branch prefixes: `feat/`, `fix/`, `docs/`, `chore/`.

## Verification

Run these before calling a change ready:

```bash
npm run lint
npm test
npm run build
```

For narrower work, run focused Jest tests while iterating, then run the full checks before merge.
