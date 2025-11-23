import { css, html, Reactive } from "microtastic/reactive";

class App extends Reactive.Component {
	state() {
		return {
			count: 0,
			name: "World",
		};
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
		`;
	}

	template() {
		return html`
			<div>
				<h1>Hello, ${this.name.get()}!</h1>
				<p>Welcome to your Microtastic application with reactive.js</p>
				
				<div class="counter">
					<h2>Counter: ${this.count.get()}</h2>
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
