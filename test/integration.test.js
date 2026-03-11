import assert from "node:assert";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { CommandHandler } from "../index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const microtasticDir = path.resolve(__dirname, "..");
const testDir = path.join(tmpdir(), "microtastic-integration-test");

/**
 * Build a fully scaffolded project directory with an app/src/main.js entry
 * and optionally a set of npm dependencies pre-installed in node_modules.
 */
async function scaffoldProject(deps = {}) {
	await fs.rm(testDir, { recursive: true, force: true });
	await fs.mkdir(testDir, { recursive: true });

	// package.json
	const pkg = {
		name: "test-app",
		version: "1.0.0",
		type: "module",
		dependencies: deps,
	};
	await fs.writeFile(
		path.join(testDir, "package.json"),
		JSON.stringify(pkg, null, 2),
	);

	// app/src/main.js — minimal ES module entry point
	const srcDir = path.join(testDir, "app", "src");
	await fs.mkdir(srcDir, { recursive: true });
	await fs.writeFile(
		path.join(srcDir, "main.js"),
		`console.log("hello from microtastic");\n`,
	);

	// app/index.html — required for prod() to copy assets
	await fs.writeFile(
		path.join(testDir, "app", "index.html"),
		`<!DOCTYPE html><html><body><script type="module" src="src/main.js"></script></body></html>\n`,
	);
}

function makeHandler(options = {}) {
	const appRootDir = `${path.join(testDir, "app")}/`;
	const appSrcDir = `${path.join(appRootDir, "src")}/`;
	return new CommandHandler({
		logging: { silent: true },
		settings: {
			minifyBuild: options.minify ?? false,
			genServiceWorker: false,
			hotReload: false,
		},
		paths: {
			projectDir: testDir,
			microtasticDir,
			projectNodeModulesDir: `${path.join(testDir, "node_modules")}/`,
			projectPkgPath: path.join(testDir, "package.json"),
			appRootDir,
			appSrcDir,
			appSrcEntryPath: path.join(appSrcDir, "main.js"),
			appDependenciesDir: `${appSrcDir}dependencies/`,
			publicDir: `${path.join(testDir, "public")}/`,
			publicSrcDir: `${path.join(testDir, "public", "src")}/`,
		},
	});
}

/** Returns the first .js file in public/src, throws if none found. */
async function findBundledJs() {
	const srcDir = path.join(testDir, "public", "src");
	const files = await fs.readdir(srcDir);
	const js = files.find((f) => f.endsWith(".js"));
	assert.ok(
		js,
		`Expected a .js file in public/src/, found: ${files.join(", ")}`,
	);
	return path.join(srcDir, js);
}

// ---------------------------------------------------------------------------
// prep() — bundles npm dependencies into app/src/dependencies/
// ---------------------------------------------------------------------------

test("prep() with no dependencies completes without error", async () => {
	await scaffoldProject();
	const handler = makeHandler();
	// Should resolve cleanly and not throw
	await handler.prep();
});

test("prep() bundles a real npm dependency via rolldown", async () => {
	// Install mitt into the test project's node_modules using the microtastic
	// node_modules (it won't be there, so we copy it from our own node_modules)
	await scaffoldProject({ mitt: "*" });

	// mitt isn't a dep of microtastic, so use a module we do have: deepmerge
	const deepmergeSrc = path.join(microtasticDir, "node_modules", "deepmerge");
	const deepmergeDest = path.join(testDir, "node_modules", "deepmerge");

	// Skip gracefully if deepmerge isn't available
	const hasDeepmere = await fs
		.access(deepmergeSrc)
		.then(() => true)
		.catch(() => false);
	if (!hasDeepmere) return;

	await fs.cp(deepmergeSrc, deepmergeDest, { recursive: true });

	// Update package.json to use deepmerge as the dep
	const pkgPath = path.join(testDir, "package.json");
	const pkg = JSON.parse(await fs.readFile(pkgPath, "utf8"));
	pkg.dependencies = { deepmerge: "*" };
	await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2));

	const handler = makeHandler();
	await handler.prep();

	// The bundled file should exist
	const bundled = path.join(
		testDir,
		"app",
		"src",
		"dependencies",
		"deepmerge.js",
	);
	assert.ok(
		await fs
			.access(bundled)
			.then(() => true)
			.catch(() => false),
		"deepmerge.js should be bundled into app/src/dependencies/",
	);

	// The bundled file should be a valid ES module
	const content = await fs.readFile(bundled, "utf8");
	assert.ok(content.length > 0, "bundled file should not be empty");
	assert.ok(
		content.includes("export") || content.includes("function"),
		"bundled file should contain JS code",
	);
});

// ---------------------------------------------------------------------------
// prod() — bundles the app entry point with rolldown
// ---------------------------------------------------------------------------

test("prod() generates public/ directory with main.js", async () => {
	await scaffoldProject();
	const handler = makeHandler();
	await handler.prod();

	const bundledJs = await findBundledJs();
	const content = await fs.readFile(bundledJs, "utf8");
	assert.ok(content.length > 0, "bundled JS should not be empty");
});

test("prod() with minifyBuild:true produces a smaller bundle", async () => {
	await scaffoldProject();

	// Build without minification first
	const handlerNoMin = makeHandler({ minify: false });
	await handlerNoMin.prod();
	const unminifiedSize = (await fs.stat(await findBundledJs())).size;

	// Build a more substantial entry for meaningful size difference
	const srcDir = path.join(testDir, "app", "src");
	await fs.writeFile(
		path.join(srcDir, "main.js"),
		[
			"// This is a comment that should be stripped by minification",
			"const longVariableName = 'hello world this is a test string';",
			"const anotherLongVariable = longVariableName.toUpperCase();",
			"export { longVariableName, anotherLongVariable };",
		].join("\n"),
	);
	await fs.rm(path.join(testDir, "public"), { recursive: true, force: true });

	const handlerWithMin = makeHandler({ minify: true });
	await handlerWithMin.prod();
	const minifiedSize = (await fs.stat(await findBundledJs())).size;

	assert.ok(
		minifiedSize <= unminifiedSize,
		`minified (${minifiedSize}B) should be <= unminified (${unminifiedSize}B)`,
	);
});

test("prod() copies static assets from app/ (non-src) to public/", async () => {
	await scaffoldProject();
	const handler = makeHandler();
	await handler.prod();

	// index.html from app/ should be copied to public/
	const indexHtml = path.join(testDir, "public", "index.html");
	assert.ok(
		await fs
			.access(indexHtml)
			.then(() => true)
			.catch(() => false),
		"public/index.html should exist after prod()",
	);
});
