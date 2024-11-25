#!/usr/bin/env node
import { rollup } from 'rollup';
import terser from '@rollup/plugin-terser';
import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import nodePolyfills from 'rollup-plugin-polyfill-node';
import path from 'path';
import { promises as fs } from 'fs';
import http from 'http';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const hrstart = process.hrtime()

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Server and Build Constants
const DEFAULT_SERVER_PORT = 8181;
const DEFAULT_SETTINGS = {
    genServiceWorker: false,
    minifyBuild: true,
    serverPort: DEFAULT_SERVER_PORT
};

// File and Directory Names
const PUBLIC_BUNDLE_NAME = 'main.js';
const PUBLIC_BUNDLE_CHUNK_NAME = 'main-[hash].js';
const MICROTASTIC_CONFIG_FILE = '.microtastic';
const SERVICE_WORKER_TEMPLATE = 'sw.tpl';

// Directory Structure
const DIRS = {
    APP: 'app',
    PUBLIC: 'public',
    SRC: 'src',
    DEPENDENCIES: 'dependencies'
};

const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.ogg': 'audio/mpeg',
    '.mp4': 'video/mp4',
    '.woff': 'application/font-woff',
    '.ttf': 'application/font-ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'application/font-otf',
    '.wasm': 'application/wasm'
};

class MicrotasticError extends Error {
    constructor(message, code = 'UNKNOWN_ERROR') {
        super(message);
        this.code = code;
    }
}

class Logger {
    static colors = {
        error: '\x1b[31m',
        success: '\x1b[32m',
        reset: '\x1b[0m'
    };

    constructor(options = { silent: false, debug: false }) {
        this.silent = options.silent;
        this.debug = options.debug;
    }

    error(msg) {
        if (!this.silent) {
            console.error(`${Logger.colors.error}ERROR: ${msg}${Logger.colors.reset}`);
        }
    }

    success(msg) {
        if (!this.silent) {
            console.log(`${Logger.colors.success}${msg}${Logger.colors.reset}`);
        }
    }

    debug(msg) {
        if (this.debug) {
            console.log(`DEBUG: ${msg}`);
        }
    }
}

class FileManager {
    static async copyRecursive(src, dest, exclude = []) {
        try {
            const stats = await fs.stat(src);
            const isDirectory = stats.isDirectory();
            
            if (isDirectory) {
                await fs.mkdir(dest, { recursive: true });
                const children = await fs.readdir(src);
                await Promise.all(
                    children
                        .filter(child => !exclude.includes(child))
                        .map(child => 
                            FileManager.copyRecursive(
                                path.join(src, child), 
                                path.join(dest, child), 
                                exclude
                            )
                        )
                );
            } else {
                await fs.link(src, dest);
            }
        } catch (error) {
            console.error(`Error copying ${src} to ${dest}:`, error);
        }
    }

    static async deleteRecursive(dir) {
        try {
            await fs.rm(dir, { 
                recursive: true,
                force: true  // This will prevent errors if directory doesn't exist
            });
        } catch (error) {
            console.error(`Error deleting directory ${dir}:`, error);
        }
    }

    static async listRecursive(dir, fileList = []) {
        const files = await fs.readdir(dir);
        
        await Promise.all(
            files.map(async (file) => {
                const filePath = path.join(dir, file);
                const stats = await fs.stat(filePath);
                
                if (stats.isDirectory()) {
                    await FileManager.listRecursive(filePath, fileList);
                } else {
                    fileList.push(filePath);
                }
            })
        );
        
        return fileList;
    }

    static async renderTemplate(template, data, output) {
        try {
            const content = await fs.readFile(template, 'utf8');
            const newContent = content.replace(
                /{{(.*?)}}/g,
                (_, key) => data[key.trim()]
            );
            
            await fs.mkdir(path.dirname(output), { recursive: true });
            await fs.writeFile(output, newContent);
        } catch (error) {
            console.error(`Error rendering template ${template}:`, error);
            throw error;
        }
    }

    static async checkExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }
}

class DevServer {
    constructor(appRootDir, mimeTypes) {
        this.appRootDir = appRootDir;
        this.mimeTypes = mimeTypes;
    }

    createServer() {
        return http.createServer(async (req, res) => {
            const printStatus = (color) => {
                console.log(`${color}%s\x1b[0m`, `${req.method} ${res.statusCode} ${req.url}`);
            };

            try {
                const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
                let pathName = path.join(this.appRootDir, parsedUrl.pathname);
                let ext = path.parse(pathName).ext;

                const stats = await fs.stat(pathName).catch(() => null);
                if (!stats) {
                    res.statusCode = 404;
                    res.end(`File ${pathName} not found`);
                    return printStatus('\x1b[31m');
                }

                if (stats.isDirectory()) {
                    pathName = path.join(pathName, 'index.html');
                    ext = '.html';
                }

                const data = await fs.readFile(pathName);
                res.statusCode = 200;
                res.setHeader('Content-type', this.mimeTypes[ext] || 'text/plain');
                res.end(data);
                printStatus('\x1b[32m');
            } catch (error) {
                res.statusCode = 500;
                res.end(`Server error: ${error.message}`);
                printStatus('\x1b[31m');
            }
        });
    }
}

class CommandHandler {
    constructor(options) {
        this.logger = new Logger(options.logging);
        this.settings = options.settings;
        this.paths = options.paths;
    }

    async version() {
        const microtasticPkg = JSON.parse(
            await fs.readFile(
                path.join(this.paths.microtasticDir, '/package.json'),
                'utf8'
            )
        );
        this.logger.success(`Version: ${microtasticPkg.version}`);
    }

    async init() {
        if (await FileManager.checkExists(path.join(this.paths.projectDir, `/${DIRS.APP}/`))) {
            throw new MicrotasticError('Project already initialized', 'ALREADY_INITIALIZED');
        }

        await FileManager.copyRecursive(
            path.join(this.paths.microtasticDir, '/template/'),
            this.paths.projectDir,
            []
        );

        appPkg.scripts.prepare = 'microtastic prep';
        appPkg.scripts.dev = 'microtastic dev';
        appPkg.scripts.build = 'microtastic prod';
        await fs.writeFile(
            this.paths.projectPkgPath, 
            JSON.stringify(appPkg, undefined, 2), 
            'utf8'
        );

        if (await FileManager.checkExists(this.paths.projectGitIgnorePath)) {
            await fs.appendFile(
                this.paths.projectGitIgnorePath, 
                '\n# microtastic specific\npublic\napp/src/dependencies'
            );
        }
    }

    async prep() {
        await FileManager.deleteRecursive(this.paths.appDependenciesDir);
        await fs.mkdir(this.paths.appDependenciesDir, { recursive: true });
        for (const e of Object.keys(appPkg.dependencies)) {
            try {
                const b = await rollup({
                    input: `${this.paths.projectNodeModulesDir}${e}`,
                    plugins: [nodeResolve({ preferBuiltins: true }), commonjs(), nodePolyfills()]
                });
                await b.write({
                    format: 'es',
                    entryFileNames: `${e}.js`,
                    dir: this.paths.appDependenciesDir
                });
            } catch (error) {
                console.error(`Error bundling ${e}:`, error);
            }
        }
    }

    async prod() {
        try {
            // Load package.json first
            await this.loadAppPackage();
            if (!this.appPkg) {
                throw new MicrotasticError('Failed to load package.json', 'PACKAGE_JSON_ERROR');
            }

            this.logger.debug('Starting production build...');

            // Clean and prepare directories
            await FileManager.deleteRecursive(this.paths.publicDir);
            await FileManager.copyRecursive(
                this.paths.appRootDir, 
                this.paths.publicDir, 
                [path.basename(this.paths.appSrcDir)]
            );

            // Bundle the application
            this.logger.debug('Bundling application...');
            const bundle = await rollup({
                input: this.paths.appSrcEntryPath,
                plugins: [
                    this.settings.minifyBuild ? terser() : null
                ].filter(Boolean),
                preserveEntrySignatures: false
            });

            await bundle.write({
                format: 'es',
                entryFileNames: PUBLIC_BUNDLE_NAME,
                chunkFileNames: PUBLIC_BUNDLE_CHUNK_NAME,
                dir: this.paths.publicSrcDir
            });

            await bundle.close();

            // Generate service worker if enabled
            if (this.settings.genServiceWorker) {
                this.logger.debug('Generating service worker...');
                const files = [];
                await FileManager.listRecursive(this.paths.publicDir, files);
                const rp = path.normalize(this.paths.publicDir);
                let cacheArray = "[\n    '.',\n";
                for (const s of files) {
                    cacheArray += `    '${s.replace(rp, '').replace(/\\/g, '/')}',\n`;
                }
                cacheArray += ']';
                
                const data = {
                    cacheName: `${this.appPkg.name}-${this.appPkg.version}-${new Date().getTime()}`,
                    cacheArray
                };

                await FileManager.renderTemplate(
                    path.join(this.paths.microtasticDir, SERVICE_WORKER_TEMPLATE),
                    data,
                    path.join(this.paths.publicDir, 'sw.js')
                );
            }

            const hrend = process.hrtime(this.hrstart);
            this.logger.success(`Build completed in ${hrend[0]}s ${Math.round(hrend[1] / 1000000)}ms`);
        } catch (error) {
            this.logger.error(`Build failed: ${error.message}`);
            if (this.settings.debug) {
                console.error(error.stack);
            }
            throw error;
        }
    }

    dev() {
        const server = new DevServer(this.paths.appRootDir, MIME_TYPES);
        server.createServer().listen(this.settings.serverPort);
        this.logger.success(`Started dev server on localhost:${this.settings.serverPort}`);
    }
}

class Microtastic {
    constructor() {
        this.logger = new Logger({
            silent: process.env.SILENT === 'true',
            debug: process.env.DEBUG === 'true'
        });
    }

    async initialize() {
        // First define base paths
        const projectDir = process.cwd();
        const microtasticDir = __dirname;

        // Then build the complete paths object
        const paths = {
            projectDir,
            microtasticDir,
            projectNodeModulesDir: path.join(projectDir, '/node_modules/'),
            projectPkgPath: path.join(projectDir, '/package.json'),
            projectGitIgnorePath: path.join(projectDir, '/.gitignore'),
            microtasticSettingsPath: path.join(projectDir, `/${MICROTASTIC_CONFIG_FILE}`),
            appRootDir: path.join(projectDir, `/${DIRS.APP}/`),
        };

        // Add derived paths that depend on the base paths
        paths.appSrcDir = path.join(paths.appRootDir, `/${DIRS.SRC}/`);
        paths.appSrcEntryPath = path.join(paths.appSrcDir, 'main.js');
        paths.appDependenciesDir = path.join(paths.appSrcDir, `${DIRS.DEPENDENCIES}/`);
        paths.publicDir = path.join(projectDir, `/${DIRS.PUBLIC}/`);
        paths.publicSrcDir = path.join(paths.publicDir, `/${DIRS.SRC}/`);

        const settings = await this.loadSettings(paths.microtasticSettingsPath);
        
        return new CommandHandler({
            logging: { 
                silent: false, 
                debug: process.env.DEBUG === 'true' 
            },
            settings,
            paths
        });
    }

    async loadSettings(settingsPath) {
        try {
            await fs.access(settingsPath);
            const loadedSettings = JSON.parse(
                await fs.readFile(settingsPath, 'utf8')
            );
            return { ...DEFAULT_SETTINGS, ...loadedSettings };
        } catch (error) {
            // If file doesn't exist, return default settings
            return DEFAULT_SETTINGS;
        }
    }

    async run() {
        try {
            const command = process.argv[2]?.toLowerCase();
            if (!command) {
                throw new MicrotasticError('No command specified', 'NO_COMMAND');
            }

            const handler = await this.initialize();
            
            if (!(command in handler)) {
                throw new MicrotasticError('Invalid command', 'INVALID_COMMAND');
            }

            await handler[command]();

        } catch (error) {
            this.logger.error(error.message);
            if (error instanceof MicrotasticError) {
                process.exit(1);
            }
            if (process.env.DEBUG) {
                console.error(error.stack);
            }
            process.exit(1);
        }
    }
}

// Entry point
const cli = new Microtastic();
cli.run();
