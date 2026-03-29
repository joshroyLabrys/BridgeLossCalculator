# Repo Operating Contract

## Default posture

- Move fast and default to implementation.
- Ask for confirmation only when the user needs to make an executive decision: product direction, destructive operations, major tradeoffs, or ambiguous scope with real downstream cost.
- Prefer doing the next useful thing over handing work back.

## Project shape

- This repo is in a migration state.
- Prefer the monorepo path for new work:
  - `apps/web` is the preferred product shell.
  - `packages/engine`, `packages/data`, and `packages/ui` are the shared sources of truth.
- Treat `app/` as the legacy standalone app and reference implementation.
- If a feature exists in both `app/` and `apps/web`, update the monorepo path first unless the task explicitly targets legacy behavior or migration parity.

## Planning and specs

- Use `docs/superpowers/plans` for implementation plans.
- Use `docs/superpowers/specs` for design specs, UI specs, or larger technical decisions.
- Create or update a plan when the work is more than a small single-file change, spans multiple packages, or benefits from task tracking.
- Create or update a spec when the task changes architecture, UX, workflows, data contracts, or cross-cutting behavior.
- Use the helper commands from repo root:
  - `pnpm plan:new -- --title "Feature Name"`
  - `pnpm spec:new -- --title "Feature Name"`

## Execution defaults

- Start by reading the closest relevant docs before changing code:
  - root `README.md`
  - repo-level `AGENTS.md`
  - app-local `app/AGENTS.md`
  - app-local `apps/web/AGENTS.md`
- Prefer targeted tests and linters over full-suite runs unless the change is broad.
- Use parallel subagents for independent workstreams when it will materially speed up delivery.
- Give each subagent clear ownership of files or responsibilities.
- Keep worktree-based parallel work under `.worktrees/` when isolated branches are helpful.

## Validation shortcuts

- `pnpm dev:web`
- `pnpm test:web`
- `pnpm test:engine`
- `pnpm lint:web`
- `pnpm dev:legacy`
- `pnpm test:legacy`

## Framework notes

- `app/` and `apps/web/` use Next.js 16 and React 19.
- Before framework-level changes, read the relevant docs under `node_modules/next/dist/docs/`.
- Prefer shared package changes over duplicating engine, data, or UI logic inside app folders.

## Git hygiene

- Do not overwrite user changes you did not make.
- Expect a dirty tree.
- Keep generated planning artifacts in `docs/superpowers/`.
- Keep scratch work out of version control unless it is intentionally part of the workflow.
