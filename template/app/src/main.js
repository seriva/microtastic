import { css, html, Reactive } from "./reactive.js";

class App extends Reactive.Component {
	state() {
		return {
			count: 0,
			name: "World",
		};
	}

	init() {
		// Create the async repo fetcher that depends on count
		this.asyncRepo = this.computedAsync(async () => {
			// Re-fetch when the count changes
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

		// Create computed signals for the template
		this.repoText = this.computed(() => {
			const state = this.asyncRepo.get();
			if (state.loading) return "Fetching from GitHub...";
			if (state.error) return `Error: ${state.error.message}`;
			if (state.status === "resolved") return state.data;
			return "";
		});

		this.repoClass = this.computed(() => {
			const state = this.asyncRepo.get();
			let classes = "repo";
			if (state.loading) classes += " repo-loading";
			if (state.error) classes += " repo-error";
			return classes;
		});
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

				<div data-attr-class="repoClass" data-text="repoText"></div>
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
}

// Initialize the app
window.onload = () => {
	const app = new App();
	app.mountTo("app");
};
