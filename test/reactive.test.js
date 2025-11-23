// Test reactive system - Signals and Reactive utilities
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import "./setup.js";
import { Signals, Reactive, html } from "../reactive.js";

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
});

describe("Computed Signals", () => {
	test("should create computed signal", () => {
		const firstName = Signals.create("John");
		const lastName = Signals.create("Doe");
		const fullName = Signals.computed(
			() => `${firstName.get()} ${lastName.get()}`
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
		const component = Reactive.mount(div, () => html`<span>Count: ${counter}</span>`);

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
			handleClick: () => { clicked = true; }
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
			isActive: Signals.create(false)
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
					isActive: true
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
					fullName: () => `${this.firstName.get()} ${this.lastName.get()}`
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
						age: 30
					},
					// Explicit nested signals
					settings: {
						theme: this.signal("dark"),
						notifications: this.signal(true)
					}
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
			}
		};

		button.setAttribute("data-on-click", "handleClick");
		const cleanup = Reactive.scan(button, scope);

		notifications = 0; // Reset
		button.click();

		assert.equal(count.get(), 3);
		assert.equal(notifications, 1, "Should only notify once due to auto-batching");

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

