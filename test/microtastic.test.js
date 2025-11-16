import assert from "node:assert";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { mock, test } from "node:test";
import { CONFIG, Microtastic } from "../index.js";

const testDir = path.join(tmpdir(), "microtastic-main-test");

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

test("Microtastic should create instance with logger", () => {
	const microtastic = new Microtastic();
	assert.ok(microtastic.logger);
});

test("Microtastic.loadSettings should handle missing, valid, and invalid config files", async () => {
	const microtastic = new Microtastic();

	// Test missing file
	const missingSettings = await microtastic.loadSettings(
		path.join(testDir, "nonexistent.json"),
	);
	assert.strictEqual(missingSettings.serverPort, CONFIG.DEFAULTS.serverPort);

	// Test valid file
	const settingsPath = path.join(testDir, CONFIG.FILES.CONFIG);
	await fs.writeFile(settingsPath, JSON.stringify({ serverPort: 3000 }));
	const validSettings = await microtastic.loadSettings(settingsPath);
	assert.strictEqual(validSettings.serverPort, 3000);
	assert.strictEqual(validSettings.minifyBuild, CONFIG.DEFAULTS.minifyBuild); // Should merge with defaults

	// Test invalid JSON
	await fs.writeFile(settingsPath, "invalid json {");
	const invalidSettings = await microtastic.loadSettings(settingsPath);
	assert.strictEqual(invalidSettings.serverPort, CONFIG.DEFAULTS.serverPort);
});

test("Microtastic.initialize should create CommandHandler with correct paths and settings", async () => {
	const originalCwd = process.cwd();
	process.chdir(testDir);

	const settingsPath = path.join(testDir, CONFIG.FILES.CONFIG);
	const customSettings = { serverPort: 9999 };
	await fs.writeFile(settingsPath, JSON.stringify(customSettings));

	try {
		const microtastic = new Microtastic();
		const handler = await microtastic.initialize();

		assert.ok(handler);
		assert.strictEqual(handler.paths.projectDir, testDir);
		assert.ok(handler.paths.appRootDir.includes(CONFIG.DIRS.APP));
		assert.ok(handler.paths.publicDir.includes(CONFIG.DIRS.PUBLIC));
		assert.strictEqual(handler.settings.serverPort, 9999);
	} finally {
		process.chdir(originalCwd);
	}
});

test("Microtastic.run should handle missing command", async () => {
	const originalArgv = process.argv;
	process.argv = ["node", "index.js"]; // No command

	const microtastic = new Microtastic();
	const exitSpy = mock.method(process, "exit", () => {});
	const errorSpy = mock.method(console, "error", () => {});

	// Mock logger.error to avoid console output
	microtastic.logger.error = () => {};

	await microtastic.run();

	assert.strictEqual(exitSpy.mock.calls.length, 1);
	assert.strictEqual(exitSpy.mock.calls[0].arguments[0], 1); // Exit code 1 for MicrotasticError

	exitSpy.mock.restore();
	errorSpy.mock.restore();
	process.argv = originalArgv;
});

test("Microtastic.run should handle invalid command", async () => {
	const originalArgv = process.argv;
	process.argv = ["node", "index.js", "invalidcommand"];

	const originalCwd = process.cwd();
	process.chdir(testDir);

	try {
		const microtastic = new Microtastic();
		const exitSpy = mock.method(process, "exit", () => {});
		microtastic.logger.error = () => {};

		await microtastic.run();

		assert.strictEqual(exitSpy.mock.calls.length, 1);
		assert.strictEqual(exitSpy.mock.calls[0].arguments[0], 1); // Exit code 1 for MicrotasticError

		exitSpy.mock.restore();
	} finally {
		process.chdir(originalCwd);
		process.argv = originalArgv;
	}
});
