# Microtastic

Microtastic is a Node.js CLI tooling package for pure ES6 browser development. It provides dependency bundling, a dev server with hot reload, and production builds — plus a signals-based reactivity system (`reactive.js`) for building UI components.

## Tech Stack

- **Runtime**: Node.js (ES modules)
- **Bundler**: Rolldown 1.0.0-rc.18
- **Linter/Formatter**: Biome 2.4.14
- **Test Runner**: Node.js built-in (`node --test`)
- **Package Manager**: npm (strictly — no yarn/pnpm)

## Core Standards

1. **Biome is law** — All code must pass `npm run check`. Use tabs, double quotes, Unix line endings.
2. **Verify before done** — Always run `npm run check`, `npm test`, and `node index.js version` before completing any task.
3. **ES modules only** — Use `import`/`export`, `async`/`await`, `const` over `let`, no `var`.
4. **Minimize dependencies** — Prefer built-in Node.js modules (`node:fs`, `node:http`, `node:path`, `node:url`).
5. **Throw `MicrotasticError`** — Use descriptive messages and error codes; log via the `Logger` class.
6. **Docs-first.** Before implementing any non-trivial feature or breaking change, create `docs/vX.Y.Z/<feature>-plan.md` covering: Goal, Approach, Edge Cases, and Test Plan. Write the plan, get it right, then write code.

## Architecture

All core CLI classes (`Logger`, `FileManager`, `DevServer`, `CommandHandler`, `Microtastic`) live in the single entry point `index.js`. The reactive system is extracted into `reactive.js` (imported via `"microtastic/reactive"`). Templates live in `/template/`, tests in `/test/`. Classes use `#`-prefixed private methods, `_`-prefixed module-level privates, PascalCase class names, camelCase functions/variables, and UPPER_SNAKE_CASE config constants.

## Anti-Patterns

- **No `.then()` chains** — Always use `async`/`await`.
- **No `var`** — Use `const` by default, `let` only when reassignment is needed.
- **No scattering logic** — CLI logic stays in `index.js`, reactivity stays in `reactive.js`.
- **No comments for obvious code** — Only add comments when intent isn't clear from the code itself.
- **No manual formatting** — Let Biome handle all formatting; never override its rules inline.
- **No superpowers session artifacts** — checkbox-driven plan files and `docs/superpowers/` are session-local only; never commit them. Design docs belong in `docs/vX.Y.Z/<feature>-plan.md`.
