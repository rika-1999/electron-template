---
name: commit
description: Use when user requests to commit and push changes to git repository
---

# Committing Changes

## Overview
Structured git commit with required commands, message prefixes, and quality standards.

## When to Use
- User says "commit", "提交代码", "save changes", or similar
- User applies time pressure ("we're in a hurry")
- Multiple files need committing together

**Do NOT use:**
- User asks what to commit (show git status)
- User asks for commit history review
- User is reviewing changes (show git diff, don't commit)

## Core Pattern

### Before (baseline - generic message)
```bash
git commit -m "add test files"
```

### After (structured - specific and explains WHY)
```bash
git commit -m "docs: reorganize AGENTS.md and extract singletons to separate doc

- Add project notes section with automation preferences
- Extract key singletons to dedicated docs/singletons.md"
```

## Quick Reference

| Prefix | When to Use |
|--------|-------------|
| `docs:` | Documentation files, README, guides |
| `feat:` | New features, functionality additions |
| `fix:` | Bug fixes, issue resolutions |
| `chore:` | Maintenance, dependencies, cleanup |
| `refactor:` | Code restructuring without behavior change |
| `test:` | Test additions or modifications |
| `ci:` | CI/CD configuration, build scripts |
| `ignore:` | WIP or temporary changes |
| `wip:` | Work in progress |

## Implementation

### Required Commands (always parallel)
```bash
git status && git diff && git diff --cached && git status --short
```

### Commit Message Format
```
<prefix>: <brief description>

<optional detailed explanation>
```

**Rules:**
- Prefix required (see table)
- Lowercase after prefix
- Explain WHY, not WHAT (end-user perspective)
- Be specific (no "improved agent experience")
- Use `docs:` for packages/web changes

### Conflict Handling
**STOP if conflicts:**
- Do NOT fix conflicts
- Notify: "Merge conflicts detected. Please resolve manually."
- Show `git status` with conflict files

### Push Process
```bash
git add <files> && git commit -m "<formatted message>" && git push
```

If behind, pull first:
```bash
git pull --rebase
# Then commit and push
```

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| "improved agent experience" | Be specific: "add agent response caching" |
| "fixed bug" | Specify: "fix: resolve race condition in service registry" |
| No prefix | Add appropriate prefix from table |
| Generic "update file" | Explain impact: "docs: update API reference for v2.0" |

## Rationalization Table

| Excuse | Reality |
|--------|---------|
| "Too simple to need prefix" | Prefix provides context and searchable history |
| "Time pressure - just use generic" | Specific message saves debugging time later |
| "Already pulled, don't need diff" | Diff confirms what's being committed |
| "Conflicts look simple, I'll fix" | Manual fixes prevent incorrect merges |
| "User said 'quickly', skip quality" | Quick bad commits = slow debugging later |

**All of these mean: Follow the process. Quality takes seconds, debugging takes hours.**
