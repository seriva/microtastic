# Microtastic Agent Guide

# Part 1: Agent Workflow
> [!IMPORTANT]
> **IMMUTABLE SECTION:** Do not modify Part 1 unless explicitly instructed. This is a universal standard. Only adjust Part 2 (Project Context) for project-specific needs.

## 1. Context & Rules
- **Map:** Maintain the `## Project Map` section in Part 2 natively using "caveman" style (extreme density, no grammar, `->` for correlations). Update on changes.
- **Caveman Speak:** Communicate, plan, and write docs in "caveman" style (extreme semantic density, zero fluff, drop grammar/articles). Maximize token efficiency.
- **Docs-first:** Create `docs/vX.Y.Z/<feature>-plan.md` before coding non-trivial features.
- **TDD:** Write failing tests first for non-trivial logic.
- **Quality:** Run format/lint before commits. Update `CHANGELOG.md` & `README.md`.
- **Verify:** Run tests/compiler or ask user to visually verify before concluding. Never assume.
- **Blockers:** Stop and ask user on ambiguity; do not guess.

## 2. Git Standards
- **Branches:** `main` is releasable (no direct commits). Use `feat/` or `fix/` -> PR.
- **Commits:** Conventional Commits (`type(scope): subject`). Subject ≤72 chars, imperative mood. Body explains *why*.
- **Artifacts:** Never commit agent-generated session artifacts (e.g., plan checklists).

---

# Part 2: Project Context

## Project Identity
Microtastic is a Node.js CLI tooling package for pure ES6 browser development. It provides dependency bundling, a dev server with hot reload, and production builds — plus a signals-based reactivity system (`reactive.js`) for building UI components.

## Tech Stack
- **Runtime**: Node.js (ES modules)
- **Bundler**: Rolldown 1.0.0-rc.18
- **Linter/Formatter**: Biome 2.4.14
- **Test Runner**: Node.js built-in (`node --test`)
- **Package Manager**: npm (strictly — no yarn/pnpm)

## Architecture
All core CLI classes (`Logger`, `FileManager`, `DevServer`, `CommandHandler`, `Microtastic`) live in the single entry point `index.js`. The reactive system is extracted into `reactive.js` (imported via `"microtastic/reactive"`). Templates live in `/template/`, tests in `/test/`. Classes use `#`-prefixed private methods, `_`-prefixed module-level privates, PascalCase class names, camelCase functions/variables, and UPPER_SNAKE_CASE config constants.

## Core Rules & Anti-Patterns
- **Verify before done:** Always run `npm run check`, `npm test`, and `node index.js version` before completing any task.
- **ES modules only:** Use `import`/`export`, `async`/`await`, `const` over `let`, no `var`. No `.then()` chains.
- **Minimize dependencies:** Prefer built-in Node.js modules (`node:fs`, `node:http`, `node:path`, `node:url`).
- **Error Handling:** Throw `MicrotasticError` with descriptive messages and error codes; log via the `Logger` class.
- **No scattering logic:** CLI logic stays in `index.js`, reactivity stays in `reactive.js`.
- **Formatting:** Let Biome handle all formatting; never override its rules inline.
- **Comments:** No comments for obvious code. Only add comments when intent isn't clear.


## Project Map
[Map generated natively by agent]
