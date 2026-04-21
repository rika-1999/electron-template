---
name: agents-md-generator
description: Create or update minimal AGENTS.md files in repository root and nested module directories. Uses progressive disclosure to keep documentation concise.
---

# AGENTS.md Generator

## Goal

Generate concise AGENTS.md files: root (≤80 lines) and modules (≤60 lines).
Push details to `docs/`, keep AGENTS.md as high-signal navigation hub.

## When to Run

- AGENTS.md is missing, bloated, or outdated
- New package/service/module appears
- Repository structure changes

## Workflow

### 1. Discover

- Identify repo root (git root or cwd)
- Detect stack: `package.json`, `go.mod`, `pyproject.toml`, `Cargo.toml`, etc.
- Locate existing docs: `docs/`, `README.md`, existing AGENTS.md/AGENTS.md

### 2. Detect Modules

Create nested AGENTS.md for directories that have **independent package manifests** (`package.json`, `go.mod`, `pyproject.toml`, etc.) or separate deployment (`Dockerfile`, independent CI).

Skip: `utils/`, `helpers/`, `shared/`, `tests/`, `config/`, `docs/`

### 3. Extract Commands

Extract ONLY from source files (package.json scripts, Makefile targets, CI config). Never guess.
If missing: write `"see <file>"` or `"needs setup"`.

### 4. Update Strategy

- No AGENTS.md → create from template
- Has `<!-- MANUAL -->` markers → preserve those sections, regenerate rest
- Manually edited without markers → ask user before overwriting

## Root Template

```markdown
# AGENTS.md

## What this repo is

<ONE SENTENCE PURPOSE>

## Universal Tooling

- Stack: <languages/frameworks>
- Package/Build System: <tool>
- Primary Docs: [README.md](./README.md)

## Commands

| Command       | Description       |
| ------------- | ----------------- |
| `<build>`     | Production build  |
| `<test>`      | Run tests         |
| `<lint>`      | Lint and auto-fix |
| `<typecheck>` | Type checking     |

## Key Singletons / Architecture

| Name | Location | Purpose |
| ---- | -------- | ------- |
| ...  | ...      | ...     |

## Progressive Disclosure

- [Architecture](./docs/architecture.md) — Project structure and patterns
- [Code Style](./docs/code-style.md) — Naming, formatting conventions

## Agent Configuration

- Path alias: `@/*` maps to `src/`
- Project-specific skills: `.Codex/skills/` (auto-discovered)
```

## Module Template

```markdown
# AGENTS.md (Module: <name>)

## What this module is

<ONE SENTENCE PURPOSE>

## Tooling

- Stack: <language/framework>
- Build System: <tool>

## Commands

- Build: `<command>`
- Test: `<command>`
- Dev: `<command>`

## References

- Local Docs: [link](./path)

---

[← Back to Root](../AGENTS.md)
```

## Rules

1. Extract commands from source files only, never guess
2. Use relative paths for all links
3. Preserve `<!-- MANUAL -->` sections on update
4. If AGENTS.md exists with content → migrate to AGENTS.md, convert AGENTS.md to link file:

```markdown
→ [AGENTS.md](./AGENTS.md)
```

5. Verify links exist, remove broken ones
6. Keep security warnings and critical setup instructions
