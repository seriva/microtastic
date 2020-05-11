# ```Microtastic```

## What is it?

```Microtastic``` is a tiny (250 line) CLI tool to aid developing browser based applications in pure ES6 without the overtooling and dependency hell some tool chains introduce. Inspired by [Snowpack](https://www.snowpack.dev/) ```Microtastic``` is much lighter and simpler but more opinionated in project structure and how to use it.

Like [Snowpack](https://www.snowpack.dev/) it used [Rollup](https://rollupjs.org/) to convert CommonJS and multi-file ES6 modules to single-file ES6 modules. These can then be imported and used during development without the need for rebundling the application on every single change.

Then when it is time to make the application production ready, [Rollup](https://rollupjs.org/) is used for bundling taking advantage of the threeshaking and dynamic imports it provides to slim down and carve up the code in smaller chunks.

Since ```Microtastic``` only deals with ES6 code it works great with other JS only libraries like:

- [Mithril.js](https://mithril.js.org/)
- [JSS](https://cssinjs.org/?v=v10.1.1)
- [MaquetteJS](https://maquettejs.org/)

## How to bootstrap a new application

1: Generate a new npm package/project:

```bash
npm init
```

2: Install ```Microtastic``` as a dev dependency:

```bash
npm install microtastic  --save-dev
```

3: Run ```microtastic init``` to bootstrap the application template:

```bash
npx microtastic init
```

In the ```app/src/``` folder new code can be added with ```main.js``` as main entry point. Any other resources you need can be added as you fit in the ```app/``` directory.

## How to add new dependencies

1: Install the dependency like normal:

```bash
npm install <packagename>
```

2: Run ```prepare``` to rebuild the dependencies with:

```bash
npm run prepare
```

This will regenerate all dependencies and put them in the ```app/src/dependencies/``` folder ready for use.

## How to develop

```Microtastic``` has a build in development server which can be started with:

```bash
npm run dev
```

Since pure ES6 is used you can open and debug the applications in the latest versions of Chrome and Firefox or any other browser that supports the ES6 module standard.

## How to build the production version of your app

You can prepare the bundled application by running:

```bash
npm run build
```

This will bundle and optimise your code and put the application ready to publish in the ```public/``` folder.

## Advanced configuration

You can create a  ```.microtastic``` file in the root of your project and add and change the following configurations:

```json
{
    "genServiceWorker": false, // Experimental feature that generates an offline-mode service worker. Mainly written for my Cubetatic project and will need additional code from the application side to work.
    "eslintOnBuild": true, // If Rollup need to run ESLint before bundling the code
    "minifyBuild": true, // If Rollup need to minimize the application
    "serverPort": 8181 // Port the debug server is running on.
}
```
