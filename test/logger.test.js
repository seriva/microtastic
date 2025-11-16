import assert from "node:assert";
import { mock, test } from "node:test";
import { Logger } from "../index.js";

test("Logger should create instance with options", () => {
	const logger1 = new Logger();
	assert.strictEqual(logger1.silent, false);
	assert.strictEqual(logger1.isDebug, false);

	const logger2 = new Logger({ silent: true, debug: true });
	assert.strictEqual(logger2.silent, true);
	assert.strictEqual(logger2.isDebug, true);
});

test("Logger should log messages when not silent", () => {
	const logger = new Logger({ silent: false });
	const consoleSpy = mock.method(console, "log", () => {});

	logger.error("Test error");
	logger.success("Test success");
	logger.info("Test info");

	assert.strictEqual(consoleSpy.mock.calls.length, 3);
	assert.ok(
		consoleSpy.mock.calls[0].arguments[0].includes("ERROR: Test error"),
	);
	assert.ok(consoleSpy.mock.calls[1].arguments[0].includes("Test success"));
	assert.ok(consoleSpy.mock.calls[2].arguments[0].includes("Test info"));

	consoleSpy.mock.restore();
});

test("Logger should not log when silent", () => {
	const logger = new Logger({ silent: true });
	const consoleSpy = mock.method(console, "log", () => {});

	logger.error("Test error");
	logger.success("Test success");
	logger.info("Test info");

	assert.strictEqual(consoleSpy.mock.calls.length, 0);
	consoleSpy.mock.restore();
});

test("Logger.debug should only log when debug is enabled and not silent", () => {
	const logger1 = new Logger({ silent: false, debug: true });
	const consoleSpy1 = mock.method(console, "log", () => {});
	logger1.debug("Test debug");
	assert.strictEqual(consoleSpy1.mock.calls.length, 1);
	consoleSpy1.mock.restore();

	const logger2 = new Logger({ silent: false, debug: false });
	const consoleSpy2 = mock.method(console, "log", () => {});
	logger2.debug("Test debug");
	assert.strictEqual(consoleSpy2.mock.calls.length, 0);
	consoleSpy2.mock.restore();

	const logger3 = new Logger({ silent: true, debug: true });
	const consoleSpy3 = mock.method(console, "log", () => {});
	logger3.debug("Test debug");
	assert.strictEqual(consoleSpy3.mock.calls.length, 0);
	consoleSpy3.mock.restore();
});
