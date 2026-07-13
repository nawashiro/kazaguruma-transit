#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

echo "Fetching remotes..."
git fetch --all --prune

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Working tree has uncommitted changes. Commit or stash them before switching branches." >&2
  git status --short --branch
  exit 1
fi

echo "Switching to dev..."
git switch dev

echo "Fast-forwarding dev from origin/dev..."
git pull --ff-only origin dev

if [ ! -d node_modules ] || [ package-lock.json -nt node_modules ]; then
  echo "Installing dependencies with npm ci..."
  npm ci
fi

echo "Generating Prisma client..."
npm run prisma:generate

echo
git status --short --branch
echo
echo "Ready. Create a task branch with: git switch -c <type>/<short-task-name>"
