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

const copyRecursiveSync = async (src, dest, exclude = []) => {
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
                        copyRecursiveSync(
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
};

const deleteRecursiveSync = async (dir) => {
    try {
        await fs.rm(dir, { 
            recursive: true,
            force: true  // This will prevent errors if directory doesn't exist
        });
    } catch (error) {
        console.error(`Error deleting directory ${dir}:`, error);
    }
};

const listRecursiveSync = async (dir, fileList = []) => {
    const files = await fs.readdir(dir);
    
    await Promise.all(
        files.map(async (file) => {
            const filePath = path.join(dir, file);
            const stats = await fs.stat(filePath);
            
            if (stats.isDirectory()) {
                await listRecursiveSync(filePath, fileList);
            } else {
                fileList.push(filePath);
            }
        })
    );
    
    return fileList;
};

const renderTemplate = async (template, data, output) => {
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
};

const createDevServer = (appRootDir, mimeTypes) => {
    return http.createServer(async (req, res) => {
        const printStatus = (color) => {
            console.log(`${color}%s\x1b[0m`, `${req.method} ${res.statusCode} ${req.url}`);
        };

        try {
            const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
            let pathName = path.join(appRootDir, parsedUrl.pathname);
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
            res.setHeader('Content-type', mimeTypes[ext] || 'text/plain');
            res.end(data);
            printStatus('\x1b[32m');
        } catch (error) {
            res.statusCode = 500;
            res.end(`Server error: ${error.message}`);
            printStatus('\x1b[31m');
        }
    });
};

const loadSettings = async (settingsPath, defaultSettings) => {
    try {
        await fs.access(settingsPath);
        const loadedSettings = JSON.parse(
            await fs.readFile(settingsPath, 'utf8')
        );
        return { ...defaultSettings, ...loadedSettings };
    } catch (error) {
        // If file doesn't exist, return default settings
        return defaultSettings;
    }
};

const checkFileExists = async (filePath) => {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
};

try {
    if (!process.argv[2]) {
        throw new Error('Invalid command.');
    }

    const microtasticDir = __dirname;
    const projectDir = process.cwd()
    const projectNodeModulesDir = path.join(projectDir, '/node_modules/');
    const projectPkgPath = path.join(projectDir, '/package.json');
    const projectGitIgnorePath = path.join(projectDir, '/.gitignore');
    const microtasticSettingsPath = path.join(projectDir, '/.microtastic');
    const appRootDir = path.join(projectDir, '/app/');
    const appSrcDir = path.join(appRootDir, '/src/');
    const appSrcEntryPath = path.join(appSrcDir, 'main.js');
    const appDependenciesDir = path.join(appSrcDir, 'dependencies/');
    const publicDir = path.join(projectDir, '/public/');
    const publicSrcDir = path.join(publicDir, '/src/');
    const publicBundleName = 'main.js';
    const publicBundleChunkName = 'main-[hash].js';

    let microtasticSettings = {
        genServiceWorker: false,
        minifyBuild: true,
        serverPort: 8181
    }
    microtasticSettings = await loadSettings(microtasticSettingsPath, microtasticSettings);

    if (!(await checkFileExists(projectPkgPath))) {
        throw new Error('No package.json in the app folder');
    }
    const appPkg = JSON.parse(await fs.readFile(projectPkgPath, 'utf8'));

    const cmd = process.argv[2].toLowerCase();
    switch (cmd) {
    case 'version':
        const microtasticPkg = JSON.parse(
            await fs.readFile(
                path.join(microtasticDir, '/package.json'), 
                'utf8'
            )
        );
        console.log(`Version: ${microtasticPkg.version}`);
        break;
    case 'init':
        if (await checkFileExists(path.join(projectDir, '/app/'))) {
            throw new Error('Project already initialized');
        }

        copyRecursiveSync(
            path.join(microtasticDir, '/template/'),
            path.join(projectDir, '/'),
            []
        );

        appPkg.scripts.prepare = 'microtastic prep';
        appPkg.scripts.dev = 'microtastic dev';
        appPkg.scripts.build = 'microtastic prod';
        await fs.writeFile(
            projectPkgPath, 
            JSON.stringify(appPkg, undefined, 2), 
            'utf8'
        );

        if (await checkFileExists(projectGitIgnorePath)) {
            await fs.appendFile(
                projectGitIgnorePath, 
                '\n# microtastic specific\npublic\napp/src/dependencies'
            );
        }
        break;
    case 'prep':
        await deleteRecursiveSync(appDependenciesDir);
        await fs.mkdir(appDependenciesDir, { recursive: true });
        for (const e of Object.keys(appPkg.dependencies)) {
            try {
                const b = await rollup({
                    input: `${projectNodeModulesDir}${e}`,
                    plugins: [nodeResolve({ preferBuiltins: true }), commonjs(), nodePolyfills()]
                });
                await b.write({
                    format: 'es',
                    entryFileNames: `${e}.js`,
                    dir: appDependenciesDir
                });
            } catch (error) {
                console.error(`Error bundling ${e}:`, error);
            }
        }
        break;
    case 'prod':
        await deleteRecursiveSync(publicDir);
        await copyRecursiveSync(appRootDir, publicDir, [path.basename(appSrcDir)]);

        const bundle = async () => {
            const b = await rollup({
                input: appSrcEntryPath,
                plugins: [
                    microtasticSettings.minifyBuild ? terser() : null
                ].filter(Boolean),
                preserveEntrySignatures: false
            });
            await b.write({
                format: 'es',
                entryFileNames: publicBundleName,
                chunkFileNames: publicBundleChunkName,
                dir: publicSrcDir
            });
        };
        bundle().then(() => {
            if (microtasticSettings.genServiceWorker) {
                const files = [];
                listRecursiveSync(publicDir, files);
                const rp = path.normalize(publicDir);
                let cacheArray = "[\n    '.',\n";
                files.forEach((s) => {
                    cacheArray += `    '${s.replace(rp, '').replace(/\\/g, '/')}',\n`;
                });
                cacheArray += ']';
                const data = {
                    cacheName: `${appPkg.name}-${appPkg.version}-${new Date().getTime()}`,
                    cacheArray
                };
                renderTemplate(
                    path.join(__dirname, 'sw.tpl'),
                    data,
                    `${publicDir}/sw.js`
                );
                const hrend = process.hrtime(hrstart)
                console.info('Build time: %d.%ds', hrend[0], Math.round(hrend[1] / 1000000))
            }
        });
        break;
    case 'dev':
        createDevServer(appRootDir, {
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
        }).listen(microtasticSettings.serverPort);
        console.log(`Started dev server on localhost:${microtasticSettings.serverPort}`);
        break;
    default:
        throw new Error('Invalid command');
    }
} catch (e) {
    console.error(`\x1b[31mERROR: ${e.message}\x1b[0m`);
}
