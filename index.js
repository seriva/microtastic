#!/usr/bin/env node
import { exec } from "node:child_process";
import { promises as fs, realpathSync, watch } from "node:fs";
import http from "node:http";
import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import commonjs from "@rollup/plugin-commonjs";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import { rollup } from "rollup";
import nodePolyfills from "rollup-plugin-polyfill-node";

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONFIG = {
	DIRS: {
		APP: "app",
		PUBLIC: "public",
		SRC: "src",
		DEPENDENCIES: "dependencies",
	},
	FILES: {
		BUNDLE: "main.js",
		BUNDLE_CHUNK: "main-[hash].js",
		CONFIG: ".microtastic",
		SW_TEMPLATE: "sw.tpl",
	},
	DEFAULTS: {
		genServiceWorker: false,
		minifyBuild: true,
		serverPort: 8181,
		hotReload: true,
	},
};

const MIME_TYPES = {
	".html": "text/html",
	".js": "text/javascript",
	".css": "text/css",
	".json": "application/json",
	".png": "image/png",
	".jpg": "image/jpg",
	".gif": "image/gif",
	".svg": "image/svg+xml",
	".wav": "audio/wav",
	".ogg": "audio/mpeg",
	".mp4": "video/mp4",
	".woff": "application/font-woff",
	".woff2": "font/woff2",
	".ttf": "application/font-ttf",
	".eot": "application/vnd.ms-fontobject",
	".otf": "application/font-otf",
	".wasm": "application/wasm",
};

class MicrotasticError extends Error {
	constructor(message, code = "UNKNOWN_ERROR") {
		super(message);
		this.code = code;
	}
}

class Logger {
	static #colors = {
		error: "\x1b[31m",
		success: "\x1b[32m",
		info: "\x1b[36m",
		reset: "\x1b[0m",
	};

	constructor(options = {}) {
		this.silent = options.silent ?? false;
		this.isDebug = options.debug ?? false;
	}

	#log = (msg, color) =>
		!this.silent &&
		console.log(color ? `${color}${msg}${Logger.#colors.reset}` : msg);
	error = (msg) => this.#log(`ERROR: ${msg}`, Logger.#colors.error);
	success = (msg) => this.#log(msg, Logger.#colors.success);
	info = (msg) => this.#log(msg, Logger.#colors.info);
	debug = (msg) => this.isDebug && this.#log(`DEBUG: ${msg}`);
}

class FileManager {
	static async listRecursive(dir) {
		try {
			const files = await fs.readdir(dir, {
				recursive: true,
				withFileTypes: true,
			});
			return files
				.filter((f) => f.isFile())
				.map((f) => {
					// parentPath is available in Node.js 20+, fallback to path for older versions
					const filePath = f.parentPath || f.path || dir;
					const fullPath = path.join(filePath, f.name);
					const normalizedDir = path.resolve(dir);
					const normalizedPath = path.resolve(fullPath);
					return path.relative(normalizedDir, normalizedPath);
				});
		} catch (e) {
			throw new MicrotasticError(
				`Failed to list ${dir}: ${e.message}`,
				"LIST_ERROR",
			);
		}
	}

	static async deleteRecursive(dir) {
		await fs.rm(dir, { recursive: true, force: true }).catch((e) => {
			throw new MicrotasticError(
				`Failed to delete ${dir}: ${e.message}`,
				"DELETE_ERROR",
			);
		});
	}

	static async copyRecursive(src, dest, exclude = []) {
		if (exclude.includes(path.basename(src))) return;
		await fs
			.cp(src, dest, {
				recursive: true,
				force: true,
				filter: (s) => !exclude.includes(path.basename(s)),
			})
			.catch((e) => {
				throw new MicrotasticError(
					`Failed to copy ${src} to ${dest}: ${e.message}`,
					"COPY_ERROR",
				);
			});
	}

	static checkExists = async (p) =>
		fs
			.access(p)
			.then(() => true)
			.catch(() => false);

	static async copyFile(src, dest) {
		try {
			await fs.mkdir(path.dirname(dest), { recursive: true });
			await fs.copyFile(src, dest);
		} catch (e) {
			throw new MicrotasticError(
				`Failed to copy ${src} to ${dest}: ${e.message}`,
				"COPY_FILE_ERROR",
			);
		}
	}
}

class DevServer {
	#sendResponse = (res, statusCode, content, req, contentType) => {
		res.statusCode = statusCode;
		if (contentType) res.setHeader("Content-type", contentType);
		res.end(content);
		console.log(
			statusCode === 200 ? "\x1b[32m" : "\x1b[31m",
			`${req.method} ${statusCode} ${req.url}\x1b[0m`,
		);
	};

	#clients = new Set();
	#watcher = null;
	#reloadTimeout = null;

	constructor(root, mimes, enableHotReload = false, watchDir = null) {
		this.root = root;
		this.mimes = mimes;
		this.enableHotReload = enableHotReload;
		this.watchDir = watchDir;
	}

	#injectReloadScript(html) {
		const reloadScript = `<script>
(function() {
	if (!window.EventSource) return;
	const es = new EventSource('/__reload');
	es.onmessage = function(e) {
		if (e.data === 'reload') {
			window.location.reload();
		}
	};
	es.onerror = function() {
		es.close();
		setTimeout(function() {
			window.location.reload();
		}, 1000);
	};
})();
</script>`;

		if (html.includes("</body>")) {
			return html.replace("</body>", `${reloadScript}</body>`);
		}
		if (html.includes("</head>")) {
			return html.replace("</head>", `${reloadScript}</head>`);
		}
		return html + reloadScript;
	}

	watchFiles() {
		if (!this.enableHotReload || !this.watchDir) return;

		try {
			this.#watcher = watch(
				this.watchDir,
				{ recursive: true },
				(_eventType, filename) => {
					if (!filename) return;

					// Filter out irrelevant paths
					const normalizedPath = path.normalize(filename);
					if (
						normalizedPath.includes("node_modules") ||
						normalizedPath.includes(".git") ||
						normalizedPath.includes("dependencies")
					) {
						return;
					}

					// Debounce rapid file changes
					if (this.#reloadTimeout) {
						clearTimeout(this.#reloadTimeout);
					}

					this.#reloadTimeout = setTimeout(() => {
						this.#notifyClients();
					}, 100);
				},
			);
		} catch (error) {
			console.error(`Failed to watch directory: ${error.message}`);
		}
	}

	#notifyClients() {
		for (const client of this.#clients) {
			try {
				client.write("data: reload\n\n");
			} catch (_error) {
				this.#clients.delete(client);
			}
		}
	}

	close() {
		if (this.#watcher) {
			this.#watcher.close();
			this.#watcher = null;
		}
		if (this.#reloadTimeout) {
			clearTimeout(this.#reloadTimeout);
			this.#reloadTimeout = null;
		}
		for (const client of this.#clients) {
			try {
				client.end();
			} catch {
				// Ignore errors when closing
			}
		}
		this.#clients.clear();
	}

	createServer() {
		return http.createServer(async (req, res) => {
			try {
				// Handle SSE endpoint for hot reload
				if (this.enableHotReload && req.url === "/__reload") {
					res.writeHead(200, {
						"Content-Type": "text/event-stream",
						"Cache-Control": "no-cache",
						Connection: "keep-alive",
					});
					this.#clients.add(res);

					// Send keep-alive ping every 30 seconds
					const keepAlive = setInterval(() => {
						try {
							res.write(": keep-alive\n\n");
						} catch {
							clearInterval(keepAlive);
							this.#clients.delete(res);
						}
					}, 30000);

					res.on("close", () => {
						clearInterval(keepAlive);
						this.#clients.delete(res);
					});

					return;
				}

				const pathname = path.join(
					this.root,
					new URL(req.url, `http://${req.headers.host}`).pathname,
				);
				let stats = await fs.stat(pathname).catch(() => null);

				// SPA fallback: if file not found and no extension, serve index.html
				let finalPath;
				if (!stats) {
					const ext = path.extname(pathname);
					if (!ext || ext === ".html") {
						// No extension or .html - try index.html fallback for SPA routing
						finalPath = path.join(this.root, "index.html");
						stats = await fs.stat(finalPath).catch(() => null);
						if (!stats) {
							return this.#sendResponse(
								res,
								404,
								`File ${pathname} not found`,
								req,
							);
						}
					} else {
						// Has extension (like .js, .css) - it's a real 404
						return this.#sendResponse(
							res,
							404,
							`File ${pathname} not found`,
							req,
						);
					}
				} else {
					finalPath = stats.isDirectory()
						? path.join(pathname, "index.html")
						: pathname;
				}
				let content = await fs.readFile(finalPath);

				// Inject reload script into HTML files if hot reload is enabled
				if (this.enableHotReload && path.parse(finalPath).ext === ".html") {
					content = Buffer.from(this.#injectReloadScript(content.toString()));
				}

				this.#sendResponse(
					res,
					200,
					content,
					req,
					this.mimes[path.parse(finalPath).ext] || "text/plain",
				);
			} catch (e) {
				this.#sendResponse(res, 500, `Server error: ${e.message}`, req);
			}
		});
	}
}

class CommandHandler {
	constructor(options) {
		this.logger = new Logger(options.logging);
		this.settings = options.settings;
		this.paths = options.paths;
		this.hrstart = process.hrtime();
	}

	async loadAppPackage() {
		try {
			this.appPkg = JSON.parse(
				await fs.readFile(this.paths.projectPkgPath, "utf8"),
			);
			return this.appPkg;
		} catch (error) {
			throw new MicrotasticError(
				`Failed to load package.json: ${error.message}`,
				"PACKAGE_JSON_ERROR",
			);
		}
	}

	async version() {
		const microtasticPkg = JSON.parse(
			await fs.readFile(
				path.join(this.paths.microtasticDir, "/package.json"),
				"utf8",
			),
		);
		this.logger.success(`Version: ${microtasticPkg.version}`);
	}

	async init() {
		if (
			await FileManager.checkExists(
				path.join(this.paths.projectDir, `/${CONFIG.DIRS.APP}/`),
			)
		) {
			throw new MicrotasticError(
				"Project already initialized",
				"ALREADY_INITIALIZED",
			);
		}

		await FileManager.copyRecursive(
			path.join(this.paths.microtasticDir, "/template/"),
			this.paths.projectDir,
			[],
		);

		// Ensure root biome.json exists even if template copy skips dotfiles in some environments
		await FileManager.copyFile(
			path.join(this.paths.microtasticDir, "/template/biome.json"),
			path.join(this.paths.projectDir, "/biome.json"),
		);

		// Copy reactive.js to app/src so it can be imported in the browser
		await FileManager.copyFile(
			path.join(this.paths.microtasticDir, "/reactive.js"),
			path.join(
				this.paths.projectDir,
				`/${CONFIG.DIRS.APP}/${CONFIG.DIRS.SRC}/reactive.js`,
			),
		);

		const appPkg = await this.loadAppPackage();
		appPkg.scripts ??= {};
		appPkg.scripts.prepare = "microtastic prep";
		appPkg.scripts.dev = "microtastic dev";
		appPkg.scripts.dependencies = "microtastic prep";
		appPkg.scripts.prod = "microtastic prod";
		appPkg.scripts.format = "biome format --write .";
		appPkg.scripts.check = "biome check .";
		await fs.writeFile(
			this.paths.projectPkgPath,
			JSON.stringify(appPkg, undefined, 2),
			"utf8",
		);

		// Install Biome version matching the template configuration
		try {
			const microtasticPkg = JSON.parse(
				await fs.readFile(
					path.join(this.paths.microtasticDir, "/package.json"),
					"utf8",
				),
			);
			const biomeVersion = microtasticPkg.devDependencies["@biomejs/biome"];
			if (biomeVersion) {
				this.logger.info(`Installing @biomejs/biome@${biomeVersion}...`);
				await execAsync(
					`npm install --save-dev @biomejs/biome@${biomeVersion}`,
					{ cwd: this.paths.projectDir },
				);
				this.logger.success("Biome installed successfully");
			}
		} catch (error) {
			this.logger.error(
				`Failed to install Biome: ${error.message}. You can install it manually with: npm install --save-dev @biomejs/biome`,
			);
		}

		if (await FileManager.checkExists(this.paths.projectGitIgnorePath)) {
			await fs.appendFile(
				this.paths.projectGitIgnorePath,
				"\n# microtastic specific\npublic\napp/src/dependencies",
			);
		}
	}

	async prep() {
		try {
			await this.loadAppPackage();
			if (!this.appPkg)
				throw new MicrotasticError(
					"Failed to load package.json",
					"PACKAGE_JSON_ERROR",
				);

			this.logger.info("Starting dependency preparation...");

			// Early return if no dependencies
			const dependencies = Object.keys(this.appPkg.dependencies || {});
			if (dependencies.length === 0) {
				this.logger.info("No dependencies found in package.json");
				return;
			}

			// Reset dependencies directory
			await FileManager.deleteRecursive(this.paths.appDependenciesDir);
			await fs.mkdir(this.paths.appDependenciesDir, { recursive: true });

			// Bundle each dependency
			const bundleConfig = {
				plugins: [
					nodeResolve({ preferBuiltins: true }),
					commonjs(),
					nodePolyfills(),
				],
			};

			for (const dep of dependencies) {
				try {
					this.logger.info(`Processing dependency: ${dep}`);
					const bundle = await rollup({
						...bundleConfig,
						input: `${this.paths.projectNodeModulesDir}${dep}`,
					});

					await bundle.write({
						format: "es",
						entryFileNames: `${dep}.js`,
						dir: this.paths.appDependenciesDir,
					});

					await bundle.close();
					this.logger.success(`Successfully bundled ${dep}`);
				} catch (error) {
					this.logger.error(`Error bundling ${dep}: ${error.message}`);
				}
			}

			// Copy assets if assetCopy is defined
			const assets = this.appPkg.assetCopy || [];
			if (assets.length > 0) {
				this.logger.info(`Copying ${assets.length} assets...`);
				for (const asset of assets) {
					try {
						const { source, dest } = asset;
						const srcPath = path.join(this.paths.projectDir, source);
						const destPath = path.join(this.paths.projectDir, dest);

						// Check if source is a directory or file
						const stats = await fs.stat(srcPath).catch(() => null);
						if (!stats) {
							throw new Error(`Source path does not exist: ${source}`);
						}

						if (stats.isDirectory()) {
							await FileManager.copyRecursive(srcPath, destPath, []);
							this.logger.success(`Copied directory ${dest}`);
						} else {
							await FileManager.copyFile(srcPath, destPath);
							this.logger.success(`Copied ${dest}`);
						}
					} catch (error) {
						this.logger.error(`Failed to copy asset: ${error.message}`);
					}
				}
			}

			this.logger.success("Dependency preparation completed");
		} catch (error) {
			this.logger.error(`Prep failed: ${error.message}`);
			if (this.settings.debug) console.error(error.stack);
			throw error;
		}
	}

	async prod() {
		try {
			this.logger.info("Starting production build...");

			// Load and validate package.json
			await this.loadAppPackage();
			if (!this.appPkg) {
				throw new MicrotasticError(
					"Failed to load package.json",
					"PACKAGE_JSON_ERROR",
				);
			}

			// Clean and prepare directories
			await FileManager.deleteRecursive(this.paths.publicDir);
			await FileManager.copyRecursive(
				this.paths.appRootDir,
				this.paths.publicDir,
				[path.basename(this.paths.appSrcDir)],
			);

			// Bundle application
			this.logger.info("Bundling application...");
			const bundle = await rollup({
				input: this.paths.appSrcEntryPath,
				plugins: [this.settings.minifyBuild && terser()].filter(Boolean),
				preserveEntrySignatures: false,
			});

			await bundle.write({
				format: "es",
				entryFileNames: CONFIG.FILES.BUNDLE,
				chunkFileNames: CONFIG.FILES.BUNDLE_CHUNK,
				dir: this.paths.publicSrcDir,
			});
			await bundle.close();

			// Generate service worker if enabled
			if (this.settings.genServiceWorker) {
				const swTemplate = await fs.readFile(
					path.join(__dirname, CONFIG.FILES.SW_TEMPLATE),
					"utf8",
				);
				const files = await FileManager.listRecursive(CONFIG.DIRS.PUBLIC);
				const renderTemplate = (template, data) =>
					template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? "");
				const swContent = renderTemplate(swTemplate, {
					cacheName: `${this.appPkg.name}-${this.appPkg.version}-${Date.now()}`,
					cacheFiles: JSON.stringify(files, null, 4),
				});
				await fs.writeFile(path.join(CONFIG.DIRS.PUBLIC, "sw.js"), swContent);
			}

			// Log build completion time
			const hrend = process.hrtime(this.hrstart);
			this.logger.success(
				`Build completed in ${hrend[0]}s ${Math.round(hrend[1] / 1000000)}ms`,
			);
		} catch (error) {
			this.logger.error(`Build failed: ${error.message}`);
			if (this.settings.debug) console.error(error.stack);
			throw error;
		}
	}

	dev() {
		const hotReload = this.settings.hotReload ?? CONFIG.DEFAULTS.hotReload;
		const server = new DevServer(
			this.paths.appRootDir,
			MIME_TYPES,
			hotReload,
			this.paths.appRootDir,
		);
		const httpServer = server.createServer();
		httpServer.listen(this.settings.serverPort);

		if (hotReload) {
			server.watchFiles();
			this.logger.success(
				`Started dev server on localhost:${this.settings.serverPort} (hot reload enabled)`,
			);
		} else {
			this.logger.success(
				`Started dev server on localhost:${this.settings.serverPort}`,
			);
		}

		// Handle graceful shutdown
		process.on("SIGINT", () => {
			server.close();
			httpServer.close();
			process.exit(0);
		});
		process.on("SIGTERM", () => {
			server.close();
			httpServer.close();
			process.exit(0);
		});
	}
}

class Microtastic {
	constructor() {
		this.logger = new Logger({
			silent: process.env.SILENT === "true",
			debug: process.env.DEBUG === "true",
		});
	}

	async initialize() {
		const projectDir = process.cwd();
		const microtasticDir = __dirname;

		const paths = {
			projectDir,
			microtasticDir,
			projectNodeModulesDir: path.join(projectDir, "/node_modules/"),
			projectPkgPath: path.join(projectDir, "/package.json"),
			projectGitIgnorePath: path.join(projectDir, "/.gitignore"),
			microtasticSettingsPath: path.join(projectDir, `/${CONFIG.FILES.CONFIG}`),
			appRootDir: path.join(projectDir, `/${CONFIG.DIRS.APP}/`),
		};

		paths.appSrcDir = path.join(paths.appRootDir, `/${CONFIG.DIRS.SRC}/`);
		paths.appSrcEntryPath = path.join(paths.appSrcDir, "main.js");
		paths.appDependenciesDir = path.join(
			paths.appSrcDir,
			`${CONFIG.DIRS.DEPENDENCIES}/`,
		);
		paths.publicDir = path.join(projectDir, `/${CONFIG.DIRS.PUBLIC}/`);
		paths.publicSrcDir = path.join(paths.publicDir, `/${CONFIG.DIRS.SRC}/`);

		const settings = await this.loadSettings(paths.microtasticSettingsPath);

		return new CommandHandler({
			logging: {
				silent: process.env.SILENT === "true",
				debug: process.env.DEBUG === "true",
			},
			settings,
			paths,
		});
	}

	async loadSettings(settingsPath) {
		try {
			const loadedSettings = JSON.parse(
				await fs.readFile(settingsPath, "utf8"),
			);
			return { ...CONFIG.DEFAULTS, ...loadedSettings };
		} catch {
			return CONFIG.DEFAULTS;
		}
	}

	async run() {
		try {
			const command = process.argv[2]?.toLowerCase();
			if (!command)
				throw new MicrotasticError("No command specified", "NO_COMMAND");

			const handler = await this.initialize();
			if (!(command in handler))
				throw new MicrotasticError("Invalid command", "INVALID_COMMAND");

			await handler[command]();
		} catch (error) {
			this.logger.error(error.message);
			process.exit(error instanceof MicrotasticError ? 1 : 2);
		}
	}
}

// Export classes for testing
export {
	MicrotasticError,
	Logger,
	FileManager,
	DevServer,
	CommandHandler,
	Microtastic,
	CONFIG,
	MIME_TYPES,
};

// Only run CLI if this is the main module (not imported)
try {
	if (
		process.argv[1] &&
		realpathSync(process.argv[1]) ===
			realpathSync(fileURLToPath(import.meta.url))
	) {
		const cli = new Microtastic();
		cli.run();
	}
} catch {
	// If realpathSync fails or process.argv[1] doesn't exist, skip (likely being imported)
}
