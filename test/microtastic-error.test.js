import assert from "node:assert";
import { test } from "node:test";
import { MicrotasticError } from "../index.js";

test("MicrotasticError should create error with message and code", () => {
	const error = new MicrotasticError("Test error", "TEST_CODE");
	assert.ok(error instanceof Error);
	assert.strictEqual(error.message, "Test error");
	assert.strictEqual(error.code, "TEST_CODE");
});

test("MicrotasticError should use default code when not provided", () => {
	const error = new MicrotasticError("Test error");
	assert.strictEqual(error.code, "UNKNOWN_ERROR");
});

test("MicrotasticError should be throwable and catchable", () => {
	try {
		throw new MicrotasticError("Test error", "TEST_ERROR");
	} catch (error) {
		assert.ok(error instanceof MicrotasticError);
		assert.strictEqual(error.message, "Test error");
		assert.strictEqual(error.code, "TEST_ERROR");
	}
});
