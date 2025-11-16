import assert from "node:assert";
import { promises as fs } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { mock, test } from "node:test";
import { fileURLToPath } from "node:url";
import { CONFIG, CommandHandler, Logger, MicrotasticError } from "../index.js";

const testDir = path.join(tmpdir(), "microtastic-command-handler-test");

test.beforeEach(async () => {
	await fs.mkdir(testDir, { recursive: true });
});

test.afterEach(async () => {
	try {
		await fs.rm(testDir, { recursive: true, force: true });
	} catch {
		// Ignore
	}
});

test("CommandHandler should create instance with options", () => {
	const handler = new CommandHandler({
		logging: { silent: true, debug: false },
		settings: { serverPort: 3000 },
		paths: { projectDir: testDir },
	});

	assert.ok(handler.logger instanceof Logger);
	assert.strictEqual(handler.settings.serverPort, 3000);
	assert.strictEqual(handler.paths.projectDir, testDir);
});

test("CommandHandler.loadAppPackage should load package.json", async () => {
	const pkgPath = path.join(testDir, "package.json");
	const pkgContent = { name: "test-app", version: "1.0.0" };
	await fs.writeFile(pkgPath, JSON.stringify(pkgContent));

	const handler = new CommandHandler({
		logging: { silent: true },
		settings: {},
		paths: { projectPkgPath: pkgPath },
	});

	const pkg = await handler.loadAppPackage();
	assert.strictEqual(pkg.name, "test-app");
	assert.strictEqual(pkg.version, "1.0.0");
});

test("CommandHandler.loadAppPackage should throw MicrotasticError on failure", async () => {
	const handler = new CommandHandler({
		logging: { silent: true },
		settings: {},
		paths: { projectPkgPath: path.join(testDir, "nonexistent.json") },
	});

	try {
		await handler.loadAppPackage();
		assert.fail("Should have thrown an error");
	} catch (error) {
		assert.ok(error instanceof MicrotasticError);
		assert.strictEqual(error.code, "PACKAGE_JSON_ERROR");
	}
});

test("CommandHandler.version should log version from package.json", async () => {
	const currentFile = fileURLToPath(import.meta.url);
	const testDir = path.dirname(currentFile);
	const microtasticDir = path.resolve(testDir, "..");
	const pkgPath = path.join(microtasticDir, "package.json");
	const pkgContent = await fs.readFile(pkgPath, "utf8");
	const pkg = JSON.parse(pkgContent);

	const handler = new CommandHandler({
		logging: { silent: false, debug: false },
		settings: {},
		paths: { microtasticDir },
	});

	const consoleSpy = mock.method(console, "log", () => {});
	await handler.version();
	assert.strictEqual(consoleSpy.mock.calls.length, 1);
	assert.ok(consoleSpy.mock.calls[0].arguments[0].includes(pkg.version));
	consoleSpy.mock.restore();
});

test("CommandHandler.init should throw if app directory exists", async () => {
	const appDir = path.join(testDir, CONFIG.DIRS.APP);
	await fs.mkdir(appDir, { recursive: true });

	const handler = new CommandHandler({
		logging: { silent: true },
		settings: {},
		paths: {
			projectDir: testDir,
			projectPkgPath: path.join(testDir, "package.json"),
			projectGitIgnorePath: path.join(testDir, ".gitignore"),
		},
	});

	try {
		await handler.init();
		assert.fail("Should have thrown an error");
	} catch (error) {
		assert.ok(error instanceof MicrotasticError);
		assert.strictEqual(error.code, "ALREADY_INITIALIZED");
	}
});

test("CommandHandler.prep should handle no dependencies", async () => {
	const pkgPath = path.join(testDir, "package.json");
	const pkgContent = { name: "test-app", dependencies: {} };
	await fs.writeFile(pkgPath, JSON.stringify(pkgContent));

	const depsDir = path.join(testDir, "deps");
	await fs.mkdir(depsDir, { recursive: true });

	const handler = new CommandHandler({
		logging: { silent: false, debug: false },
		settings: {},
		paths: {
			projectPkgPath: pkgPath,
			appDependenciesDir: depsDir,
			projectNodeModulesDir: path.join(testDir, "node_modules"),
		},
	});

	const consoleSpy = mock.method(console, "log", () => {});
	await handler.prep();
	// Should log "No dependencies found"
	assert.ok(
		consoleSpy.mock.calls.some((call) =>
			call.arguments[0].includes("No dependencies found"),
		),
	);
	consoleSpy.mock.restore();
});

test("CommandHandler.prep should throw if package.json cannot be loaded", async () => {
	const handler = new CommandHandler({
		logging: { silent: true },
		settings: {},
		paths: {
			projectPkgPath: path.join(testDir, "nonexistent.json"),
			appDependenciesDir: path.join(testDir, "deps"),
		},
	});

	try {
		await handler.prep();
		assert.fail("Should have thrown an error");
	} catch (error) {
		assert.ok(error instanceof MicrotasticError);
		assert.strictEqual(error.code, "PACKAGE_JSON_ERROR");
	}
});

test("CommandHandler.dev should start dev server", () => {
	const handler = new CommandHandler({
		logging: { silent: false, debug: false },
		settings: { serverPort: 8181 },
		paths: { appRootDir: testDir },
	});

	const consoleSpy = mock.method(console, "log", () => {});

	// Mock http.Server.listen to avoid actually starting a server
	const originalListen = http.Server.prototype.listen;
	http.Server.prototype.listen = function (_port, callback) {
		if (callback) callback();
		return this;
	};

	handler.dev();

	assert.ok(
		consoleSpy.mock.calls.some((call) =>
			call.arguments[0].includes("Started dev server"),
		),
	);

	http.Server.prototype.listen = originalListen;
	consoleSpy.mock.restore();
});
