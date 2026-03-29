---
name: repo-operating-framework
description: Bootstrap or upgrade a repository for fast, high-autonomy Codex work. Use when a user asks to prepare a repo for Codex, mirror a Claude Code workflow, add or align AGENTS.md and CLAUDE.md guidance, create reusable planning/spec scaffolding, install helpful global skills, or establish a repeatable repo operating framework that future Codex sessions can inherit.
---

# Repo Operating Framework

## Overview

Create the smallest durable framework that makes Codex effective immediately and keeps future repos from needing the same setup repeated by hand.

Prefer aligning with the repo's current patterns over introducing a parallel process.

## Audit first

Inspect the repo before changing anything:

- Check for existing `AGENTS.md`, `CLAUDE.md`, `.claude/`, `.superpowers/`, `.agents/`, `docs/`, and root package scripts.
- Identify whether the repo already has planning docs, worktree conventions, or subagent habits worth preserving.
- Check the global Codex setup for currently installed skills and obvious gaps.
- Preserve any Claude-compatible workflow that still adds value.

## Repo framework

Create or tighten the repo-level contract with these defaults:

1. Add a root `AGENTS.md` when the repo does not already have a good one.
2. If the user still uses Claude Code, add or align a root `CLAUDE.md` so both tools read the same workflow.
3. Add local `AGENTS.md` files only where framework-specific guidance matters, such as a Next.js app folder.
4. Document the preferred implementation target when the repo has multiple app paths or a migration in progress.
5. Keep the guidance concise, action-oriented, and specific to the repo.

## Planning and spec scaffolding

If the repo benefits from structured planning:

1. Reuse any existing planning folder if one already exists.
2. Otherwise create a small, obvious home for plans and specs.
3. Add reusable templates and helper scripts so plans do not need to be created manually each time.
4. Prefer naming conventions that are sortable by date and easy to grep.
5. Keep the docs workflow lightweight. The goal is speed and clarity, not ceremony.

Good defaults:

- plans for implementation sequencing and validation
- specs for architecture, UX, and scope decisions
- helper commands from repo root for creating new docs

## Global setup

Strengthen the global Codex environment when the user asks for a repeatable workflow across repos:

1. Install a practical baseline of broadly useful skills instead of every available skill.
2. Add a custom skill only when the user's workflow has repeatable patterns that should survive across repos.
3. Validate custom skills before copying them into the global skill directory.
4. Tell the user when a Codex restart is needed for newly installed skills.

## Working style defaults

When building the framework, encode these defaults unless the repo already has a better local convention:

- move fast and default to action
- ask only for executive direction, destructive actions, or major tradeoff choices
- use plans for multi-file or higher-risk work
- use subagents for parallelizable work with explicit ownership
- prefer targeted validation commands over full-suite runs
- preserve user changes and existing repo conventions

## Validation

Before finishing:

1. Run the minimal commands needed to confirm new scripts or templates work.
2. Validate any custom skill with the skill validator.
3. Summarize the new entry points, commands, and any restart requirement.
