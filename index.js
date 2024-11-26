#!/usr/bin/env node
import { promises as fs } from "node:fs";
import http from "node:http";
import path from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import commonjs from "@rollup/plugin-commonjs";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import { rollup } from "rollup";
import nodePolyfills from "rollup-plugin-polyfill-node";

const hrstart = process.hrtime();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Simplify CONFIG object
const CONFIG = {
	PORT: 8181,
	DIRS: { APP: "app", PUBLIC: "public", SRC: "src", DEPENDENCIES: "dependencies" },
	FILES: {
		BUNDLE: "main.js",
		BUNDLE_CHUNK: "main-[hash].js",
		CONFIG: ".microtastic",
		SW_TEMPLATE: "sw.tpl"
	},
	DEFAULTS: {
		genServiceWorker: false,
		minifyBuild: true,
		serverPort: 8181
	}
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

// Simplify Logger class
class Logger {
	static #colors = { error: "\x1b[31m", success: "\x1b[32m", info: "\x1b[36m", reset: "\x1b[0m" };
	
	constructor(options = {}) {
		this.silent = options.silent ?? false;
		this.isDebug = options.debug ?? false;
	}

	#log = (msg, color) => !this.silent && console.log(color ? `${color}${msg}${Logger.#colors.reset}` : msg);
	error = msg => this.#log(`ERROR: ${msg}`, Logger.#colors.error);
	success = msg => this.#log(msg, Logger.#colors.success);
	info = msg => this.#log(msg, Logger.#colors.info);
	debug = msg => this.isDebug && this.#log(`DEBUG: ${msg}`);
}

class FileManager {
	static async listRecursive(dir) {
		try {
			const files = await fs.readdir(dir, { recursive: true, withFileTypes: true });
			return files
				.filter(f => f.isFile())
				.map(f => path.join(f.path, f.name).replace(`${dir}${path.sep}`, ""));
		} catch (e) {
			throw new MicrotasticError(`Failed to list ${dir}: ${e.message}`, "LIST_ERROR");
		}
	}

	static async deleteRecursive(dir) {
		await fs.rm(dir, { recursive: true, force: true })
			.catch(e => { throw new MicrotasticError(`Failed to delete ${dir}: ${e.message}`, "DELETE_ERROR"); });
	}

	static async copyRecursive(src, dest, exclude = []) {
		if (exclude.includes(path.basename(src))) return;
		await fs.cp(src, dest, {
			recursive: true,
			force: true,
			filter: s => !exclude.includes(path.basename(s))
		}).catch(e => { throw new MicrotasticError(`Failed to copy ${src} to ${dest}: ${e.message}`, "COPY_ERROR"); });
	}

	static checkExists = async p => fs.access(p).then(() => true).catch(() => false);
}

// Simplify DevServer class
class DevServer {
	#sendResponse = (res, statusCode, content, req, contentType) => {
		res.statusCode = statusCode;
		if (contentType) res.setHeader("Content-type", contentType);
		res.end(content);
		console.log(statusCode === 200 ? "\x1b[32m" : "\x1b[31m", `${req.method} ${statusCode} ${req.url}\x1b[0m`);
	};

	constructor(root, mimes) {
		this.root = root;
		this.mimes = mimes;
	}

	createServer() {
		return http.createServer(async (req, res) => {
			try {
				const pathname = path.join(this.root, new URL(req.url, `http://${req.headers.host}`).pathname);
				const stats = await fs.stat(pathname).catch(() => null);
				
				if (!stats) return this.#sendResponse(res, 404, `File ${pathname} not found`, req);

				const finalPath = stats.isDirectory() ? path.join(pathname, "index.html") : pathname;
				const content = await fs.readFile(finalPath);
				this.#sendResponse(res, 200, content, req, this.mimes[path.parse(finalPath).ext] || "text/plain");
			} catch (e) {
				this.#sendResponse(res, 500, `Server error: ${e.message}`, req);
			}
		});
	}
}

// Simplify CommandHandler class
class CommandHandler {
	constructor(options) {
		this.logger = new Logger(options.logging);
		this.settings = options.settings;
		this.paths = options.paths;
		this.hrstart = process.hrtime();
	}

	async loadAppPackage() {
		try {
			this.appPkg = JSON.parse(await fs.readFile(this.paths.projectPkgPath, "utf8"));
			return this.appPkg;
		} catch (error) {
			throw new MicrotasticError(`Failed to load package.json: ${error.message}`, "PACKAGE_JSON_ERROR");
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

		appPkg.scripts.prepare = "microtastic prep";
		appPkg.scripts.dev = "microtastic dev";
		appPkg.scripts.build = "microtastic prod";
		await fs.writeFile(
			this.paths.projectPkgPath,
			JSON.stringify(appPkg, undefined, 2),
			"utf8",
		);

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
			if (!this.appPkg) throw new MicrotasticError("Failed to load package.json", "PACKAGE_JSON_ERROR");

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
				]
			};

			for (const dep of dependencies) {
				try {
					this.logger.info(`Processing dependency: ${dep}`);
					const bundle = await rollup({
						...bundleConfig,
						input: `${this.paths.projectNodeModulesDir}${dep}`
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
				throw new MicrotasticError("Failed to load package.json", "PACKAGE_JSON_ERROR");
			}

			// Clean and prepare directories
			await FileManager.deleteRecursive(this.paths.publicDir);
			await FileManager.copyRecursive(
				this.paths.appRootDir,
				this.paths.publicDir,
				[path.basename(this.paths.appSrcDir)]
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
				const swTemplate = await fs.readFile(path.join(__dirname, CONFIG.FILES.SW_TEMPLATE), "utf8");
				const files = await FileManager.listRecursive(CONFIG.DIRS.PUBLIC);
				const renderTemplate = (template, data) => 
					template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? "");
				const swContent = renderTemplate(swTemplate, {
					cacheName: `${this.appPkg.name}-${this.appPkg.version}-${Date.now()}`,
					cacheFiles: JSON.stringify(files, null, 4)
				});
				await fs.writeFile(path.join(CONFIG.DIRS.PUBLIC, "sw.js"), swContent);
			}

			// Log build completion time
			const hrend = process.hrtime(this.hrstart);
			this.logger.success(
				`Build completed in ${hrend[0]}s ${Math.round(hrend[1] / 1000000)}ms`
			);
		} catch (error) {
			this.logger.error(`Build failed: ${error.message}`);
			if (this.settings.debug) console.error(error.stack);
			throw error;
		}
	}

	dev() {
		const server = new DevServer(this.paths.appRootDir, MIME_TYPES);
		server.createServer().listen(this.settings.serverPort);
		this.logger.success(
			`Started dev server on localhost:${this.settings.serverPort}`,
		);
	}
}

// Simplify Microtastic class
class Microtastic {
	constructor() {
		this.logger = new Logger({
			silent: process.env.SILENT === "true",
			debug: process.env.DEBUG === "true"
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
			microtasticSettingsPath: path.join(
				projectDir,
				`/${CONFIG.FILES.CONFIG}`,
			),
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
			const loadedSettings = JSON.parse(await fs.readFile(settingsPath, "utf8"));
			return { ...CONFIG.DEFAULTS, ...loadedSettings };
		} catch {
			return CONFIG.DEFAULTS;
		}
	}

	async run() {
		try {
			const command = process.argv[2]?.toLowerCase();
			if (!command) throw new MicrotasticError("No command specified", "NO_COMMAND");

			const handler = await this.initialize();
			if (!(command in handler)) throw new MicrotasticError("Invalid command", "INVALID_COMMAND");

			await handler[command]();
		} catch (error) {
			this.logger.error(error.message);
			process.exit(error instanceof MicrotasticError ? 1 : 2);
		}
	}
}

const cli = new Microtastic();
cli.run();
