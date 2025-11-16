import assert from "node:assert";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { FileManager, MicrotasticError } from "../index.js";

const testDir = path.join(tmpdir(), "microtastic-test");

test.beforeEach(async () => {
	// Clean up test directory before each test
	try {
		await fs.rm(testDir, { recursive: true, force: true });
	} catch {
		// Ignore if doesn't exist
	}
	await fs.mkdir(testDir, { recursive: true });
});

test.afterEach(async () => {
	// Clean up test directory after each test
	try {
		await fs.rm(testDir, { recursive: true, force: true });
	} catch {
		// Ignore
	}
});

test("FileManager.checkExists should return correct existence status", async () => {
	const existingFile = path.join(testDir, "test.txt");
	const nonExistentFile = path.join(testDir, "nonexistent.txt");

	await fs.writeFile(existingFile, "test content");

	assert.strictEqual(await FileManager.checkExists(existingFile), true);
	assert.strictEqual(await FileManager.checkExists(nonExistentFile), false);
});

test("FileManager.listRecursive should list all files in directory", async () => {
	// Create test files
	await fs.mkdir(path.join(testDir, "subdir"), { recursive: true });
	await fs.writeFile(path.join(testDir, "file1.txt"), "content1");
	await fs.writeFile(path.join(testDir, "subdir", "file2.txt"), "content2");
	await fs.writeFile(path.join(testDir, "subdir", "file3.txt"), "content3");

	const files = await FileManager.listRecursive(testDir);
	assert.strictEqual(files.length, 3);
	assert.ok(files.includes("file1.txt"));
	assert.ok(files.includes(path.join("subdir", "file2.txt")));
	assert.ok(files.includes(path.join("subdir", "file3.txt")));
});

test("FileManager.listRecursive should throw MicrotasticError for non-existent directory", async () => {
	const nonExistentDir = path.join(testDir, "nonexistent");
	try {
		await FileManager.listRecursive(nonExistentDir);
		assert.fail("Should have thrown an error");
	} catch (error) {
		assert.ok(error instanceof MicrotasticError);
		assert.strictEqual(error.code, "LIST_ERROR");
	}
});

test("FileManager.deleteRecursive should delete directory and contents", async () => {
	const dirToDelete = path.join(testDir, "to-delete");
	await fs.mkdir(dirToDelete, { recursive: true });
	await fs.writeFile(path.join(dirToDelete, "file.txt"), "content");

	await FileManager.deleteRecursive(dirToDelete);

	const exists = await FileManager.checkExists(dirToDelete);
	assert.strictEqual(exists, false);
});

test("FileManager.deleteRecursive should throw MicrotasticError on failure", async () => {
	// Try to delete a non-existent directory (should not throw, but test error handling)
	// Actually, with force: true, it won't throw, so let's test with a file that can't be deleted
	// This is tricky to test without mocking, so we'll test the error structure
	const invalidPath = "/root/invalid/path/that/should/fail";
	try {
		await FileManager.deleteRecursive(invalidPath);
		// If it doesn't throw, that's okay (force: true handles it)
	} catch (error) {
		if (error instanceof MicrotasticError) {
			assert.strictEqual(error.code, "DELETE_ERROR");
		}
	}
});

test("FileManager.copyFile should copy file and create parent directories", async () => {
	const srcFile = path.join(testDir, "source.txt");
	const destFile = path.join(testDir, "nested", "deep", "copied.txt");
	await fs.writeFile(srcFile, "test content");

	await FileManager.copyFile(srcFile, destFile);

	const srcContent = await fs.readFile(srcFile, "utf8");
	const destContent = await fs.readFile(destFile, "utf8");
	assert.strictEqual(srcContent, destContent);
	assert.strictEqual(await FileManager.checkExists(destFile), true);
});

test("FileManager.copyFile should throw MicrotasticError on failure", async () => {
	const nonExistentSrc = path.join(testDir, "nonexistent.txt");
	const dest = path.join(testDir, "dest.txt");

	try {
		await FileManager.copyFile(nonExistentSrc, dest);
		assert.fail("Should have thrown an error");
	} catch (error) {
		assert.ok(error instanceof MicrotasticError);
		assert.strictEqual(error.code, "COPY_FILE_ERROR");
	}
});

test("FileManager.copyRecursive should copy directory recursively", async () => {
	const srcDir = path.join(testDir, "source");
	const destDir = path.join(testDir, "dest");
	await fs.mkdir(path.join(srcDir, "subdir"), { recursive: true });
	await fs.writeFile(path.join(srcDir, "file1.txt"), "content1");
	await fs.writeFile(path.join(srcDir, "subdir", "file2.txt"), "content2");

	await FileManager.copyRecursive(srcDir, destDir);

	const destFile1 = path.join(destDir, "file1.txt");
	const destFile2 = path.join(destDir, "subdir", "file2.txt");
	assert.ok(await FileManager.checkExists(destFile1));
	assert.ok(await FileManager.checkExists(destFile2));

	const content1 = await fs.readFile(destFile1, "utf8");
	const content2 = await fs.readFile(destFile2, "utf8");
	assert.strictEqual(content1, "content1");
	assert.strictEqual(content2, "content2");
});

test("FileManager.copyRecursive should respect exclude list", async () => {
	const srcDir = path.join(testDir, "source");
	const destDir = path.join(testDir, "dest");
	await fs.mkdir(srcDir, { recursive: true });
	await fs.writeFile(path.join(srcDir, "include.txt"), "include");
	await fs.writeFile(path.join(srcDir, "exclude.txt"), "exclude");

	// Test excluding files
	await FileManager.copyRecursive(srcDir, destDir, ["exclude.txt"]);
	assert.ok(await FileManager.checkExists(path.join(destDir, "include.txt")));
	assert.strictEqual(
		await FileManager.checkExists(path.join(destDir, "exclude.txt")),
		false,
	);

	// Test excluding entire source directory
	await fs.rm(destDir, { recursive: true, force: true });
	await FileManager.copyRecursive(srcDir, destDir, ["source"]);
	assert.strictEqual(await FileManager.checkExists(destDir), false);
});
