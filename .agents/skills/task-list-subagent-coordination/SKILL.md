---
name: task-list-subagent-coordination
description: "Delegate bounded tasks to subagents; parallelize safely."
version: 1.2.0
author: Nawashiro, Hermes Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [delegation, tasks, orchestration]
    related_skills: []
---

# Task-List Subagent Coordination

Use this skill when work follows an explicit task list and subagents are available. The parent agent is the coordinator, not the implementer or bulk reader.

## Procedure

1. **Resolve the task root from the repository tool, not memory.** Run the project’s prerequisite checker first (for Spec Kit, `.specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks`) and use its absolute `FEATURE_DIR`/document list. Do not infer a feature directory from a codename, an old task label, or a prior session. If a path lookup disagrees with the checker, stop path expansion and diagnose the actual tree before retrying.
2. Read only the task list, dependencies, repository rules, and the minimum state needed to assign work. Delegate implementation, investigation, and large-file reading. Check extension hooks and reviewer-owned checklists before implementation; never silently bypass an unchecked checklist or mandatory hook.
3. Select unblocked tasks. Prefer parallel delegation when writable paths are disjoint; isolate worktrees or paths to prevent collisions.
4. Assign each child exactly one bounded task ID with acceptance criteria, writable/frozen paths, required checks, and prohibited side effects. Include public-boundary behavior, not only the named source file, when the task must affect a build script, ignored deployment config, or package lifecycle.
5. For test-first work, enforce the hard gate: RED tests → independent fresh read-only test-code review with explicit `VERDICT: PASS` → production implementation → focused GREEN. A reviewer `VERDICT: FAIL` is a blocked gate, not partial approval: do not implement, mark complete, or reinterpret the scope. Dispatch a correction limited to the test bytes and its write boundary, rerun only the affected RED scope, then obtain a new fresh review; any test-byte change invalidates every earlier verdict. Before accepting PASS, check every acceptance criterion at the public boundary, including missing/error/startup paths—not only the happy-path helper contract.
5a. **Treat a direct user correction as a contract change, even when the existing specification or completed task says the opposite.** Stop using the stale acceptance boundary, classify the correction as scope/behavior/style/workflow, and reconcile the feature spec, plan, contracts, task list, and affected RED tests before production edits. For a semantic or accessibility correction, update both positive and negative assertions: remove obsolete prohibitions, add the requested public roles/states/keyboard behavior, and identify every old test that would fail after the corrected implementation. A prior review verdict does not cover changed test bytes; create a bounded correction RED task and obtain a fresh read-only review before implementation.
6. **After delegation, end the turn and wait. Do not implement, bulk-read, or perform follow-up work while waiting.** Treat the successful `delegate_task` dispatch as the end of the assistant turn: do not send a progress/status message, call `delegate_task(action='list')`, read live transcripts, or run unrelated tools while the batch is pending. Let the background completion re-enter the conversation. If a direct user correction arrives while a batch is pending, do not poll or continue the old plan: acknowledge it in the next task brief, steer the child only if the writable boundary remains safe, otherwise stop and re-dispatch the missing slice. When a child reports a failure, inspect the supplied transcript/output once, classify it as incomplete, environmental, or contract/design failure, and change strategy before retrying; never repeat an identical failing command five times.
7. **Treat child reports as trusted evidence for their bounded work, but require concrete exit codes, paths, and review verdicts. Do not infer GREEN from a module existing or from a passing typecheck alone. If a delegated reviewer contradicts an implementation report, follow the review finding and delegate a narrow correction or re-review task.**
8. The parent owns progress, final scope reconciliation, and external delivery. Keep commits, pushes, deployments, sends, and purchases with the parent unless explicitly assigned.
9. **Coordinator handoff is summary-only.** After a delegated child or review completes, consume its reported task ID, changed paths, exit codes, and verdict; do not read the child’s modified files, live transcript, or full summary to re-validate the work. If the report exposes a gap, dispatch a narrowly bounded correction/review task instead. Reserve parent-side reads for final reconciliation after the delegated implementation phase, not for rechecking a child’s handoff.

## Boundary-specific checks

- For build-time data/artifact work, make the public CLI resolve deployment config and output paths from its invocation `cwd`; a module import that statically resolves the repository root can make temporary-fixture build tests false positives. Test all configured URIs, source-specific transport/HTTP/JSON/shape failures, required and optional-field validation, duplicate IDs, atomic-write preservation, and runtime no-network behavior at the public boundary.
- For static-export HTTP servers and similar artifact-serving tasks, RED tests must exercise both the resolver and the real HTTP boundary: root/index, exact files, directory indexes, clean-URL mapping, missing and traversal-like paths, startup rejection when the artifact root is absent, and at least one representative MIME type. Run test collection plus the focused RED suite, obtain an independent `VERDICT: PASS`, then implement; any test-byte correction requires a fresh review.
- Before tightening a validator against a live source, inspect the wire data and existing schema/types. Count optional `null` values across the configured sources, compare them with the current loader contract, and clarify the spec before changing tests or production. If a policy changes, old RED-review verdicts no longer cover the changed test bytes; obtain a new fresh read-only review before production edits.
- Separate direct in-process validation from public JSON/HTTP lifecycle validation. JSON cannot represent `NaN` or `Infinity` (`JSON.stringify` turns them into `null`), so keep non-finite-number coverage at the direct generator/reader boundary and use JSON-representable invalid values at the public boundary. Do not make an accepted optional `null` fail merely because a transport fixture cannot preserve a non-JSON number; preserve the source value through generator and reader without sanitizing it.
- Treat a standard build failure and an alternate/sanitized probe as different evidence. Record the exact blocker and never report a substitute artifact or `next start` probe as proof that the standard release build succeeded. See `references/build-artifact-contract-debugging.md` for the reusable investigation and verification matrix.
- Keep tracked configuration templates and ignored deployment configuration coherent. If a build contract requires a new config key, assign the template, local ignored config, and package lifecycle integration explicitly rather than hiding the change in a generator helper.
- On recovery from a failed child, re-dispatch only the missing slice with the current file state as input. Preserve the original review boundary and prohibit unrelated test/spec/config edits.

## Verification

- Every delegated task has one task ID and a bounded read/write scope.
- Parallel tasks have non-overlapping write paths.
- Completion status follows the child report and real exit codes.
- Disputes are resolved by delegated review or correction, not parent rework.
- The final report names the resolved `FEATURE_DIR`, completed task IDs, focused/full verification, and any remaining release gate.

See `references/speckit-implementation-gates.md` for the compact gate/recovery checklist and public build-boundary test recipe.

For screenshot-based UI corrections, semantic/accessibility overrides, and visual/error-state verification, see `references/screenshot-driven-ui-contract-correction.md`.

For Next.js production-artifact browser verification and CI handoff, use `references/production-ui-ci-handoff.md`: isolate `.next` from concurrent dev/build processes, verify the fresh production artifact with a real browser interaction and DOM evidence, then distinguish local uncommitted results from the remote PR head and its GitHub Actions checks.
