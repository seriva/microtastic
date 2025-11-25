import { css, html, Reactive } from "./reactive.js";

class App extends Reactive.Component {
	state() {
		return {
			count: 0,
			name: "World",
		};
	}

	mount() {
		// Use computedAsync to fetch a random repo whenever the count changes
		this.randomRepo = this.computedAsync(async () => {
			// We still want to re-fetch when the count changes, so we get it here.
			this.count.get();
			// Use the GitHub API to get a list of public repositories
			const response = await fetch("https://api.github.com/repositories");
			if (!response.ok) {
				throw new Error("Network response was not ok.");
			}
			const repos = await response.json();
			// Pick a random repository from the list
			const randomRepo = repos[Math.floor(Math.random() * repos.length)];
			return `Random repo: ${randomRepo.full_name}`;
		}, "randomRepo");
	}

	styles() {
		return css`
			max-width: 600px;
			margin: 40px auto;
			padding: 20px;
			font-family: system-ui, -apple-system, sans-serif;
			
			h1 {
				color: #333;
				margin-bottom: 20px;
			}
			
			.counter {
				background: #f5f5f5;
				padding: 20px;
				border-radius: 8px;
				margin: 20px 0;
			}
			
			button {
				background: #007bff;
				color: white;
				border: none;
				padding: 10px 20px;
				border-radius: 4px;
				cursor: pointer;
				margin: 0 5px;
				font-size: 16px;
				
				&:hover {
					background: #0056b3;
				}
			}
			
			input {
				padding: 8px 12px;
				border: 1px solid #ddd;
				border-radius: 4px;
				font-size: 16px;
				margin: 10px 0;
				width: 200px;
			}

			.repo {
				background: #eef;
				padding: 15px;
				border-left: 4px solid #77f;
				margin-top: 20px;
				min-height: 50px;
				display: flex;
				align-items: center;
				justify-content: center;
			}

			.repo-loading {
				opacity: 0.5;
			}

			.repo-error {
				background: #fee;
				border-left-color: #f77;
				color: #c00;
			}
		`;
	}

	template() {
		return html`
			<div>
				<h1>Hello, <span data-text="name"></span>!</h1>
				<p>Welcome to your Microtastic application with reactive.js</p>
				
				<div class="counter">
					<h2>Counter: <span data-text="count"></span></h2>
					<button data-on-click="increment">Increment</button>
					<button data-on-click="decrement">Decrement</button>
					<button data-on-click="reset">Reset</button>
				</div>
				
				<div>
					<label>
						Your name:
						<input 
							data-model="name" 
							placeholder="Enter your name"
						/>
					</label>
				</div>

				<div data-bind="randomRepo"></div>
			</div>
		`;
	}

	increment() {
		this.count.update((n) => n + 1);
	}

	decrement() {
		this.count.update((n) => n - 1);
	}

	reset() {
		this.count.set(0);
	}

	// Custom binding handler for the randomRepo computedAsync signal
	bind_randomRepo(el, signal) {
		return signal.subscribe((state) => {
			el.className = "repo"; // Reset classes
			if (state.loading) {
				el.classList.add("repo-loading");
				el.textContent = "Fetching from GitHub...";
			} else if (state.error) {
				el.classList.add("repo-error");
				el.textContent = `Error: ${state.error.message}`;
			} else if (state.resolved) {
				el.textContent = state.data;
			}
		});
	}
}

// Initialize the app
window.onload = () => {
	const app = new App();
	app.mountTo("app");
};
