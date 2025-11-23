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
- **Reactive Framework**: Built-in signals-based reactive state management
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
- Adds necessary npm scripts to `package.json`

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
    "prod": "microtastic prod"
  }
}
```

- `npm run prepare` - Prepares dependencies (runs automatically after `npm install`)
- `npm run dev` - Starts the development server
- `npm run dependencies` - Alias for `prepare`
- `npm run prod` - Builds the production bundle

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

Microtastic can automatically copy assets (fonts, CSS files, images, etc.) from `node_modules` to your app directory during the `prep` phase. Add an `assetCopy` array to your `package.json`:

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
    }
  ]
}
```

Each asset entry requires:
- **source**: Path to the file in `node_modules` (relative to project root)
- **dest**: Destination path in your app (relative to project root)

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

```javascript
import { Signals, Reactive, html, css } from './reactive.js';
```

### Signals

Signals are reactive primitives that track dependencies and update subscribers automatically.

#### `Signals.create(value, equals?)`

Creates a signal with an initial value. Optionally provide a custom equality function.

```javascript
const count = Signals.create(0);
const user = Signals.create({ name: "Alice", age: 30 });

// Custom equality for arrays
const items = Signals.create([], (a, b) => 
	a.length === b.length && a.every((x, i) => x === b[i])
);
```

**Signal Methods:**
- `signal.get()` - Read value (tracks dependencies in computed contexts)
- `signal.set(value)` - Update value
- `signal.update(fn)` - Update using function: `signal.update(n => n + 1)`
- `signal.subscribe(fn)` - Subscribe to changes, returns unsubscribe function
- `signal.subscribeInternal(fn)` - Internal subscription (doesn't call immediately)

#### `Signals.computed(fn)`

Creates a computed signal that automatically tracks dependencies and recomputes when they change.

```javascript
const firstName = Signals.create("Alice");
const lastName = Signals.create("Smith");
const fullName = Signals.computed(() => `${firstName.get()} ${lastName.get()}`);

// Automatically updates when firstName or lastName changes
fullName.subscribe(name => console.log(name)); // "Alice Smith"

// Clean up when done
fullName.dispose();
```

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
				<h2>${this.label.get()}: ${this.count.get()}</h2>
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

- `state()` - Returns initial state (functions → computed, primitives → signals, existing signals preserved)
- `styles()` - Returns CSS class name (optional)
- `template()` - Returns HTML template (required)
- `mount()` - Called after component is mounted (optional)
- `onCleanup()` - Called during cleanup (optional)
- `cleanup()` - Manually cleanup subscriptions

#### Component Methods

- `this.signal(value)` - Create a signal
- `this.computed(fn)` - Create computed signal (auto-cleaned)
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
		<h1>Count: ${count.get()}</h1>
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
	constructor(user) {
		super();
		this.user = user;
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
				<h3>${this.user.name}</h3>
				<div data-visible="expanded">
					<p>Email: ${this.user.email}</p>
					<p>Age: ${this.user.age}</p>
				</div>
				<button data-on-click="toggle">
					${this.computed(() => this.expanded.get() ? 'Collapse' : 'Expand')}
				</button>
			</div>
		`;
	}
	
	toggle() {
		this.expanded.update(v => !v);
	}
}

// Usage
const users = [
	{ name: "Alice", email: "alice@example.com", age: 30 },
	{ name: "Bob", email: "bob@example.com", age: 25 }
];

users.forEach(user => {
	const card = new UserCard(user);
	card.appendTo("app");
});
```

### Best Practices

1. **Use signals for reactive state** - Prefer `Signals.create()` over plain variables
2. **Batch multiple updates** - Use `Signals.batch()` to avoid intermediate renders
3. **Clean up subscriptions** - Always call cleanup functions or use Components
4. **Use computed for derived state** - Create computed signals for values derived from others
5. **Prefer declarative bindings** - Use `data-*` attributes with `Reactive.scan()`
6. **Component state management** - Use `state()` method to automatically convert values
7. **CSS scoping** - Use `css` template tag for component-scoped styles
8. **HTML safety** - Always use `html` template tag for automatic XSS protection
9. **Refs for DOM access** - Use `data-ref` and `this.refs` instead of `querySelector`
10. **Effect cleanup** - Use `this.effect()` in components for side effects
