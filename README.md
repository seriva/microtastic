## About

Microtastic is a tiny (~1,200 line) development environment that combines the best ideas from [Snowpack](https://www.snowpack.dev/)'s unbundled development workflow with signals-based reactivity inspired by libraries like [SolidJS](https://www.solidjs.com/), [Alpine.js](https://alpinejs.dev/), and [Preact Signals](https://preactjs.com/guide/v10/signals/). The result is a lightweight, opinionated toolchain for building browser applications in pure ES6 without the overtooling and dependency hell of complex build systems.

Like **Snowpack**, Microtastic uses [Rollup](https://rollupjs.org/) to convert CommonJS and multi-file ES6 modules into single-file ES6 modules during development. These can be imported directly in the browser without rebundling on every change, enabling fast development cycles. For production builds, Rollup handles bundling with tree-shaking and code-splitting to create optimized output.

Microtastic includes **reactive.js**, a signals-based reactive state management library that brings together the fine-grained reactivity of **SolidJS**-style signals, the declarative data-attribute bindings of **Alpine.js**, and the template literal approach of libraries like **Lit**. This gives you a complete reactive development experience without heavy frameworks.

## Features

- **Lightweight**: Only ~1,200 lines of code
- **ES6 Native**: Pure ES6 development without complex toolchains
- **Fast Development**: Unbundled development workflow with hot reload support
- **Asset Management**: Automatic copying of fonts, CSS, and other assets from `node_modules`
- **Simple Dev Server**: Lightweight development server for serving static files
- **Production Ready**: Optimized builds with tree-shaking and code-splitting
- **Reactive Framework**: Built-in signals-based reactive state management with fine-grained reactivity
- **Advanced Debugging**: Named signals, debug mode, and `peek()` for non-tracking reads
- **Circular Dependency Detection**: Prevents infinite loops in computed signals
- **Code Quality**: Biome linter and formatter installed by default
- **Dev Container**: VS Code devcontainer configuration included for consistent development environment
- **Opinionated**: Simple project structure and workflow

**Tech Stack:**
- JavaScript (ES6) with Rollup for bundling
- Signals-based reactivity (inspired by SolidJS, Alpine.js, Preact Signals)
- Minimal external dependencies

## Quick Start

### Bootstrap a New Application

1. Generate a new npm package/project:
```bash
npm init
```

2. Install Microtastic as a dev dependency:
```bash
npm install microtastic --save-dev
```

3. Run `microtastic init` to bootstrap the application template:
```bash
npx microtastic init
```

The `init` command creates a project structure with:
- `app/src/main.js` - Your application entry point
- `app/index.html` - HTML template
- `.microtastic` - Configuration file
- `biome.json` - Biome linter and formatter configuration
- `.devcontainer/` - VS Code devcontainer setup for consistent development environment
- Adds necessary npm scripts to `package.json`
- Installs `@biomejs/biome` as a dev dependency for linting and code quality

You can add your code in `app/src/` with `main.js` as the main entry point. Any other resources (CSS, images, etc.) can be added anywhere in the `app/` directory.

### Development

Microtastic has a built-in development server which can be started with:

```bash
npm run dev
```

The dev server starts on `localhost:8181` (configurable via `.microtastic`). With hot reload enabled (default), the browser automatically refreshes when files in the `app/` directory change.

Since pure ES6 is used, you can open and debug applications in modern browsers that support ES6 modules. See [Browser Compatibility](#browser-compatibility) for details.

### Production Build

You can prepare the bundled application by running:

```bash
npm run prod
```

This will bundle and optimize your code and put the application ready to publish in the `public/` folder.

### Preparing Dependencies

Before running the dev server or production build, you need to prepare your dependencies. This converts CommonJS modules from `node_modules` into ES6 modules that can be imported in the browser:

```bash
npm run prepare
```

Or directly:

```bash
npx microtastic prep
```

This command:
- Bundles all dependencies from `package.json` into ES6 modules
- Places them in `app/src/dependencies/`
- Copies assets defined in `assetCopy` (see [Asset Copying](#asset-copying))

**Note:** The `init` command automatically adds a `prepare` script to your `package.json` that runs before `npm install`, so dependencies are prepared automatically when you install packages.

### Development Environment

Microtastic includes a complete development environment setup out of the box:

#### VS Code Dev Container

The template includes a `.devcontainer/` configuration for VS Code that provides:
- **Consistent Environment**: Node.js 22 in a Docker container
- **Pre-configured Extensions**: Biome and ES6 string HTML syntax highlighting
- **Auto-formatting**: Biome configured as the default formatter with auto-fix on save
- **Port Forwarding**: Development server port (8181) automatically forwarded

To use the dev container:
1. Open the project in VS Code
2. When prompted, click "Reopen in Container" (or use Command Palette: "Dev Containers: Reopen in Container")
3. VS Code will build the container and install dependencies automatically

#### Biome Linter & Formatter

Biome is installed automatically during `microtastic init` and configured for:
- **Linting**: Code quality checks with recommended rules
- **Formatting**: Consistent code style (tabs, double quotes)
- **Import Organization**: Automatic import sorting on save (in dev container)

The `biome.json` configuration file is included in the template and targets files in `app/src/` (excluding the `dependencies/` directory).

**Available Biome commands:**
```bash
npm run check    # Lint and check code
npx biome check  # Run linter
npx biome format # Format code
```

In the VS Code dev container, Biome automatically formats and organizes imports on save.

## CLI Commands

Microtastic provides the following CLI commands:

- `microtastic init` - Initialize a new project from template
- `microtastic prep` - Bundle dependencies from `node_modules` to ES6 modules
- `microtastic dev` - Start the development server
- `microtastic prod` - Build production bundle
- `microtastic version` - Display version information

These commands are typically run via npm scripts (see below), but can also be executed directly with `npx microtastic <command>`.

### NPM Scripts

The `init` command automatically adds these scripts to your `package.json`:

```json
{
  "scripts": {
    "prepare": "microtastic prep",
    "dev": "microtastic dev",
    "dependencies": "microtastic prep",
    "prod": "microtastic prod",
    "format": "biome format --write .",
    "check": "biome check ."
  }
}
```

- `npm run prepare` - Prepares dependencies (runs automatically after `npm install`)
- `npm run dev` - Starts the development server
- `npm run dependencies` - Alias for `prepare`
- `npm run prod` - Builds the production bundle
- `npm run format` - Formats code with Biome (auto-installed)
- `npm run check` - Lints and checks code with Biome

## Configuration

### Microtastic Settings

You can create a `.microtastic` file in the root of your project and add and change the following configurations:

```json
{
    "genServiceWorker": false, // Experimental feature that generates an offline-mode service worker. Mainly written for private projects and will need additional code from the application side to work.
    "minifyBuild": true, // If Rollup need to minimize the application
    "serverPort": 8181, // Port the debug server is running on.
    "hotReload": true // Enable hot reload in development server. Automatically reloads the page when files in the app directory change.
}
```

### Asset Copying

Microtastic can automatically copy assets (fonts, CSS files, images, directories, etc.) from `node_modules` to your app directory during the `prep` phase. Add an `assetCopy` array to your `package.json`:

```json
{
  "assetCopy": [
    {
      "source": "node_modules/@fontsource/raleway/files/raleway-latin-400-normal.woff2",
      "dest": "app/fonts/raleway-latin-400-normal.woff2"
    },
    {
      "source": "node_modules/prismjs/themes/prism.min.css",
      "dest": "app/css/prism-themes/prism.min.css"
    },
    {
      "source": "node_modules/some-package/assets",
      "dest": "app/vendor/some-package-assets"
    }
  ]
}
```

Each asset entry requires:
- **source**: Path to the file or directory in `node_modules` (relative to project root)
- **dest**: Destination path in your app (relative to project root)

**Supported operations:**
- **Files**: Individual files are copied to the destination path
- **Directories**: Entire directories are copied recursively to the destination path

Assets are copied when running `npm run prepare` or `microtastic prep`. Destination directories are created automatically if they don't exist.

## Browser Compatibility

Microtastic targets modern browsers that support ES6 modules. This includes:

- **Chrome/Edge**: 61+ (ES modules support)
- **Firefox**: 60+ (ES modules support)
- **Safari**: 10.1+ (ES modules support)
- **Opera**: 48+ (ES modules support)

For production builds, you may need to add polyfills for older browsers if you use modern JavaScript features. The development server works best with the latest versions of Chrome, Firefox, or any browser with full ES6 module support.

## Reactive.js

Microtastic includes **reactive.js**, a lightweight signals-based reactive state management library with declarative binding. It provides everything you need to build reactive applications without heavy frameworks.

**Quick Start:**

```javascript
import { Signals, Reactive, html, css } from './reactive.js';
```

For detailed examples, see the [Examples](#examples) section below.

### Signals

Signals are reactive primitives that track dependencies and update subscribers automatically.

#### `Signals.create(value, equals?, name?)`

Creates a signal with an initial value. Optionally provide a custom equality function and a name for debugging.

```javascript
const count = Signals.create(0);
const user = Signals.create({ name: "Alice", age: 30 });

// Custom equality for arrays
const items = Signals.create([], (a, b) => 
	a.length === b.length && a.every((x, i) => x === b[i])
);

// Named signals for debugging
const counter = Signals.create(0, undefined, "userCounter");
console.log(counter.toString()); // "Signal(userCounter)"
```

**Signal Methods:**
- `signal.get()` - Read value (tracks dependencies in computed contexts)
- `signal.peek()` - Read value without tracking dependencies
- `signal.set(value)` - Update value
- `signal.update(fn)` - Update using function: `signal.update(n => n + 1)`
- `signal.subscribe(fn)` - Subscribe to changes, returns unsubscribe function
- `signal.once(fn)` - Subscribe for one notification only
- `signal.subscribeInternal(fn)` - Internal subscription (doesn't call immediately)
- `signal.toString()` - Get readable string representation

#### `Signals.computed(fn, name?)`

Creates a computed signal that automatically tracks dependencies and recomputes when they change. Optionally provide a name for debugging. Includes circular dependency detection to prevent infinite loops.

```javascript
const firstName = Signals.create("Alice", undefined, "firstName");
const lastName = Signals.create("Smith", undefined, "lastName");
const fullName = Signals.computed(
	() => `${firstName.get()} ${lastName.get()}`,
	"fullName"
);

// Automatically updates when firstName or lastName changes
fullName.subscribe(name => console.log(name)); // "Alice Smith"

// Use peek() to read without creating dependencies
const logValue = Signals.computed(() => {
	const val = fullName.peek(); // No dependency created
	console.log("Current value:", val);
	return val;
});

// Clean up when done
fullName.dispose();
logValue.dispose();
```

**Circular Dependency Protection:**
Computed signals detect circular dependencies and throw descriptive errors:

```javascript
// This throws: "Circular dependency detected: a -> b -> a"
const a = Signals.computed(() => b.get() + 1, "a");
const b = Signals.computed(() => a.get() + 1, "b");
```

#### `Signals.computedAsync(fn, name?)`

Creates an async computed signal that handles asynchronous operations like API calls. The signal value is an object with `{ status, data, error, loading }` properties. Automatically cancels previous executions when dependencies change.

```javascript
const userId = Signals.create(1, undefined, "userId");

const userData = Signals.computedAsync(async (cancelToken) => {
	const id = userId.get();
	const response = await fetch(`/api/users/${id}`);
	
	// Check if this execution was cancelled
	if (cancelToken.cancelled) return null;
	
	return response.json();
}, "userData");

// Access state properties
userData.subscribe(state => {
	console.log(state.status);  // "pending" | "resolved" | "error"
	console.log(state.loading);  // true | false
	console.log(state.data);     // resolved data or previous data
	console.log(state.error);    // error object if status is "error"
});

// When userId changes, previous fetch is cancelled automatically
userId.set(2);

// Clean up
userData.dispose();
```

**Cancellation:** When dependencies change, the previous async execution is automatically cancelled via the `cancelToken.cancelled` flag. This prevents race conditions and ensures only the latest result is used.

**Error Handling:** Errors are captured in the state object. Previous data is preserved when errors occur, allowing graceful degradation.

#### `Signals.batch(fn)`

Batches multiple updates into a single update cycle for better performance.

```javascript
Signals.batch(() => {
	count.set(1);
	count.set(2);
	count.set(3);
	// Subscribers only notified once after batch completes
});
```

### Debugging Features

#### Signal Names

Signals and computed signals can be named for better debugging:

```javascript
const userCount = Signals.create(0, undefined, "userCount");
const doubled = Signals.computed(() => userCount.get() * 2, "doubled");

console.log(userCount.toString()); // "Signal(userCount)"
console.log(doubled.toString());   // "Signal(doubled)"
```

Named signals appear in debug logs and error messages, making it easier to track down issues in complex reactive applications.

#### Debug Mode

Enable debug mode to log all signal updates and computed recalculations:

```javascript
import { setDebugMode } from './reactive.js';

setDebugMode(true); // Enable debug logging

const count = Signals.create(0, undefined, "counter");
count.set(5); // Logs: [Reactive] Signal updated: [counter] 0 -> 5

const doubled = Signals.computed(() => count.get() * 2, "doubled");
count.set(10); // Logs: [Reactive] Computed updated: [doubled] 20
```

#### Reading Without Tracking

Use `peek()` to read signal values without creating dependencies:

```javascript
const count = Signals.create(0);
const doubled = Signals.computed(() => count.get() * 2);

// Read without tracking - won't recompute if doubled changes
const logger = Signals.computed(() => {
	console.log("Current doubled value:", doubled.peek());
	return count.get(); // Only depends on count
});
```

This is useful for logging, debugging, or conditional logic where you don't want to create reactive dependencies.

### HTML Templates

#### `html` (Tagged Template Literal)

Creates safe HTML with automatic XSS protection. All interpolated values are escaped by default.

```javascript
const name = "Alice";
const userInput = "<script>alert('xss')</script>";

const template = html`
	<div>
		<h1>Hello, ${name}!</h1>
		<p>${userInput}</p> <!-- Automatically escaped -->
	</div>
`;
```

**Features:**
- Automatic XSS protection via escaping
- Supports nested `html` templates
- Returns object with `__safe: true` and `content` property

#### `trusted(content)`

Marks content as trusted (bypasses escaping). Use with caution!

```javascript
import { html, trusted } from './reactive.js';

const safeHtml = trusted("<strong>Bold</strong>");
const template = html`<div>${safeHtml}</div>`;
```

#### `join(items, separator?)`

Joins an array of items (which can include `html` templates) with optional separator.

```javascript
import { html, join } from './reactive.js';

const items = [
	html`<li>Item 1</li>`,
	html`<li>Item 2</li>`,
	html`<li>Item 3</li>`
];
const list = html`<ul>${join(items)}</ul>`;
```

### CSS-in-JS

#### `css` (Tagged Template Literal)

Creates scoped CSS styles with automatic class name generation. Styles are injected into the document head.

```javascript
const buttonStyle = css`
	background: blue;
	color: white;
	padding: 10px 20px;
	border: none;
	border-radius: 4px;
	
	&:hover {
		background: darkblue;
	}
	
	.child {
		font-size: 12px;
	}
`;

// Returns a class name like "s-abc123"
const button = html`<button class="${buttonStyle}">Click me</button>`;
```

**Features:**
- Automatic scoping (styles prefixed with generated class)
- `&` selector refers to the component root
- Child selectors are automatically scoped
- Root-level properties are wrapped in the component class
- Styles are cached (same CSS returns same class name)

### Reactive Bindings

#### `Reactive.mount(element, fn)`

Mounts a reactive template to an element. The function is called whenever dependencies change.

```javascript
const count = Signals.create(0);
Reactive.mount(document.body, () => html`
	<div>Count: ${count.get()}</div>
`);

// Returns { update } object to manually trigger updates
const { update } = Reactive.mount(element, fn);
```

#### Manual Bindings

```javascript
// Bind text content
Reactive.bindText(element, signal);

// Bind innerHTML with transformation
Reactive.bind(element, signal, (val) => html`<strong>${val}</strong>`);

// Bind attributes
Reactive.bindAttr(element, "href", signal);
Reactive.bindBoolAttr(element, "disabled", signal);
Reactive.bindClass(element, "active", signal);

// All return unsubscribe functions
const unsubscribe = Reactive.bindText(element, signal);
```

#### `Reactive.scan(rootElement, scope)`

Scans an element tree for declarative `data-*` bindings and sets them up. Returns cleanup function.

```javascript
const scope = {
	count: Signals.create(0),
	increment: () => count.update(n => n + 1)
};

const cleanup = Reactive.scan(document.body, scope);
// Later: cleanup();
```

### Declarative Bindings

Use `data-*` attributes in HTML for reactive bindings. Works with `Reactive.scan()`:

#### Basic Bindings

```html
<!-- Text content -->
<div data-text="count"></div>

<!-- InnerHTML (supports html templates, recursively scans children) -->
<div data-html="message"></div>

<!-- Show/hide element -->
<div data-visible="isVisible">Content</div>

<!-- Two-way form binding (works with signals that have .set()) -->
<input type="text" data-model="username" />
```

#### Attribute Bindings

```html
<!-- Any attribute -->
<a data-attr-href="url" data-attr-target="target">Link</a>

<!-- Boolean attribute (adds/removes) -->
<button data-bool-disabled="isDisabled">Submit</button>

<!-- Toggle CSS class -->
<div data-class-active="isActive">Item</div>
```

#### Event Handlers

```html
<!-- Event handler (called with event object, scope as this) -->
<button data-on-click="increment">Click me</button>
<input data-on-keydown="handleKeydown" />
```

#### Element References

```html
<!-- Creates reference in Component's this.refs -->
<input data-ref="usernameInput" />
```

**In Components:**
```javascript
// Access via this.refs
this.refs.usernameInput.value;
```

### Components

Class-based components with lifecycle management and automatic cleanup.

#### Basic Component

```javascript
class Counter extends Reactive.Component {
	state() {
		return {
			count: 0,
			label: "Count"
		};
	}
	
	styles() {
		return css`
			padding: 20px;
			border: 1px solid #ccc;
			border-radius: 8px;
		`;
	}
	
	template() {
		return html`
			<div>
				<h2><span data-text="label"></span>: <span data-text="count"></span></h2>
				<button data-on-click="increment">+</button>
				<button data-on-click="decrement">-</button>
			</div>
		`;
	}
	
	increment() {
		this.count.update(n => n + 1);
	}
	
	decrement() {
		this.count.update(n => n - 1);
	}
}

const counter = new Counter();
counter.mountTo("app");
```

#### Component Lifecycle

Components follow a predictable lifecycle flow:

1. `state()` - Returns initial state (functions → computed, primitives → signals, existing signals preserved)
2. `init()` - Called after state initialization, before rendering (optional) - ideal for creating computed/async signals that depend on state
3. `render()` - Creates and returns DOM element from `template()` with `styles()` applied
4. `mount()` - Called after component is mounted to the DOM (optional) - use for side effects that need the DOM

Additional hooks:
- `styles()` - Returns CSS class name (optional)
- `template()` - Returns HTML template (required)
- `onCleanup()` - Called during cleanup (optional)
- `cleanup()` - Manually cleanup subscriptions

#### Component Methods

- `this.signal(value)` - Create a signal
- `this.computed(fn)` - Create computed signal (auto-cleaned)
- `this.computedAsync(fn)` - Create async computed signal (auto-cleaned)
- `this.effect(fn)` - Run side effect when dependencies change
- `this.batch(fn)` - Batch updates
- `this.track(fn)` - Track subscription for cleanup
- `this.on(target, event, handler, options?)` - Add event listener (auto-cleaned)
- `this.scan(element)` - Scan element for bindings (uses `this` as scope)
- `this.render()` - Render component to element
- `this.mountTo(containerId)` - Mount to container (replaces content)
- `this.appendTo(containerId)` - Append to container
- `this.refs` - Object with element references (from `data-ref`)

### Examples

#### Simple Counter

```javascript
import { Signals, Reactive, html } from './reactive.js';

const count = Signals.create(0);

const app = () => html`
	<div>
		<h1>Count: <span data-text="count"></span></h1>
		<button data-on-click=${() => count.update(n => n + 1)}>
			Increment
		</button>
		<button data-on-click=${() => count.update(n => n - 1)}>
			Decrement
		</button>
	</div>
`;

Reactive.scan(document.body, { count });
Reactive.mount(document.body, app);
```

#### Todo List

```javascript
import { Signals, Reactive, html, join } from './reactive.js';

const todos = Signals.create([]);
const newTodo = Signals.create("");

const addTodo = () => {
	if (newTodo.get().trim()) {
		todos.update(list => [...list, { 
			id: Date.now(), 
			text: newTodo.get(),
			done: false 
		}]);
		newTodo.set("");
	}
};

const toggleTodo = (id) => {
	todos.update(list => 
		list.map(t => t.id === id ? { ...t, done: !t.done } : t)
	);
};

const app = () => html`
	<div>
		<h1>Todos</h1>
		<input 
			data-model="newTodo" 
			placeholder="New todo..."
			data-on-keydown=${(e) => e.key === 'Enter' && addTodo()}
		/>
		<button data-on-click="addTodo">Add</button>
		<ul>
			${join(todos.get().map(todo => html`
				<li>
					<input 
						type="checkbox" 
						checked=${todo.done}
						data-on-change=${() => toggleTodo(todo.id)}
					/>
					<span style="text-decoration: ${todo.done ? 'line-through' : 'none'}">
						${todo.text}
					</span>
				</li>
			`))}
		</ul>
	</div>
`;

Reactive.scan(document.body, { todos, newTodo, addTodo });
Reactive.mount(document.body, app);
```

#### Component Example

```javascript
import { Reactive, html, css } from './reactive.js';

class UserCard extends Reactive.Component {
	constructor(userId) {
		super();
		this.userId = this.signal(userId);
		this.user = this.computedAsync(async (cancel) => {
			// This will be re-run when this.userId changes
			const res = await fetch(`/api/users/${this.userId.get()}`);
			if (cancel.cancelled) return; // Don't update if a new request has started
			return res.json();
		});
	}
	
	state() {
		return { expanded: false };
	}
	
	styles() {
		return css`
			border: 1px solid #ddd;
			padding: 16px;
			margin: 8px;
			border-radius: 8px;
			
			&.expanded {
				background: #f5f5f5;
			}
		`;
	}
	
	template() {
		return html`
			<div data-class-expanded="expanded">
				${() => {
					const state = this.user.get();
					if (state.loading) return html`<h3>Loading...</h3>`;
					if (state.error) return html`<h3>Error: ${state.error.message}</h3>`;
					
					const user = state.data;
					return html`
						<h3>${user.name}</h3>
						<div data-visible="expanded">
							<p>Email: ${user.email}</p>
						</div>
						<button data-on-click="toggle">
							${this.computed(() => this.expanded.get() ? 'Collapse' : 'Expand')}
						</button>
					`;
				}}
			</div>
		`;
	}
	
	toggle() {
		this.expanded.update(v => !v);
	}
}

// Usage
const userIds = [1, 2];
userIds.forEach(id => {
	const card = new UserCard(id);
	card.appendTo("app");
});
```

### Best Practices

1. **Use signals for reactive state** - Prefer `Signals.create()` over plain variables.
2. **Name your signals** - Provide a name for signals and computed signals (e.g., `Signals.create(0, undefined, "counter")`) for easier debugging.
3. **Batch multiple updates** - Use `Signals.batch()` to avoid intermediate renders.
4. **Clean up subscriptions** - Always call cleanup functions or use Components for automatic cleanup.
5. **Use computed for derived state** - Create computed signals for values derived from others.
6. **Handle async with `computedAsync`** - For data fetching, use `computedAsync` for built-in state management and cancellation.
7. **Use `peek()` to avoid dependencies** - Inside a computed, use `signal.peek()` to read a value without creating a dependency.
8. **Prefer declarative bindings** - Use `data-*` attributes with `Reactive.scan()`.
9. **Component state management** - Use `state()` method to automatically convert values.
10. **CSS scoping** - Use `css` template tag for component-scoped styles.
11. **HTML safety** - Always use `html` template tag for automatic XSS protection.
12. **Refs for DOM access** - Use `data-ref` and `this.refs` instead of `querySelector`.
13. **Effect cleanup** - Use `this.effect()` in components for side effects that are automatically cleaned up.
14. **Conditional rendering with functions** - Embed functions in `html` templates for dynamic rendering logic.
