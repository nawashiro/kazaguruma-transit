---
name: task-list-subagent-coordination
description: "Delegate bounded tasks to subagents; parallelize safely."
version: 2.0.0
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

## Rule

1. Prefer parallel delegation when writable paths are disjoint; isolate worktrees or paths to prevent collisions.
2. Assign each child exactly one bounded task ID with acceptance criteria, writable/frozen paths, required checks, and prohibited side effects.
3. Use a clean subagent context by default. Do not reuse a coder's or reviewer's context for a later delegation; pass only the task-scoped specification, constraints, and required evidence so prior assumptions do not contaminate the work.
4. For test-first work, enforce the hard gate: RED tests → independent fresh read-only test-code review with explicit `VERDICT: PASS` → production implementation → focused GREEN.
5. **After delegation, end the turn. Do not implement, bulk-read, or perform follow-up work while waiting.**
6. **Treat child reports as trusted evidence for their bounded work. but, If a delegated reviewer contradicts an implementation report, follow the review finding and delegate a narrow correction or re-review task.**
7. **Coordinator handoff is summary-only.** do not read the child’s modified files, live transcript, or full summary to re-validate the work. If the report exposes a gap, dispatch a narrowly bounded correction/review task instead. Reserve parent-side reads for final reconciliation after the delegated implementation phase, not for rechecking a child’s handoff.
