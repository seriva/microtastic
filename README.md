## About

Microtastic is a tiny (~500 line) CLI tool to aid developing browser based applications in pure ES6 without the overtooling and dependency hell some tool chains introduce. Inspired by [Snowpack](https://www.snowpack.dev/) Microtastic is much lighter and simpler but more opinionated in project structure and how to use it.

Like [Snowpack](https://www.snowpack.dev/) it used [Rollup](https://rollupjs.org/) to convert CommonJS and multi-file ES6 modules to single-file ES6 modules. These can then be imported and used during development without the need for rebundling the application on every single change.

Then when it is time to make the application production ready, [Rollup](https://rollupjs.org/) is used for bundling taking advantage of the tree-shaking and dynamic imports it provides to slim down and carve up the code in smaller chunks.

Since Microtastic only deals with ES6 code it works great with other JS only libraries like:

- [Mithril.js](https://mithril.js.org/)
- [JSS](https://cssinjs.org/?v=v10.1.1)
- [MaquetteJS](https://maquettejs.org/)

## Features

- **Lightweight**: Only ~500 lines of code
- **ES6 Native**: Pure ES6 development without complex toolchains
- **Asset Management**: Automatic copying of fonts, CSS, and other assets from node_modules
- **Simple Dev Server**: Lightweight development server for serving static files
- **Production Ready**: Optimized builds with tree-shaking
- **Opinionated**: Simple project structure and workflow

## Tech Stack

- **Language**: JavaScript (ES6)
- **Bundler**: Rollup
- **Development**: Simple static file server
- **Build System**: Custom CLI tool
- **Target**: Browser-based applications
- **Dependencies**: Minimal external dependencies

## Quick Start

### Bootstrap a New Application

1. Generate a new npm package/project:
```bash
npm init
```

2. Install Microtastic as a dev dependency:
```bash
npm install microtastic --save-dev
```

3. Run `microtastic init` to bootstrap the application template:
```bash
npx microtastic init
```

In the `app/src/` folder new code can be added with `main.js` as main entry point. Any other resources you need can be added as you fit in the `app/` directory.

### Development

Microtastic has a built-in development server which can be started with:

```bash
npm run dev
```

Since pure ES6 is used you can open and debug the applications in the latest versions of Chrome and Firefox or any other browser that supports the ES6 module standard.

### Production Build

You can prepare the bundled application by running:

```bash
npm run prod
```

This will bundle and optimize your code and put the application ready to publish in the `public/` folder.

## Configuration

### Microtastic Settings

You can create a `.microtastic` file in the root of your project and add and change the following configurations:

```json
{
    "genServiceWorker": false, // Experimental feature that generates an offline-mode service worker. Mainly written for my privatete projects and will need additional code from the application side to work.
    "minifyBuild": true, // If Rollup need to minimize the application
    "serverPort": 8181, // Port the debug server is running on.
    "hotReload": true // Enable hot reload in development server. Automatically reloads the page when files in the app directory change.
}
```

### Asset Copying

Microtastic can automatically copy assets (fonts, CSS files, images, etc.) from `node_modules` to your app directory during the `prep` phase. Add an `assetCopy` array to your `package.json`:

```json
{
  "assetCopy": [
    {
      "source": "node_modules/@fontsource/raleway/files/raleway-latin-400-normal.woff2",
      "dest": "app/fonts/raleway-latin-400-normal.woff2"
    },
    {
      "source": "node_modules/prismjs/themes/prism.min.css",
      "dest": "app/css/prism-themes/prism.min.css"
    }
  ]
}
```

Each asset entry requires:
- **source**: Path to the file in `node_modules` (relative to project root)
- **dest**: Destination path in your app (relative to project root)

Assets are copied when running `npm run prepare` or `microtastic prep`. Destination directories are created automatically if they don't exist.
