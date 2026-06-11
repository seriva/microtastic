# Microtastic Agent Guide

# Part 1: Agent Workflow
> [!IMPORTANT]
> **IMMUTABLE SECTION:** Do not modify Part 1 unless explicitly instructed. This is a universal standard. Only adjust Part 2 (Project Context) for project-specific needs.

## 1. Context & Rules
- **Caveman Speak & Map:** Communicate and maintain `## Project Map` natively using "caveman" style (extreme density, zero fluff, drop grammar, `->` for correlations). Update Map on changes. Exception: human-facing docs (`README`, `CHANGELOG`, plans) must remain readable.
- **Plan-first:** Create `docs/vX.Y.Z/<feature>-plan.md` & update roadmap for non-trivial (multi-component, arch-altering, risky) features.
- **TDD:** Write failing tests first for non-trivial logic (if applicable).
- **Quality:** Run format/lint before every commit. Update `CHANGELOG.md` & `README.md` before PR.
- **Verify:** Run tests/compiler or ask user to visually verify before concluding/PR. Never assume.
- **Blockers:** Stop and ask user on ambiguity; do not guess.
- **Scope:** Stick strictly to requested task/plan. No unrequested features/refactoring.
- **Dependencies:** Use existing packages/standard lib. Ask before adding new dependencies.
- **Stuck:** If same approach fails twice, stop and ask user. Do not retry blindly.
- **Code Preservation:** Do not delete existing comments, docstrings, or unrelated code unless explicitly instructed.

## 2. Git Standards
- **Branches:** `main` is releasable. Use `feat/` or `fix/` -> PR. Trivial fixes (typos, comments) may commit directly to `main`.
- **Commits:** Conventional Commits (`type(scope): subject`). Subject ≤72 chars, imperative mood. Body explains *why*. One logical change per commit.
- **Artifacts:** Never commit temporary agent session files (e.g., scratchpads, task checklists). Official feature plans should be committed.
- **Security:** Never commit secrets/API keys. Ensure `.env` is gitignored.
- **Self-Review:** Review `git diff` before commit. Strip debug logs/stray changes.

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
