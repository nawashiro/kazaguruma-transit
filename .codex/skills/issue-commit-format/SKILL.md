---
name: issue-commit-format
description: Review git diff and create commits using issue-linked subject format with a detailed body. Use when the user asks to commit with a specific issue number and a required subject pattern like '#<issue> <prefix>: <descriptive English message>'.
---

# Issue Commit Format

Use this workflow to commit changes with a strict issue-linked message format.

## Inputs

- Require an issue number argument.
- Require a prefix token such as `feat`, `fix`, `chore`, `docs`, `refactor`, or `test`.

## Workflow

1. Inspect staged and unstaged changes with `git status --short` and `git diff`.
2. Summarize what changed and red-team for accidental files.
3. Stage only intended files.
4. Create commit subject in this exact pattern:
`#<issue-number> <prefix>: <descriptive English commit message>`
5. Add a detailed commit body describing:
- What changed
- Why it changed
- Scope/impact
- Any constraints or follow-ups
6. Run `git show --stat --oneline -1` to verify commit content.

## Guardrails

- Never commit unrelated files unless user explicitly asks.
- Keep subject line in English.
- Keep body concrete and tied to actual diff.
- If issue number is missing, ask for it before committing.
