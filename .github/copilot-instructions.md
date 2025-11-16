# GitHub Copilot Instructions for Microtastic

## Project Context
Microtastic is a CLI tool for pure ES6 browser development. It bundles dependencies, runs a dev server, and builds production applications using Rollup.

## Code Style Requirements

### Formatting (Enforced by Biome)
- Use **tabs** for indentation (never spaces)
- Use **double quotes** for strings
- Unix line endings (LF)

### JavaScript Standards
- ES6+ syntax: classes, arrow functions, async/await, destructuring
- ES modules: `import`/`export` syntax only
- `const` over `let`, never `var`
- Template literals for string interpolation
- Functional array methods (`.map()`, `.filter()`, `.reduce()`)

### Architecture Patterns
- **Class-based design**: Group related functionality in classes (e.g., `Logger`, `FileManager`, `CommandHandler`)
- **Static methods**: For utility functions without instance state
- **Private methods**: Use `#` prefix (e.g., `#sendResponse`, `#log`)
- **Error handling**: Throw `MicrotasticError` with error codes
- **Async/await**: Always prefer over `.then()` chains

### Naming Conventions
```javascript
// Classes: PascalCase
class CommandHandler {}

// Constants: UPPER_SNAKE_CASE
const CONFIG = { PORT: 8181 };

// Variables/functions: camelCase
const loadSettings = () => {};
const appPkg = {};

// Private fields: # prefix
#log = () => {};

// Intentionally unused: _ prefix (but prefer removal)
const _unused = value;
```

### Error Handling Pattern
```javascript
throw new MicrotasticError(
	"Descriptive error message",
	"ERROR_CODE"
);

// Exit codes:
// 1 = known errors (MicrotasticError)
// 2 = unexpected errors
```

## Project Structure
- Entry point: `index.js` (single file architecture)
- Templates: `/template/`
- Service worker: `sw.tpl`

## Key Classes & Responsibilities
- `MicrotasticError`: Custom error with error codes
- `Logger`: Colored console output with debug mode
- `FileManager`: Recursive file operations (list, delete, copy)
- `DevServer`: HTTP server for development
- `CommandHandler`: Executes CLI commands (init, prep, dev, prod, version)
- `Microtastic`: Main entry point, initializes paths and settings

## Dependencies Policy
- **Minimize** external dependencies
- Prefer built-in Node.js modules: `node:fs`, `node:http`, `node:path`, `node:url`
- Current stack: Rollup + plugins (commonjs, node-resolve, terser, polyfill-node)

## CLI Commands
- `init`: Initialize project from template
- `prep`: Bundle dependencies from node_modules
- `dev`: Start development server
- `prod`: Build production bundle
- `version`: Display version

## Testing
- Unit tests in `/test/` directory using Node.js built-in test runner
- Run with `npm test`
- 35 tests covering all major classes
- Tests use Node.js built-in `node:test` module (no external dependencies)

## Best Practices
1. Keep functions **focused and single-purpose**
2. Use **descriptive variable names** (no abbreviations)
3. Comments only when intent isn't clear
4. **Validate inputs early** (fail fast principle)
5. **Clean up resources** (close Rollup bundles)
6. **Meaningful error messages** for CLI users

## Async Patterns
```javascript
// ✅ Good: async/await with try/catch
async function bundleDependencies() {
	try {
		const bundle = await rollup(config);
		await bundle.write(outputOptions);
		await bundle.close();
	} catch (error) {
		logger.error(`Build failed: ${error.message}`);
		throw error;
	}
}

// ❌ Bad: .then() chains
rollup(config)
	.then(bundle => bundle.write(outputOptions))
	.then(() => console.log("Done"));
```

## Important Notes
- This is a **CLI tool**, not a web application
- Focus on **developer experience** and clear error messages
- Keep codebase **simple and maintainable**
- Target: Node.js ES6 modules

## Technology Decisions

### Why Not Rolldown?
- Not ready for production (v1.0.0-beta.46)
- Built-in CommonJS produces default exports only (breaks named imports)
- `@rollup/plugin-commonjs` incompatible (incomplete plugin API)
- Track: https://github.com/rolldown/rolldown/issues/6269
- Revisit when stable v1.0.0 releases

## When Suggesting Code
1. Always use tabs for indentation
2. Always use double quotes
3. Prefer class methods over standalone functions
4. Use `#` for private methods
5. Include proper error handling with `MicrotasticError`
6. Use `async/await` consistently
7. Log with the `Logger` class, not `console.log`

