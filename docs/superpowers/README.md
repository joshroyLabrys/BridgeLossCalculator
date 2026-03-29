# Superpowers Workflow

This directory is the planning and design workspace for larger tasks.

## What goes where

- `plans/` stores implementation plans with executable steps and task tracking.
- `specs/` stores design specs, architecture notes, and UX decisions.
- `templates/` stores reusable plan and spec templates used by the repo helper scripts.

## Naming

- Use `YYYY-MM-DD-slug.md` for plans.
- Use `YYYY-MM-DD-slug-design.md` for specs.
- Keep the slug short, specific, and stable across follow-up work.

## When to create a plan

- Multi-file or multi-package work
- Work that benefits from checklists or staged validation
- Parallel or subagent-heavy implementation

## When to create a spec

- Workflow changes
- UI or UX redesign
- Architecture or shared-contract changes
- Any task where implementation should follow an agreed shape

## Helper commands

Run these from repo root:

```bash
pnpm plan:new -- --title "Feature Name"
pnpm spec:new -- --title "Feature Name"
```

Optional flags:

- `--slug custom-slug`
- `--date 2026-03-29`
- `--dry-run`

## Working style

- Keep plans action-oriented and implementation-ready.
- Link the plan to the matching spec whenever both exist.
- Use plans to break work into subagent-safe slices with clear ownership when parallel work will help.
