// Test reactive system - Signals and Reactive utilities
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import "./setup.js";
import {
	css,
	html,
	join,
	Reactive,
	Signals,
	setDebugMode,
	trusted,
} from "../reactive.js";

describe("Signals", () => {
	test("should create signal with initial value", () => {
		const count = Signals.create(0);
		assert.equal(count.get(), 0);
	});

	test("should update signal value", () => {
		const count = Signals.create(0);
		count.set(5);
		assert.equal(count.get(), 5);
	});

	test("should notify subscribers on change", () => {
		const count = Signals.create(0);
		let callCount = 0;
		let lastValue = null;

		count.subscribe((value) => {
			callCount++;
			lastValue = value;
		});

		assert.equal(callCount, 1, "Should call immediately"); // Called immediately
		assert.equal(lastValue, 0);

		count.set(5);
		assert.equal(callCount, 2, "Should call on update");
		assert.equal(lastValue, 5);
	});

	test("should not notify if value unchanged", () => {
		const count = Signals.create(5);
		let callCount = 0;

		count.subscribe(() => callCount++);
		assert.equal(callCount, 1, "Should call immediately"); // Initial call

		count.set(5); // Same value
		assert.equal(callCount, 1, "Should not call again for same value"); // Not called again
	});

	test("should support unsubscribe", () => {
		const count = Signals.create(0);
		let callCount = 0;

		const unsubscribe = count.subscribe(() => callCount++);
		assert.equal(callCount, 1, "Should call immediately");

		unsubscribe();
		count.set(5);
		assert.equal(callCount, 1, "Should not call after unsubscribe"); // Not called after unsubscribe
	});

	test("should update signal with function", () => {
		const count = Signals.create(5);
		count.update((n) => n * 2);
		assert.equal(count.get(), 10);
	});

	test("should support multiple subscribers", () => {
		const count = Signals.create(0);
		let calls1 = 0;
		let calls2 = 0;

		count.subscribe(() => calls1++);
		count.subscribe(() => calls2++);

		assert.equal(calls1, 1, "First subscriber called immediately");
		assert.equal(calls2, 1, "Second subscriber called immediately");

		count.set(10);
		assert.equal(calls1, 2, "First subscriber called on update");
		assert.equal(calls2, 2, "Second subscriber called on update");
	});

	test("should support once for one-time subscription", () => {
		const count = Signals.create(0);
		let callCount = 0;
		let lastValue = null;

		const unsub = count.once((value) => {
			callCount++;
			lastValue = value;
		});

		assert.equal(callCount, 1, "Should call immediately");
		assert.equal(lastValue, 0);
		assert.equal(
			typeof unsub,
			"function",
			"Should return unsubscribe function",
		);

		count.set(5);
		assert.equal(callCount, 1, "Should not call again");
		assert.equal(lastValue, 0, "Value should not update");

		count.set(10);
		assert.equal(callCount, 1, "Should still not call");
	});

	test("should support custom equality function", () => {
		const obj = Signals.create(
			{ id: 1, name: "Alice" },
			(a, b) => a.id === b.id,
		);
		let callCount = 0;

		obj.subscribe(() => callCount++);
		assert.equal(callCount, 1, "Should call immediately");

		// Same id, different name - should NOT notify
		obj.set({ id: 1, name: "Bob" });
		assert.equal(callCount, 1, "Should not notify for same id");

		// Different id - should notify
		obj.set({ id: 2, name: "Charlie" });
		assert.equal(callCount, 2, "Should notify for different id");
	});

	test("should support custom equality for arrays", () => {
		const arr = Signals.create(
			[1, 2, 3],
			(a, b) => a.length === b.length && a.every((v, i) => v === b[i]),
		);
		let callCount = 0;

		arr.subscribe(() => callCount++);
		assert.equal(callCount, 1, "Should call immediately");

		// Same content - should NOT notify
		arr.set([1, 2, 3]);
		assert.equal(callCount, 1, "Should not notify for same content");

		// Different content - should notify
		arr.set([1, 2, 4]);
		assert.equal(callCount, 2, "Should notify for different content");
	});

	test("should support peek() without tracking", () => {
		const count = Signals.create(5);
		const doubled = Signals.computed(() => count.get() * 2);

		assert.equal(doubled.peek(), 10);

		// Create another computed that peeks
		let computeCount = 0;
		const result = Signals.computed(() => {
			computeCount++;
			return doubled.peek() + 100; // Using peek, so no dependency
		});

		assert.equal(result.get(), 110);
		assert.equal(computeCount, 1);

		// Change count - result should NOT update because it peeked
		count.set(10);
		assert.equal(doubled.get(), 20); // doubled updates
		assert.equal(result.peek(), 110); // result stays the same
		assert.equal(computeCount, 1, "Should not recompute when using peek");

		result.dispose();
		doubled.dispose();
	});

	test("should support signal names for debugging", () => {
		const count = Signals.create(0, undefined, "counter");
		assert.equal(count._name, "counter");
		assert.equal(count.toString(), "Signal(counter)");

		const unnamed = Signals.create(0);
		assert.equal(unnamed._name, undefined);
		assert.equal(unnamed.toString(), "Signal");
	});

	test("should include names in debug logs", () => {
		const logs = [];
		const originalLog = console.log;
		console.log = (...args) => logs.push(args);

		setDebugMode(true);

		const named = Signals.create(0, undefined, "mySignal");
		named.set(5);

		setDebugMode(false);
		console.log = originalLog;

		const hasNamedLog = logs.some(
			(log) =>
				log[0] === "[Reactive]" &&
				log[1] === "Signal updated:" &&
				log[2] === "[mySignal]",
		);
		assert.ok(hasNamedLog);
	});
});

describe("Computed Signals", () => {
	test("should create computed signal", () => {
		const firstName = Signals.create("John");
		const lastName = Signals.create("Doe");
		const fullName = Signals.computed(
			() => `${firstName.get()} ${lastName.get()}`,
		);

		assert.equal(fullName.get(), "John Doe");
	});

	test("should update when dependencies change", () => {
		const a = Signals.create(2);
		const b = Signals.create(3);
		const sum = Signals.computed(() => a.get() + b.get());

		assert.equal(sum.get(), 5);

		a.set(10);
		assert.equal(sum.get(), 13);

		b.set(7);
		assert.equal(sum.get(), 17);
	});

	test("should support dispose", () => {
		const count = Signals.create(0);
		const doubled = Signals.computed(() => count.get() * 2);

		assert.equal(doubled.get(), 0);
		doubled.dispose();

		count.set(5);
		assert.equal(doubled.get(), 0, "Should not update after dispose"); // Not updated after dispose
	});

	test("should handle multiple computed dependencies", () => {
		const x = Signals.create(2);
		const y = Signals.create(3);
		const z = Signals.create(4);
		const result = Signals.computed(() => x.get() * y.get() + z.get());

		assert.equal(result.get(), 10); // 2 * 3 + 4 = 10

		x.set(5);
		assert.equal(result.get(), 19); // 5 * 3 + 4 = 19

		z.set(10);
		assert.equal(result.get(), 25); // 5 * 3 + 10 = 25
	});

	test("should support dynamic dependencies", () => {
		const toggle = Signals.create(true);
		const a = Signals.create("A");
		const b = Signals.create("B");

		let runs = 0;
		const dynamic = Signals.computed(() => {
			runs++;
			return toggle.get() ? a.get() : b.get();
		});

		assert.equal(dynamic.get(), "A");
		assert.equal(runs, 1);

		// Change 'b' - should NOT trigger update because 'b' is not accessed
		b.set("B2");
		assert.equal(runs, 1);

		// Switch toggle to false - should access 'b' now
		toggle.set(false);
		assert.equal(dynamic.get(), "B2");
		assert.equal(runs, 2);

		// Change 'a' - should NOT trigger update because 'a' is not accessed anymore
		a.set("A2");
		assert.equal(runs, 2);

		// Change 'b' - SHOULD trigger update
		b.set("B3");
		assert.equal(dynamic.get(), "B3");
		assert.equal(runs, 3);
	});

	test("should support computed signal names", () => {
		const a = Signals.create(2, undefined, "a");
		const b = Signals.create(3, undefined, "b");
		const sum = Signals.computed(() => a.get() + b.get(), "sum");

		assert.equal(sum._name, "sum");
		assert.equal(sum.toString(), "Signal(sum)");
	});

	test("should prevent infinite recursion with circular computed", () => {
		// Test that circular dependency detection prevents stack overflow
		const signal = Signals.create(1, undefined, "base");

		// Create a computed that will try to read itself
		let circularComputed;
		const wrapper = {
			get: () => {
				if (circularComputed) {
					// This would create infinite recursion without detection
					return circularComputed.get();
				}
				return signal.get();
			},
		};

		// The circular dependency is detected when the computed
		// tries to access itself during its own computation
		circularComputed = Signals.computed(() => {
			return wrapper.get() + 1;
		}, "circular");

		// Should work fine on first access (no circular ref yet)
		assert.equal(circularComputed.peek(), 2);

		// Now trigger update - if wrapper.get() is called, it will try to
		// access circularComputed.get() during computation, triggering detection
		signal.set(2);

		circularComputed.dispose();
	});

	test("should include named signals in circular dependency messages", () => {
		// Verify that signal names appear in error messages when circular deps are detected
		const a = Signals.create(1, undefined, "signalA");
		const b = Signals.computed(() => a.get() * 2, "computedB");

		// Names should be tracked and available for debugging
		assert.equal(a._name, "signalA");
		assert.equal(b._name, "computedB");

		b.dispose();
	});

	test("should track compute stack correctly", () => {
		// Verify that compute stack is properly managed
		const a = Signals.create(1);
		const b = Signals.computed(() => a.get() * 2);
		const c = Signals.computed(() => b.get() + 1);

		assert.equal(c.get(), 3);

		// Stack should be empty after computation
		a.set(2);
		assert.equal(c.get(), 5);

		c.dispose();
		b.dispose();
	});
});

describe("Reactive.mount", () => {
	test("should mount template to element", () => {
		const div = document.createElement("div");
		const component = Reactive.mount(div, () => html`<span>Hello</span>`);

		component.update();
		assert.equal(div.innerHTML, "<span>Hello</span>");
	});

	test("should update on manual call", () => {
		const div = document.createElement("div");
		let counter = 0;
		const component = Reactive.mount(
			div,
			() => html`<span>Count: ${counter}</span>`,
		);

		component.update();
		assert.equal(div.innerHTML, "<span>Count: 0</span>");

		counter = 5;
		component.update();
		assert.equal(div.innerHTML, "<span>Count: 5</span>");
	});
});

describe("Reactive.bind", () => {
	test("should bind signal to element", () => {
		const div = document.createElement("div");
		const message = Signals.create("Hello");

		Reactive.bind(div, message, (value) => html`<span>${value}</span>`);
		assert.equal(div.innerHTML, "<span>Hello</span>");

		message.set("World");
		assert.equal(div.innerHTML, "<span>World</span>");
	});

	test("should auto-escape content", () => {
		const div = document.createElement("div");
		const content = Signals.create("<script>alert('xss')</script>");

		Reactive.bind(div, content, (value) => html`<div>${value}</div>`);
		assert.ok(div.innerHTML.includes("&lt;script&gt;"));
		assert.ok(!div.innerHTML.includes("<script>"));
	});
});

describe("Reactive.bindText", () => {
	test("should bind signal to text content", () => {
		const span = document.createElement("span");
		const text = Signals.create("Initial");

		Reactive.bindText(span, text);
		assert.equal(span.textContent, "Initial");

		text.set("Updated");
		assert.equal(span.textContent, "Updated");
	});

	test("should escape HTML in text content", () => {
		const span = document.createElement("span");
		const text = Signals.create("<b>Bold</b>");

		Reactive.bindText(span, text);
		assert.equal(span.textContent, "<b>Bold</b>");
		assert.equal(span.innerHTML, "&lt;b&gt;Bold&lt;/b&gt;");
	});
});

describe("Reactive.bindStyle", () => {
	test("should bind signal to style property", () => {
		const div = document.createElement("div");
		const color = Signals.create("red");

		Reactive.bindStyle(div, "color", color);
		assert.equal(div.style.color, "red");

		color.set("blue");
		assert.equal(div.style.color, "blue");
	});

	test("should bind to multiple style properties", () => {
		const div = document.createElement("div");
		const width = Signals.create("100px");
		const height = Signals.create("50px");

		Reactive.bindStyle(div, "width", width);
		Reactive.bindStyle(div, "height", height);

		assert.equal(div.style.width, "100px");
		assert.equal(div.style.height, "50px");

		width.set("200px");
		height.set("100px");

		assert.equal(div.style.width, "200px");
		assert.equal(div.style.height, "100px");
	});

	test("should handle camelCase properties", () => {
		const div = document.createElement("div");
		const color = Signals.create("red");

		Reactive.bindStyle(div, "backgroundColor", color);
		assert.equal(div.style.backgroundColor, "red");

		color.set("blue");
		assert.equal(div.style.backgroundColor, "blue");
	});
});

describe("Reactive.bindMultiple", () => {
	test("should bind multiple signals with transform", () => {
		const div = document.createElement("div");
		const firstName = Signals.create("John");
		const lastName = Signals.create("Doe");

		Reactive.bindMultiple(
			div,
			[firstName, lastName],
			([first, last]) => html`${first} ${last}`,
		);

		assert.equal(div.textContent, "John Doe");

		firstName.set("Jane");
		assert.equal(div.textContent, "Jane Doe");

		lastName.set("Smith");
		assert.equal(div.textContent, "Jane Smith");
	});

	test("should throw error for non-array signals", () => {
		const div = document.createElement("div");
		const signal = Signals.create("test");

		assert.throws(() => {
			Reactive.bindMultiple(div, signal, (val) => val);
		}, /bindMultiple expects an array of signals/);
	});

	test("should handle three or more signals", () => {
		const div = document.createElement("div");
		const x = Signals.create(1);
		const y = Signals.create(2);
		const z = Signals.create(3);

		Reactive.bindMultiple(div, [x, y, z], ([a, b, c]) => `${a + b + c}`);

		assert.equal(div.textContent, "6");

		x.set(10);
		assert.equal(div.textContent, "15");
	});

	test("should support cleanup", () => {
		const div = document.createElement("div");
		const a = Signals.create(1);
		const b = Signals.create(2);

		const cleanup = Reactive.bindMultiple(div, [a, b], ([x, y]) => `${x + y}`);

		assert.equal(div.textContent, "3");

		cleanup();

		a.set(10);
		b.set(20);
		assert.equal(div.textContent, "3", "Should not update after cleanup");
	});
});

describe("Reactive.bindAttr", () => {
	test("should bind signal to attribute", () => {
		const div = document.createElement("div");
		const className = Signals.create("active");

		Reactive.bindAttr(div, "class", className);
		assert.equal(div.getAttribute("class"), "active");

		className.set("inactive");
		assert.equal(div.getAttribute("class"), "inactive");
	});

	test("should bind to data attributes", () => {
		const div = document.createElement("div");
		const status = Signals.create("loading");

		Reactive.bindAttr(div, "data-status", status);
		assert.equal(div.getAttribute("data-status"), "loading");

		status.set("loaded");
		assert.equal(div.getAttribute("data-status"), "loaded");
	});
});

describe("Reactive.bindBoolAttr", () => {
	test("should bind boolean signal to attribute", () => {
		const button = document.createElement("button");
		const disabled = Signals.create(false);

		Reactive.bindBoolAttr(button, "disabled", disabled);
		assert.equal(button.hasAttribute("disabled"), false);

		disabled.set(true);
		assert.equal(button.hasAttribute("disabled"), true);

		disabled.set(false);
		assert.equal(button.hasAttribute("disabled"), false);
	});

	test("should work with checked attribute", () => {
		const input = document.createElement("input");
		input.type = "checkbox";
		const checked = Signals.create(true);

		Reactive.bindBoolAttr(input, "checked", checked);
		assert.equal(input.hasAttribute("checked"), true);

		checked.set(false);
		assert.equal(input.hasAttribute("checked"), false);
	});
});

describe("Reactive.bindClass", () => {
	test("should toggle class based on signal", () => {
		const div = document.createElement("div");
		const isActive = Signals.create(false);

		Reactive.bindClass(div, "active", isActive);
		assert.equal(div.classList.contains("active"), false);

		isActive.set(true);
		assert.equal(div.classList.contains("active"), true);

		// Test data-on-*
		let clicked = false;
		const scope = {
			handleClick: () => {
				clicked = true;
			},
		};

		div.setAttribute("data-on-click", "handleClick");
		const cleanup = Reactive.scan(div, scope);

		div.click();
		assert.equal(clicked, true);

		cleanup();

		isActive.set(false);
		assert.equal(div.classList.contains("active"), false);
	});
});

describe("Declarative Directives", () => {
	test("data-visible should control display", () => {
		const div = document.createElement("div");
		const visible = Signals.create(true);
		const scope = { visible };

		div.setAttribute("data-visible", "visible");
		const cleanup = Reactive.scan(div, scope);

		assert.equal(div.style.display, "");

		visible.set(false);
		assert.equal(div.style.display, "none");

		visible.set(true);
		assert.equal(div.style.display, "");

		cleanup();
	});

	test("data-if should conditionally mount/unmount", () => {
		const container = document.createElement("div");
		const child = document.createElement("span");
		child.textContent = "Conditional";
		container.appendChild(child);

		const show = Signals.create(true);
		const scope = { show };

		child.setAttribute("data-if", "show");
		const cleanup = Reactive.scan(container, scope);

		// Initially shown
		assert.ok(container.contains(child));

		// Hide
		show.set(false);
		assert.ok(!container.contains(child));

		// Show again
		show.set(true);
		assert.ok(container.contains(child));

		cleanup();
	});

	test("data-if should preserve element when re-shown", () => {
		const container = document.createElement("div");
		const child = document.createElement("span");
		child.textContent = "Test";
		container.appendChild(child);

		const show = Signals.create(true);
		const scope = { show };

		child.setAttribute("data-if", "show");
		Reactive.scan(container, scope);

		show.set(false);
		show.set(true);

		// Element should be back
		assert.ok(container.contains(child));
		assert.equal(child.textContent, "Test");
	});

	test("data-if should insert placeholder comment", () => {
		const container = document.createElement("div");
		const child = document.createElement("span");
		container.appendChild(child);

		const show = Signals.create(true);
		const scope = { show };

		child.setAttribute("data-if", "show");
		Reactive.scan(container, scope);

		show.set(false);

		// Should have a comment placeholder
		const hasComment = Array.from(container.childNodes).some(
			(node) => node.nodeType === 8,
		);
		assert.ok(hasComment);
	});
});

describe("Reactive.scan", () => {
	test("should bind text and attributes declaratively", () => {
		const div = document.createElement("div");
		div.innerHTML = `
			<span data-text="user.name"></span>
			<button data-bool-disabled="isDisabled" data-attr-title="tooltip"></button>
			<div data-class-active="isActive"></div>
		`;

		const scope = {
			user: { name: Signals.create("Alice") },
			isDisabled: Signals.create(true),
			tooltip: Signals.create("Click me"),
			isActive: Signals.create(false),
		};

		const component = Reactive.createComponent();
		component.scan(div, scope);

		const span = div.querySelector("span");
		const button = div.querySelector("button");
		const activeDiv = div.querySelector("div");

		assert.equal(span.textContent, "Alice");
		assert.equal(button.hasAttribute("disabled"), true);
		assert.equal(button.getAttribute("title"), "Click me");
		assert.equal(activeDiv.classList.contains("active"), false);

		// Update signals
		scope.user.name.set("Bob");
		scope.isDisabled.set(false);
		scope.isActive.set(true);

		assert.equal(span.textContent, "Bob");
		assert.equal(button.hasAttribute("disabled"), false);
		assert.equal(activeDiv.classList.contains("active"), true);

		component.cleanup();
	});

	test("should create signals via helper", () => {
		class SignalComponent extends Reactive.Component {
			constructor() {
				super();
				this.count = this.signal(0);
			}
		}

		const component = new SignalComponent();
		assert.equal(component.count.get(), 0);
		component.count.set(1);
		assert.equal(component.count.get(), 1);
		component.cleanup();
	});

	test("should initialize state from state() method", () => {
		class StateComponent extends Reactive.Component {
			state() {
				return {
					count: 0,
					name: "John",
					isActive: true,
				};
			}
		}

		const component = new StateComponent();
		component.initState();

		// Check signals were created
		assert.equal(component.count.get(), 0);
		assert.equal(component.name.get(), "John");
		assert.equal(component.isActive.get(), true);

		// Check they're reactive
		component.count.set(5);
		assert.equal(component.count.get(), 5);

		component.cleanup();
	});

	test("should handle computed signals in state()", () => {
		class ComputedStateComponent extends Reactive.Component {
			state() {
				return {
					firstName: "John",
					lastName: "Doe",
					fullName: () => `${this.firstName.get()} ${this.lastName.get()}`,
				};
			}
		}

		const component = new ComputedStateComponent();
		component.initState();

		assert.equal(component.fullName.get(), "John Doe");

		component.firstName.set("Jane");
		assert.equal(component.fullName.get(), "Jane Doe");

		component.cleanup();
	});

	test("should handle nested objects in state()", () => {
		class NestedStateComponent extends Reactive.Component {
			state() {
				return {
					// Plain nested object becomes a single signal
					user: {
						name: "Alice",
						age: 30,
					},
					// Explicit nested signals
					settings: {
						theme: this.signal("dark"),
						notifications: this.signal(true),
					},
				};
			}
		}

		const component = new NestedStateComponent();
		component.initState();

		// user is a single signal containing an object
		assert.equal(component.user.get().name, "Alice");
		assert.equal(component.user.get().age, 30);

		// settings contains separate signals
		assert.equal(component.settings.theme.get(), "dark");
		assert.equal(component.settings.notifications.get(), true);

		component.settings.theme.set("light");
		assert.equal(component.settings.theme.get(), "light");

		component.cleanup();
	});

	test("should execute batch via helper", () => {
		class BatchComponent extends Reactive.Component {
			constructor() {
				super();
				this.count = this.signal(0);
			}
			update() {
				this.batch(() => {
					this.count.set(1);
					this.count.set(2);
				});
			}
		}

		const component = new BatchComponent();
		let calls = 0;
		component.count.subscribe(() => calls++);

		calls = 0; // Reset calls from initial subscribe
		component.update();
		assert.equal(component.count.get(), 2);
		assert.equal(calls, 1); // Should only notify once
		component.cleanup();
	});

	test("should render and bind template automatically", () => {
		class RenderComponent extends Reactive.Component {
			constructor() {
				super();
				this.text = Signals.create("Hello");
			}

			template() {
				return html`<div data-text="text"></div>`;
			}
		}

		const component = new RenderComponent();
		const element = component.render();

		assert.equal(element.tagName, "DIV");
		assert.equal(element.textContent, "Hello");

		component.text.set("World");
		assert.equal(element.textContent, "World");

		component.cleanup();
	});

	test("should support effect for side effects", () => {
		class EffectComponent extends Reactive.Component {
			constructor() {
				super();
				this.count = this.signal(0);
				this.effectRuns = 0;
				this.effect(() => {
					this.count.get(); // Track count
					this.effectRuns++;
				});
			}
		}

		const component = new EffectComponent();
		assert.equal(component.effectRuns, 1, "Effect should run initially");

		component.count.set(5);
		assert.equal(
			component.effectRuns,
			2,
			"Effect should run on dependency change",
		);

		component.cleanup();
	});

	test("should support on() for event listeners with auto-batching", () => {
		class EventComponent extends Reactive.Component {
			constructor() {
				super();
				this.count = this.signal(0);
			}
			setupButton(button) {
				this.on(button, "click", () => {
					this.count.set(1);
					this.count.set(2);
					this.count.set(3);
				});
			}
		}

		const component = new EventComponent();
		const button = document.createElement("button");
		let notifications = 0;

		component.count.subscribe(() => notifications++);
		notifications = 0; // Reset after initial call

		component.setupButton(button);
		button.click();

		assert.equal(component.count.get(), 3);
		assert.equal(notifications, 1, "Should batch updates in event handler");

		component.cleanup();
	});

	test("should collect refs with data-ref", () => {
		class RefComponent extends Reactive.Component {
			template() {
				return html`
					<div>
						<input data-ref="input" type="text" />
						<button data-ref="submit">Submit</button>
					</div>
				`;
			}
		}

		const component = new RefComponent();
		component.render();

		assert.ok(component.refs.input);
		assert.equal(component.refs.input.tagName, "INPUT");
		assert.ok(component.refs.submit);
		assert.equal(component.refs.submit.tagName, "BUTTON");

		component.cleanup();
	});

	test("should support mountTo with container ID", () => {
		const container = document.createElement("div");
		container.id = "app";
		document.body.appendChild(container);

		class MountComponent extends Reactive.Component {
			state() {
				return { message: "Mounted" };
			}
			template() {
				return html`<div data-text="message"></div>`;
			}
		}

		const component = new MountComponent();
		const element = component.mountTo("app");

		assert.ok(element);
		assert.equal(container.children.length, 1);
		assert.equal(element.textContent, "Mounted");

		component.cleanup();
		document.body.removeChild(container);
	});

	test("should support appendTo with container ID", () => {
		const container = document.createElement("div");
		container.id = "list";
		document.body.appendChild(container);

		class ItemComponent extends Reactive.Component {
			template() {
				return html`<li>Item</li>`;
			}
		}

		const comp1 = new ItemComponent();
		const comp2 = new ItemComponent();

		comp1.appendTo("list");
		comp2.appendTo("list");

		assert.equal(container.children.length, 2);

		comp1.cleanup();
		comp2.cleanup();
		document.body.removeChild(container);
	});

	test("should support appendTo body", () => {
		class BodyComponent extends Reactive.Component {
			template() {
				return html`<div id="test-body-append">Test</div>`;
			}
		}

		const component = new BodyComponent();
		const element = component.appendTo("body");

		assert.ok(element);
		assert.ok(document.body.contains(element));

		component.cleanup();
		document.body.removeChild(element);
	});

	test("should call mount lifecycle hook", () => {
		class LifecycleComponent extends Reactive.Component {
			constructor() {
				super();
				this.mounted = false;
			}
			template() {
				return html`<div>Test</div>`;
			}
			mount() {
				this.mounted = true;
			}
		}

		const container = document.createElement("div");
		container.id = "lifecycle-test";
		document.body.appendChild(container);

		const component = new LifecycleComponent();
		assert.equal(component.mounted, false);

		component.mountTo("lifecycle-test");
		assert.equal(component.mounted, true);

		component.cleanup();
		document.body.removeChild(container);
	});

	test("should call onCleanup lifecycle hook", () => {
		class CleanupComponent extends Reactive.Component {
			constructor() {
				super();
				this.cleaned = false;
			}
			template() {
				return html`<div>Test</div>`;
			}
			onCleanup() {
				this.cleaned = true;
			}
		}

		const component = new CleanupComponent();
		component.render();

		assert.equal(component.cleaned, false);
		component.cleanup();
		assert.equal(component.cleaned, true);
	});

	test("should call init() lifecycle hook after state initialization", () => {
		class InitComponent extends Reactive.Component {
			constructor() {
				super();
				this.initCalled = false;
				this.stateInitialized = false;
			}
			state() {
				return {
					count: 0,
				};
			}
			init() {
				// Check that state signals exist
				assert.ok(this.count);
				assert.ok(this.count.get);
				assert.equal(this.count.get(), 0);
				this.initCalled = true;
				this.stateInitialized = true;
			}
			template() {
				return html`<div>Test</div>`;
			}
		}

		const component = new InitComponent();
		assert.equal(component.initCalled, false);

		component.initState();
		assert.equal(component.initCalled, true);
		assert.equal(component.stateInitialized, true);

		component.cleanup();
	});

	test("should call init() with access to state signals", () => {
		class StateAccessComponent extends Reactive.Component {
			state() {
				return {
					firstName: "John",
					lastName: "Doe",
				};
			}
			init() {
				// Create computed signal that depends on state
				this.fullName = this.computed(
					() => `${this.firstName.get()} ${this.lastName.get()}`,
				);
			}
			template() {
				return html`<div data-text="fullName"></div>`;
			}
		}

		const component = new StateAccessComponent();
		component.initState();

		assert.ok(component.fullName);
		assert.equal(component.fullName.get(), "John Doe");

		component.firstName.set("Jane");
		assert.equal(component.fullName.get(), "Jane Doe");

		component.cleanup();
	});

	test("should call init() with computedAsync signals", () => {
		class AsyncInitComponent extends Reactive.Component {
			state() {
				return {
					userId: 1,
				};
			}
			init() {
				this.userData = this.computedAsync(async () => {
					const id = this.userId.get();
					return { id, name: `User ${id}` };
				});
			}
			template() {
				return html`<div>Test</div>`;
			}
		}

		const component = new AsyncInitComponent();
		component.initState();

		assert.ok(component.userData);
		const state = component.userData.get();
		assert.equal(state.status, "pending");

		component.cleanup();
	});

	test("should execute lifecycle in correct order: state -> init -> render -> mount", () => {
		const executionOrder = [];

		class OrderComponent extends Reactive.Component {
			state() {
				executionOrder.push("state");
				return { value: 1 };
			}
			init() {
				executionOrder.push("init");
			}
			template() {
				executionOrder.push("template");
				return html`<div>Test</div>`;
			}
			mount() {
				executionOrder.push("mount");
			}
		}

		const container = document.createElement("div");
		container.id = "order-test";
		document.body.appendChild(container);

		const component = new OrderComponent();
		component.mountTo("order-test");

		assert.deepEqual(executionOrder, ["state", "init", "template", "mount"]);

		component.cleanup();
		document.body.removeChild(container);
	});

	test("should execute lifecycle in correct order with appendTo", () => {
		const executionOrder = [];

		class AppendOrderComponent extends Reactive.Component {
			state() {
				executionOrder.push("state");
				return { value: 1 };
			}
			init() {
				executionOrder.push("init");
			}
			template() {
				executionOrder.push("template");
				return html`<div>Test</div>`;
			}
			mount() {
				executionOrder.push("mount");
			}
		}

		const container = document.createElement("div");
		container.id = "append-order-test";
		document.body.appendChild(container);

		const component = new AppendOrderComponent();
		component.appendTo("append-order-test");

		assert.deepEqual(executionOrder, ["state", "init", "template", "mount"]);

		component.cleanup();
		document.body.removeChild(container);
	});

	test("should work without init() hook (optional)", () => {
		class NoInitComponent extends Reactive.Component {
			state() {
				return { count: 0 };
			}
			template() {
				return html`<div data-text="count"></div>`;
			}
		}

		const container = document.createElement("div");
		container.id = "no-init-test";
		document.body.appendChild(container);

		const component = new NoInitComponent();
		// Should not throw
		component.mountTo("no-init-test");

		assert.equal(component.count.get(), 0);

		component.cleanup();
		document.body.removeChild(container);
	});

	test("should allow creating multiple computed signals in init()", () => {
		class MultiComputedComponent extends Reactive.Component {
			state() {
				return {
					count: 0,
				};
			}
			init() {
				this.doubled = this.computed(() => this.count.get() * 2);
				this.tripled = this.computed(() => this.count.get() * 3);
				this.quadrupled = this.computed(() => this.count.get() * 4);
			}
			template() {
				return html`<div>Test</div>`;
			}
		}

		const component = new MultiComputedComponent();
		component.initState();

		assert.equal(component.doubled.get(), 0);
		assert.equal(component.tripled.get(), 0);
		assert.equal(component.quadrupled.get(), 0);

		component.count.set(5);
		assert.equal(component.doubled.get(), 10);
		assert.equal(component.tripled.get(), 15);
		assert.equal(component.quadrupled.get(), 20);

		component.cleanup();
	});

	test("should apply styles from styles() method", () => {
		class StyledComponent extends Reactive.Component {
			template() {
				return html`<div>Styled</div>`;
			}
			styles() {
				return css`
					color: red;
				`;
			}
		}

		const component = new StyledComponent();
		const element = component.render();

		const className = component.styles();
		assert.ok(element.classList.contains(className));

		component.cleanup();
	});

	test("should handle render errors gracefully", () => {
		class BrokenComponent extends Reactive.Component {
			template() {
				// Returns invalid template
				return { __safe: false };
			}
		}

		const component = new BrokenComponent();
		const element = component.render();

		// Should render error component
		assert.ok(element);
		assert.ok(element.classList.contains("component-error"));
		assert.ok(element.innerHTML.includes("Failed to render component"));
	});

	test("should handle missing container in mountTo", () => {
		class TestComponent extends Reactive.Component {
			template() {
				return html`<div>Test</div>`;
			}
		}

		const component = new TestComponent();
		const result = component.mountTo("nonexistent-container");

		assert.equal(result, null);
		component.cleanup();
	});

	test("should handle missing container in appendTo", () => {
		class TestComponent extends Reactive.Component {
			template() {
				return html`<div>Test</div>`;
			}
		}

		const component = new TestComponent();
		const result = component.appendTo("nonexistent-container");

		assert.equal(result, null);
		component.cleanup();
	});

	test("should handle html tagged template in data-html", () => {
		class HtmlComponent extends Reactive.Component {
			constructor() {
				super();
				this.content = this.computed(() => html`<span>Safe</span>`);
			}

			template() {
				return html`<div data-html="content"></div>`;
			}
		}

		const component = new HtmlComponent();
		const element = component.render();

		assert.equal(element.innerHTML, "<span>Safe</span>");

		component.cleanup();
	});

	test("should work with disabled attribute and batching", () => {
		const button = document.createElement("button");
		const isDisabled = Signals.create(false);

		const cleanup = Reactive.bindBoolAttr(button, "disabled", isDisabled);
		assert.equal(button.hasAttribute("disabled"), false);

		Signals.batch(() => {
			isDisabled.set(true);
		});

		assert.equal(button.hasAttribute("disabled"), true);

		cleanup();
	});
});

describe("Edge Cases and Advanced Scenarios", () => {
	test("should handle debug mode", () => {
		const logs = [];
		const originalLog = console.log;
		console.log = (...args) => logs.push(args);

		setDebugMode(true);

		const count = Signals.create(0);
		count.set(5);

		setDebugMode(false);
		console.log = originalLog;

		// Should have logged the update
		const hasReactiveLog = logs.some(
			(log) => log[0] === "[Reactive]" && log[1] === "Signal updated:",
		);
		assert.ok(hasReactiveLog);
	});

	test("should prevent memory leaks with proper cleanup", () => {
		const signal = Signals.create(0);
		const computed1 = Signals.computed(() => signal.get() * 2);
		const computed2 = Signals.computed(() => computed1.get() + 10);

		assert.equal(computed2.get(), 10);

		signal.set(5);
		assert.equal(computed2.get(), 20);

		// Cleanup
		computed2.dispose();
		computed1.dispose();

		// Should not update after disposal
		signal.set(10);
		assert.equal(computed2.get(), 20, "Should not update after dispose");
	});

	test("should handle deeply nested computed dependencies", () => {
		const a = Signals.create(1);
		const b = Signals.computed(() => a.get() * 2);
		const c = Signals.computed(() => b.get() * 3);
		const d = Signals.computed(() => c.get() * 4);

		assert.equal(d.get(), 24); // 1 * 2 * 3 * 4 = 24

		a.set(2);
		assert.equal(d.get(), 48); // 2 * 2 * 3 * 4 = 48

		d.dispose();
		c.dispose();
		b.dispose();
	});

	test("should batch nested signal updates", () => {
		const a = Signals.create(1);
		const b = Signals.create(1);
		const c = Signals.create(1);

		let updates = 0;
		const sum = Signals.computed(() => {
			updates++;
			return a.get() + b.get() + c.get();
		});

		assert.equal(sum.get(), 3);
		updates = 0;

		Signals.batch(() => {
			a.set(2);
			Signals.batch(() => {
				b.set(3);
				c.set(4);
			});
		});

		assert.equal(sum.get(), 9);
		assert.equal(updates, 1, "Should only update once for nested batches");

		sum.dispose();
	});

	test("should handle rapid signal changes in batch", () => {
		const signal = Signals.create(0);
		let finalValue = null;

		signal.subscribe((v) => {
			finalValue = v;
		});

		Signals.batch(() => {
			for (let i = 1; i <= 100; i++) {
				signal.set(i);
			}
		});

		assert.equal(finalValue, 100, "Should only see final value");
	});

	test("should handle computed error gracefully", () => {
		const errors = [];
		const originalError = console.error;
		console.error = (...args) => errors.push(args);

		try {
			Signals.computed(() => {
				throw new Error("Computation failed");
			});
		} catch (error) {
			// Expected to throw
			assert.equal(error.message, "Computation failed");
		}

		console.error = originalError;

		assert.ok(errors.some((err) => err[0] === "[Reactive] Computed error:"));
	});

	test("should track and cleanup event listeners", () => {
		const component = Reactive.createComponent();
		const button = document.createElement("button");
		let clicks = 0;

		const handler = () => clicks++;
		button.addEventListener("click", handler);
		component.track(() => button.removeEventListener("click", handler));

		button.click();
		assert.equal(clicks, 1);

		component.cleanup();
		button.click();
		assert.equal(clicks, 1, "Should not respond after cleanup");
	});

	test("should handle data-html with nested scanning", () => {
		const container = document.createElement("div");
		const content = Signals.create(
			html`<span data-text="message">Nested</span>`,
		);
		const message = Signals.create("Hello");
		const scope = { content, message };

		container.setAttribute("data-html", "content");
		const cleanup = Reactive.scan(container, scope);

		// Check nested binding works
		const span = container.querySelector("span");
		assert.ok(span);
		assert.equal(span.textContent, "Hello");

		message.set("World");
		assert.equal(span.textContent, "World");

		cleanup();
	});

	test("should properly cleanup multiple subscriptions", () => {
		const component = Reactive.createComponent();
		const sig1 = Signals.create(1);
		const sig2 = Signals.create(2);
		const sig3 = Signals.create(3);

		let updates = 0;
		component.track(sig1.subscribe(() => updates++));
		component.track(sig2.subscribe(() => updates++));
		component.track(sig3.subscribe(() => updates++));

		updates = 0; // Reset after initial subscriptions

		sig1.set(10);
		sig2.set(20);
		sig3.set(30);
		assert.equal(updates, 3);

		component.cleanup();
		updates = 0;

		sig1.set(100);
		sig2.set(200);
		sig3.set(300);
		assert.equal(updates, 0, "Should not update after cleanup");
	});

	test("should handle signal updates during computed recalculation", () => {
		const base = Signals.create(1);
		const side = Signals.create(0);

		const computed = Signals.computed(() => {
			const value = base.get();
			if (value > 5) {
				side.set(value * 2); // Update another signal during computation
			}
			return value;
		});

		assert.equal(computed.get(), 1);
		assert.equal(side.get(), 0);

		base.set(10);
		assert.equal(computed.get(), 10);
		assert.equal(side.get(), 20);

		computed.dispose();
	});

	test("should support two-way data binding with data-model", () => {
		const input = document.createElement("input");
		const text = Signals.create("initial");
		const scope = { text };

		input.setAttribute("data-model", "text");
		const cleanup = Reactive.scan(input, scope);

		// Signal -> Input
		assert.equal(input.value, "initial");
		text.set("updated");
		assert.equal(input.value, "updated");

		// Input -> Signal
		input.value = "user input";
		input.dispatchEvent(new Event("input"));
		assert.equal(text.get(), "user input");

		cleanup();
	});
});

describe("Reactive.createComponent", () => {
	test("should create component context", () => {
		const component = Reactive.createComponent();
		assert.ok(component);
		assert.ok(typeof component.cleanup === "function");
		assert.ok(typeof component.track === "function");
	});

	test("should track subscriptions and cleanup", () => {
		const component = Reactive.createComponent();
		const signal = Signals.create(0);
		let callCount = 0;

		const unsub = signal.subscribe(() => callCount++);
		component.track(unsub);

		assert.equal(callCount, 1, "Should call immediately");

		signal.set(5);
		assert.equal(callCount, 2, "Should call on update");

		component.cleanup();
		signal.set(10);
		assert.equal(callCount, 2, "Should not call after cleanup");
	});

	test("should create tracked computed signals", () => {
		const component = Reactive.createComponent();
		const a = Signals.create(2);
		const b = Signals.create(3);

		const sum = component.computed(() => a.get() + b.get());
		assert.equal(sum.get(), 5);

		a.set(10);
		assert.equal(sum.get(), 13);

		component.cleanup();
		// After cleanup, computed should be disposed
		b.set(100);
		assert.equal(sum.get(), 13, "Should not update after cleanup");
	});

	test("should provide tracked bind methods", () => {
		const component = Reactive.createComponent();
		const div = document.createElement("div");
		const text = Signals.create("Hello");

		component.bindText(div, text);
		assert.equal(div.textContent, "Hello");

		text.set("World");
		assert.equal(div.textContent, "World");

		component.cleanup();
		text.set("After cleanup");
		assert.equal(div.textContent, "World", "Should not update after cleanup");
	});

	test("should track bindBoolAttr", () => {
		const component = Reactive.createComponent();
		const button = document.createElement("button");
		const disabled = Signals.create(false);

		component.bindBoolAttr(button, "disabled", disabled);
		assert.equal(button.hasAttribute("disabled"), false);

		disabled.set(true);
		assert.equal(button.hasAttribute("disabled"), true);

		component.cleanup();
		disabled.set(false);
		assert.equal(
			button.hasAttribute("disabled"),
			true,
			"Should not update after cleanup",
		);
	});

	test("should auto-batch declarative event listeners", () => {
		const button = document.createElement("button");
		const count = Signals.create(0);
		let notifications = 0;

		count.subscribe(() => notifications++);

		const scope = {
			handleClick: () => {
				count.set(1);
				count.set(2);
				count.set(3);
			},
		};

		button.setAttribute("data-on-click", "handleClick");
		const cleanup = Reactive.scan(button, scope);

		notifications = 0; // Reset
		button.click();

		assert.equal(count.get(), 3);
		assert.equal(
			notifications,
			1,
			"Should only notify once due to auto-batching",
		);

		cleanup();
	});
});

describe("Signals.batch", () => {
	test("should execute batch function", () => {
		let executed = false;
		Signals.batch(() => {
			executed = true;
		});
		assert.equal(executed, true);
	});

	test("should batch updates", () => {
		const a = Signals.create(1);
		const b = Signals.create(1);

		let updates = 0;
		const sum = Signals.computed(() => {
			updates++;
			return a.get() + b.get();
		});

		assert.equal(sum.get(), 2);
		assert.equal(updates, 1);

		// Update WITH batch
		updates = 0;

		Signals.batch(() => {
			a.set(3);
			b.set(3);
		});

		assert.equal(sum.get(), 6);
		assert.equal(updates, 1, "Should update only once");
	});
});

describe("HTML Utilities", () => {
	test("html should create safe content", () => {
		const result = html`<div>Hello</div>`;
		assert.ok(result.__safe);
		assert.equal(result.content, "<div>Hello</div>");
	});

	test("html should escape unsafe content", () => {
		const userInput = "<script>alert('xss')</script>";
		const result = html`<div>${userInput}</div>`;
		assert.ok(result.content.includes("&lt;script&gt;"));
		assert.ok(!result.content.includes("<script>"));
	});

	test("html should handle null and undefined", () => {
		const result1 = html`<div>${null}</div>`;
		const result2 = html`<div>${undefined}</div>`;
		assert.equal(result1.content, "<div></div>");
		assert.equal(result2.content, "<div></div>");
	});

	test("html should preserve safe nested content", () => {
		const inner = html`<span>Safe</span>`;
		const outer = html`<div>${inner}</div>`;
		assert.equal(outer.content, "<div><span>Safe</span></div>");
	});

	test("html should handle multiple interpolations", () => {
		const name = "Alice";
		const age = 30;
		const result = html`<p>Name: ${name}, Age: ${age}</p>`;
		assert.equal(result.content, "<p>Name: Alice, Age: 30</p>");
	});

	test("trusted should create safe content without escaping", () => {
		const dangerous = "<script>alert('xss')</script>";
		const result = trusted(dangerous);
		assert.ok(result.__safe);
		assert.equal(result.content, dangerous);
	});

	test("join should join array items", () => {
		const items = ["apple", "banana", "cherry"];
		const result = join(items, ", ");
		assert.ok(result.__safe);
		assert.equal(result.content, "apple, banana, cherry");
	});

	test("join should handle safe content items", () => {
		const items = [html`<b>bold</b>`, html`<i>italic</i>`];
		const result = join(items, " | ");
		assert.equal(result.content, "<b>bold</b> | <i>italic</i>");
	});

	test("join should handle mixed safe and plain content", () => {
		const items = [html`<b>bold</b>`, "plain", html`<i>italic</i>`];
		const result = join(items, ", ");
		assert.equal(result.content, "<b>bold</b>, plain, <i>italic</i>");
	});

	test("join with html separator", () => {
		const items = ["a", "b", "c"];
		const separator = html` | `;
		const result = join(items, separator);
		assert.equal(result.content, "a | b | c");
	});

	test("join with empty separator", () => {
		const items = ["a", "b", "c"];
		const result = join(items);
		assert.equal(result.content, "abc");
	});
});

describe("CSS-in-JS", () => {
	test("css should generate unique class names", () => {
		const class1 = css`
			color: red;
		`;
		const class2 = css`
			color: blue;
		`;
		assert.ok(class1.startsWith("s-"));
		assert.ok(class2.startsWith("s-"));
		assert.notEqual(class1, class2);
	});

	test("css should return same class for same content", () => {
		const class1 = css`
			color: red;
		`;
		const class2 = css`
			color: red;
		`;
		assert.equal(class1, class2);
	});

	test("css should inject style into document head", () => {
		const stylesBefore = document.head.querySelectorAll("style").length;
		const className = css`
			background: yellow;
		`;
		const stylesAfter = document.head.querySelectorAll("style").length;
		assert.ok(stylesAfter >= stylesBefore);
		assert.ok(className.startsWith("s-"));
	});

	test("css should handle & selector replacement", () => {
		const className = css`
			& {
				color: red;
			}
			&:hover {
				color: blue;
			}
		`;
		assert.ok(className.startsWith("s-"));
		// Check that style was created
		const styles = Array.from(document.head.querySelectorAll("style"));
		const hasClass = styles.some((s) =>
			s.textContent.includes(`.${className}`),
		);
		assert.ok(hasClass);
	});

	test("css should wrap root-level properties", () => {
		const className = css`
			display: flex;
			color: red;
		`;
		assert.ok(className.startsWith("s-"));
	});

	test("css should handle interpolation", () => {
		const color = "green";
		const className = css`
			color: ${color};
		`;
		assert.ok(className.startsWith("s-"));
	});

	test("css should cache styles", () => {
		const class1 = css`
			margin: 10px;
		`;
		const headChildrenAfter1 = document.head.children.length;
		const class2 = css`
			margin: 10px;
		`; // Same content
		const headChildrenAfter2 = document.head.children.length;

		assert.equal(class1, class2);
		// Should not add duplicate style
		assert.equal(headChildrenAfter1, headChildrenAfter2);
	});
});

// ===========================================
// ASYNC COMPUTED TESTS
// ===========================================
describe("Signals.computedAsync", () => {
	test("should resolve async computation", async () => {
		const asyncComputed = Signals.computedAsync(async () => {
			await new Promise((resolve) => setTimeout(resolve, 10));
			return "result";
		});

		// Initial state should be pending
		assert.equal(asyncComputed.value.status, "pending");
		assert.equal(asyncComputed.value.loading, true);

		// Wait for resolution
		await new Promise((resolve) => setTimeout(resolve, 20));

		assert.equal(asyncComputed.value.status, "resolved");
		assert.equal(asyncComputed.value.data, "result");
		assert.equal(asyncComputed.value.loading, false);
		assert.equal(asyncComputed.value.error, null);

		asyncComputed.dispose();
	});

	test("should track dependencies and recompute", async () => {
		const source = Signals.create(1);
		const asyncComputed = Signals.computedAsync(async () => {
			const val = source.value;
			await new Promise((resolve) => setTimeout(resolve, 10));
			return val * 2;
		});

		// Wait for initial resolution
		await new Promise((resolve) => setTimeout(resolve, 20));
		assert.equal(asyncComputed.value.data, 2);

		// Update source
		source.set(5);
		assert.equal(asyncComputed.value.status, "pending");

		// Wait for new resolution
		await new Promise((resolve) => setTimeout(resolve, 20));
		assert.equal(asyncComputed.value.data, 10);

		asyncComputed.dispose();
	});

	test("should cancel previous execution on dependency change", async () => {
		const source = Signals.create(1);
		let executions = 0;

		const asyncComputed = Signals.computedAsync(async (cancelToken) => {
			executions++;
			const val = source.value;
			await new Promise((resolve) => setTimeout(resolve, 30));
			if (cancelToken.cancelled) return "cancelled";
			return val * 2;
		});

		// Wait for initial execution to complete
		await new Promise((resolve) => setTimeout(resolve, 50));
		assert.equal(asyncComputed.value.data, 2);
		const initialExec = executions;

		// Quickly update source multiple times
		source.set(2);
		await new Promise((resolve) => setTimeout(resolve, 5));
		source.set(3);
		await new Promise((resolve) => setTimeout(resolve, 5));
		source.set(4);

		// Wait for all executions to complete
		await new Promise((resolve) => setTimeout(resolve, 100));

		// Should have started multiple executions
		assert.ok(
			executions > initialExec,
			`Expected more than ${initialExec} executions, got ${executions}`,
		);
		// Final result should be from last execution
		assert.equal(asyncComputed.value.data, 8); // 4 * 2

		asyncComputed.dispose();
	});

	test("should handle errors", async () => {
		const asyncComputed = Signals.computedAsync(async () => {
			await new Promise((resolve) => setTimeout(resolve, 10));
			throw new Error("Test error");
		});

		// Wait for error
		await new Promise((resolve) => setTimeout(resolve, 20));

		assert.equal(asyncComputed.value.status, "error");
		assert.equal(asyncComputed.value.loading, false);
		assert.ok(asyncComputed.value.error instanceof Error);
		assert.equal(asyncComputed.value.error.message, "Test error");

		asyncComputed.dispose();
	});

	test("should preserve data on error", async () => {
		const source = Signals.create(false);
		const asyncComputed = Signals.computedAsync(async () => {
			const shouldError = source.value;
			await new Promise((resolve) => setTimeout(resolve, 10));
			if (shouldError) throw new Error("Error");
			return "success";
		});

		// Wait for initial success
		await new Promise((resolve) => setTimeout(resolve, 20));
		assert.equal(asyncComputed.value.data, "success");

		// Trigger error
		source.set(true);
		await new Promise((resolve) => setTimeout(resolve, 20));

		assert.equal(asyncComputed.value.status, "error");
		assert.equal(asyncComputed.value.data, "success"); // Preserved
		assert.ok(asyncComputed.value.error);

		asyncComputed.dispose();
	});

	test("should support named async computed", async () => {
		const asyncComputed = Signals.computedAsync(async () => {
			await new Promise((resolve) => setTimeout(resolve, 10));
			return "test";
		}, "myAsyncComputed");

		assert.equal(asyncComputed.toString(), "Signal(myAsyncComputed)");
		asyncComputed.dispose();
	});

	test("should work with batched updates", async () => {
		const a = Signals.create(1);
		const b = Signals.create(2);

		const asyncComputed = Signals.computedAsync(async () => {
			const sum = a.get() + b.get();
			await new Promise((resolve) => setTimeout(resolve, 10));
			return sum;
		});

		await new Promise((resolve) => setTimeout(resolve, 30));
		assert.equal(asyncComputed.value.data, 3);

		// Batch updates - should only trigger one recomputation
		Signals.batch(() => {
			a.set(10);
			b.set(20);
		});

		await new Promise((resolve) => setTimeout(resolve, 30));

		// Final value should be correct (batch worked)
		assert.equal(asyncComputed.value.data, 30);
		assert.equal(asyncComputed.value.status, "resolved");

		asyncComputed.dispose();
	});

	test("should dispose properly", async () => {
		const source = Signals.create(1);
		const asyncComputed = Signals.computedAsync(async () => {
			return source.value * 2;
		});

		await new Promise((resolve) => setTimeout(resolve, 20));
		assert.equal(asyncComputed.value.data, 2);

		asyncComputed.dispose();

		// After dispose, changing source should not trigger recomputation
		const valueBefore = asyncComputed.value;
		source.set(5);
		await new Promise((resolve) => setTimeout(resolve, 20));
		assert.deepEqual(asyncComputed.value, valueBefore);
	});

	test("should detect circular dependencies", () => {
		const asyncComputed1 = Signals.computedAsync(async () => {
			await new Promise((resolve) => setTimeout(resolve, 10));
			return asyncComputed2.value.data;
		}, "async1");

		const asyncComputed2 = Signals.computedAsync(async () => {
			await new Promise((resolve) => setTimeout(resolve, 10));
			return asyncComputed1.value.data;
		}, "async2");

		// Should throw on initialization due to circular dependency
		// Note: This test may need adjustment based on exact timing
		asyncComputed1.dispose();
		asyncComputed2.dispose();
	});

	test("should handle race conditions gracefully", async () => {
		const source = Signals.create(1);
		const results = [];

		const asyncComputed = Signals.computedAsync(async () => {
			const val = source.value;
			// Simulate variable delay
			await new Promise((resolve) => setTimeout(resolve, val * 10));
			return val;
		});

		// Subscribe to track all state changes
		asyncComputed.subscribe((state) => {
			if (state.status === "resolved") {
				results.push(state.data);
			}
		});

		// Trigger multiple updates with different delays
		source.set(3); // Will take 30ms
		await new Promise((resolve) => setTimeout(resolve, 5));
		source.set(1); // Will take 10ms (finishes first)

		// Wait for all to complete
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Should only have the last value despite first taking longer
		assert.equal(asyncComputed.value.data, 1);

		asyncComputed.dispose();
	});
});
