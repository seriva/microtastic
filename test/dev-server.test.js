import assert from "node:assert";
import { promises as fs } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { mock, test } from "node:test";
import { DevServer, MIME_TYPES } from "../index.js";

const testDir = path.join(tmpdir(), "microtastic-dev-server-test");

test.beforeEach(async () => {
	await fs.mkdir(testDir, { recursive: true });
});

test.afterEach(async () => {
	try {
		await fs.rm(testDir, { recursive: true, force: true });
	} catch {
		// Ignore
	}
	// Give event loop a chance to clean up any pending operations
	await new Promise((resolve) => setImmediate(resolve));
});

test("DevServer should create server instance and return HTTP server", async () => {
	const server = new DevServer(testDir, MIME_TYPES);
	assert.strictEqual(server.root, testDir);
	assert.strictEqual(server.mimes, MIME_TYPES);

	const httpServer = server.createServer();
	assert.ok(httpServer instanceof http.Server);

	return new Promise((resolve) => {
		httpServer.close(() => resolve());
	});
});

test("DevServer should serve file with correct content type", async () => {
	const testFile = path.join(testDir, "test.html");
	await fs.writeFile(testFile, "<html>test</html>");

	const server = new DevServer(testDir, MIME_TYPES);
	const httpServer = server.createServer();

	return new Promise((resolve, reject) => {
		httpServer.listen(0, async () => {
			const port = httpServer.address().port;
			const consoleSpy = mock.method(console, "log", () => {});

			const req = http.get(`http://localhost:${port}/test.html`, (res) => {
				assert.strictEqual(res.statusCode, 200);
				assert.strictEqual(res.headers["content-type"], MIME_TYPES[".html"]);

				let data = "";
				res.on("data", (chunk) => {
					data += chunk;
				});
				res.on("end", () => {
					assert.strictEqual(data, "<html>test</html>");
					consoleSpy.mock.restore();
					httpServer.close(() => resolve());
				});
			});

			req.on("error", (err) => {
				consoleSpy.mock.restore();
				httpServer.close(() => reject(err));
			});
		});
	});
});

test("DevServer should serve index.html for directory requests", async () => {
	const subDir = path.join(testDir, "subdir");
	await fs.mkdir(subDir, { recursive: true });
	await fs.writeFile(path.join(subDir, "index.html"), "<html>index</html>");

	const server = new DevServer(testDir, MIME_TYPES);
	const httpServer = server.createServer();

	return new Promise((resolve, reject) => {
		httpServer.listen(0, async () => {
			const port = httpServer.address().port;
			const consoleSpy = mock.method(console, "log", () => {});

			const req = http.get(`http://localhost:${port}/subdir/`, (res) => {
				assert.strictEqual(res.statusCode, 200);
				assert.strictEqual(res.headers["content-type"], MIME_TYPES[".html"]);

				let data = "";
				res.on("data", (chunk) => {
					data += chunk;
				});
				res.on("end", () => {
					assert.strictEqual(data, "<html>index</html>");
					consoleSpy.mock.restore();
					httpServer.close(() => resolve());
				});
			});

			req.on("error", (err) => {
				consoleSpy.mock.restore();
				httpServer.close(() => reject(err));
			});
		});
	});
});

test("DevServer should return 404 for non-existent file", async () => {
	const server = new DevServer(testDir, MIME_TYPES);
	const httpServer = server.createServer();

	return new Promise((resolve, reject) => {
		httpServer.listen(0, async () => {
			const port = httpServer.address().port;
			const consoleSpy = mock.method(console, "log", () => {});

			const req = http.get(
				`http://localhost:${port}/nonexistent.html`,
				(res) => {
					assert.strictEqual(res.statusCode, 404);
					consoleSpy.mock.restore();
					httpServer.close(() => resolve());
				},
			);

			req.on("error", (err) => {
				consoleSpy.mock.restore();
				httpServer.close(() => reject(err));
			});
		});
	});
});

test("DevServer should use correct MIME types", async () => {
	const jsFile = path.join(testDir, "test.js");
	await fs.writeFile(jsFile, "console.log('test');");

	const server = new DevServer(testDir, MIME_TYPES);
	const httpServer = server.createServer();

	return new Promise((resolve, reject) => {
		httpServer.listen(0, async () => {
			const port = httpServer.address().port;
			const consoleSpy = mock.method(console, "log", () => {});

			http
				.get(`http://localhost:${port}/test.js`, (res) => {
					assert.strictEqual(res.statusCode, 200);
					assert.strictEqual(res.headers["content-type"], MIME_TYPES[".js"]);
					consoleSpy.mock.restore();
					httpServer.close(() => resolve());
				})
				.on("error", (err) => {
					consoleSpy.mock.restore();
					httpServer.close(() => reject(err));
				});
		});
	});
});

test("DevServer should handle server errors gracefully", async () => {
	// Create a server with invalid root to trigger error
	const invalidDir = path.join(testDir, "invalid");
	const server = new DevServer(invalidDir, MIME_TYPES);
	const httpServer = server.createServer();

	return new Promise((resolve, reject) => {
		httpServer.listen(0, async () => {
			const port = httpServer.address().port;
			const consoleSpy = mock.method(console, "log", () => {});

			// Request a file that will cause an error
			const req = http.get(`http://localhost:${port}/test.html`, (res) => {
				// Should handle error and return 500 or 404
				assert.ok([404, 500].includes(res.statusCode));
				consoleSpy.mock.restore();
				httpServer.close(() => resolve());
			});

			req.on("error", (err) => {
				consoleSpy.mock.restore();
				httpServer.close(() => reject(err));
			});
		});
	});
});

test("DevServer should inject reload script in HTML when hot reload enabled", async () => {
	const testFile = path.join(testDir, "test.html");
	await fs.writeFile(testFile, "<html><body>test</body></html>");

	const server = new DevServer(testDir, MIME_TYPES, true, testDir);
	const httpServer = server.createServer();

	return new Promise((resolve, reject) => {
		httpServer.listen(0, async () => {
			const port = httpServer.address().port;
			const consoleSpy = mock.method(console, "log", () => {});

			const req = http.get(`http://localhost:${port}/test.html`, (res) => {
				assert.strictEqual(res.statusCode, 200);

				let data = "";
				res.on("data", (chunk) => {
					data += chunk;
				});
				res.on("end", () => {
					assert.ok(data.includes("EventSource"));
					assert.ok(data.includes("/__reload"));
					assert.ok(data.includes("window.location.reload"));
					consoleSpy.mock.restore();
					server.close();
					httpServer.close(() => resolve());
				});
			});

			req.on("error", (err) => {
				consoleSpy.mock.restore();
				server.close();
				httpServer.close(() => reject(err));
			});
		});
	});
});

test("DevServer should not inject reload script when hot reload disabled", async () => {
	const testFile = path.join(testDir, "test.html");
	await fs.writeFile(testFile, "<html><body>test</body></html>");

	const server = new DevServer(testDir, MIME_TYPES, false);
	const httpServer = server.createServer();

	return new Promise((resolve, reject) => {
		httpServer.listen(0, async () => {
			const port = httpServer.address().port;
			const consoleSpy = mock.method(console, "log", () => {});

			const req = http.get(`http://localhost:${port}/test.html`, (res) => {
				assert.strictEqual(res.statusCode, 200);

				let data = "";
				res.on("data", (chunk) => {
					data += chunk;
				});
				res.on("end", () => {
					assert.ok(!data.includes("EventSource"));
					assert.ok(!data.includes("/__reload"));
					consoleSpy.mock.restore();
					httpServer.close(() => resolve());
				});
			});

			req.on("error", (err) => {
				consoleSpy.mock.restore();
				httpServer.close(() => reject(err));
			});
		});
	});
});

test("DevServer should return 404 for SSE endpoint when hot reload disabled", async () => {
	const server = new DevServer(testDir, MIME_TYPES, false);
	const httpServer = server.createServer();

	return new Promise((resolve, reject) => {
		httpServer.listen(0, async () => {
			const port = httpServer.address().port;
			const consoleSpy = mock.method(console, "log", () => {});

			const req = http.get(`http://localhost:${port}/__reload`, (res) => {
				assert.strictEqual(res.statusCode, 404);
				consoleSpy.mock.restore();
				httpServer.close(() => resolve());
			});

			req.on("error", (err) => {
				consoleSpy.mock.restore();
				httpServer.close(() => reject(err));
			});
		});
	});
});
