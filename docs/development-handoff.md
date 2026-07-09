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

## Branch Inventory

| Branch | Status | Use |
| --- | --- | --- |
| `dev` / `origin/dev` | Current integration branch. Contains `008-document-discussion-spec` and post-merge test/lockfile alignment. | Start here. |
| `master` / `origin/master` | Latest release branch, tagged `v1.1.1`. Behind `dev`. | Release baseline only. |
| `origin/008-document-discussion-spec` | Merged into `dev` at `105b5f6`. | Historical reference. Do not start new work here. |
| `origin/007-migrate-ndk-nostr` | Detached work branch with several reverted NDK/discussion experiments. Not merged into `dev`. | Historical reference only unless a specific commit is intentionally cherry-picked after review. |
| `origin/006-migrate-nostr-ndk` | Older NDK migration experiment. Not merged into `dev`. | Historical reference only. |
| `origin/dev-emergency` | Old security hotfix branch. Its useful changes are superseded by later release/dev history unless proven otherwise. | Historical reference only. |

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
