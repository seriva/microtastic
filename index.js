#!/usr/bin/env node
const rollup = require('rollup');
const terser = require('rollup-plugin-terser');
const eslint = require('rollup-plugin-eslint');
const commonjs = require('@rollup/plugin-commonjs');
const nodeResolve = require('@rollup/plugin-node-resolve');
const nodePolyfills = require('rollup-plugin-node-polyfills');
const path = require('path');
const fs = require('fs');
const http = require('http');
const url = require('url');

const hrstart = process.hrtime()

const copyRecursiveSync = (src, dest, exclude) => {
    if (!exclude) exclude = [];
    const exists = fs.existsSync(src);
    const stats = exists && fs.statSync(src);
    const isDirectory = exists && stats.isDirectory();
    if (exists && isDirectory) {
        fs.mkdirSync(dest, { recursive: true });
        fs.readdirSync(src).forEach((childItemName) => {
            if (exclude.indexOf(childItemName) > -1) return;
            copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName), exclude);
        });
    } else {
        fs.linkSync(src, dest);
    }
};

const deleteRecursiveSync = (dir) => {
    if (fs.existsSync(dir)) {
        fs.readdirSync(dir).forEach((file) => {
            const curDir = `${dir}/${file}`;
            if (fs.lstatSync(curDir).isDirectory()) {
                deleteRecursiveSync(curDir);
            } else {
                fs.unlinkSync(curDir);
            }
        });
        fs.rmdirSync(dir);
    }
};

const listRecursiveSync = (dir, filelist) => {
    const files = fs.readdirSync(dir);
    filelist = filelist || [];
    files.forEach((file) => {
        if (fs.statSync(path.join(dir, file)).isDirectory()) {
            filelist = listRecursiveSync(path.join(dir, file), filelist);
        } else {
            filelist.push(path.join(dir, file));
        }
    });
    return filelist;
};

const renderTemplate = (template, data, output) => {
    const content = fs.readFileSync(template, { encoding: 'utf8' });
    const newContent = content.replace(/{{.*?}}/g,
        (match) => data[`${match.slice(2, -2)}`]);
    const p = path.dirname(output);
    if (!fs.existsSync(p)) {
        fs.mkdirSync(p);
    }
    fs.writeFileSync(output, newContent);
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
        eslintOnBuild: false,
        minifyBuild: true,
        serverPort: 8181
    } 
    if (fs.existsSync(microtasticSettingsPath)) {
        const loadedMicrotasticSettings = JSON.parse(fs.readFileSync(microtasticSettingsPath, 'utf8'));  
        microtasticSettings = { ...microtasticSettings, ...loadedMicrotasticSettings };
    }
    
    if (!fs.existsSync(projectPkgPath)) {
        throw new Error('No package.json in the app folder');
    }
    const appPkg = JSON.parse(fs.readFileSync(projectPkgPath, 'utf8'));  

    const cmd = process.argv[2].toLowerCase();
    switch (cmd) {
    case 'version':
        const microtasticPkg = JSON.parse(fs.readFileSync(path.join(microtasticDir, '/package.json'), 'utf8'));
        console.log(`Version: ${microtasticPkg.version}`);
        break;         
    case 'init':
        if (fs.existsSync(path.join(projectDir, '/app/'))) {
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
        fs.writeFileSync(projectPkgPath, JSON.stringify(appPkg, undefined, 2), 'utf8');

        if (fs.existsSync(projectGitIgnorePath)) {
            fs.appendFileSync(projectGitIgnorePath, '\n# microtastic specific\npublic\napp/src/dependencies');
        }
        break;        
    case 'prep':
        deleteRecursiveSync(appDependenciesDir);
        fs.mkdirSync(appDependenciesDir);
        let i = 0;
        Object.keys(appPkg.dependencies).forEach((e) => {
            const bundle = async () => {
                const b = await rollup.rollup({
                    input: `${projectNodeModulesDir}${e}`,
                    plugins: [nodeResolve.nodeResolve(), commonjs(), nodePolyfills()]
                });
                await b.write({
                    format: 'es',
                    entryFileNames: `${e}.js`,
                    dir: appDependenciesDir
                });
            };
            bundle();
        });
        break;
    case 'prod':
        deleteRecursiveSync(publicDir);
        copyRecursiveSync(appRootDir, publicDir, [path.basename(appSrcDir)]);

        const bundle = async () => {
            const b = await rollup.rollup({
                input: appSrcEntryPath,
                plugins: [
                    microtasticSettings.eslintOnBuild ? eslint.eslint() : null,
                    microtasticSettings.minifyBuild ?terser.terser() : null
                ],
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
        http.createServer((req, res) => {
            const printStatus = (color) => {
                console.log(`${color}%s\x1b[0m`, `${req.method} ${res.statusCode} ${req.url}\x1b[0m`);
            };

            const parsedUrl = url.parse(req.url);
            let pathName = `${appRootDir}/${parsedUrl.pathname}`;
            let { ext } = path.parse(pathName);

            const map = {
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

            fs.exists(pathName, (exist) => {
                if (!exist) {
                    res.statusCode = 404;
                    res.end(`File ${pathName} not found`);
                    printStatus('\x1b[31m');
                } else {
                    if (fs.statSync(pathName).isDirectory()) {
                        pathName += '/index.html';
                        ext = '.html';
                    }

                    fs.readFile(pathName, (err, data) => {
                        if (err) {
                            res.statusCode = 500;
                            res.end(`Error getting the file: ${err}`);
                            printStatus('\x1b[31m');
                        } else {
                            res.statusCode = 200;
                            res.setHeader('Content-type', map[ext] || 'text/plain');
                            res.end(data);
                            printStatus('\x1b[32m');
                        }
                    });
                }
            });
        }).listen(microtasticSettings.serverPort);
        console.log(`Started dev server on localhost:${microtasticSettings.serverPort}`);
        break;
    default:
        throw new Error('Invalid command');
    }
} catch (e) {
    console.error(`\x1b[31mERROR: ${e.message}\x1b[0m`);
}