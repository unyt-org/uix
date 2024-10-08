# Rendering and Transpilation

When UIX is used as a full-stack framework, HTML pages are automatically rendered for all routes. 
The HTML includes script and style dependencies, import maps and metadata.

Typescript and SCSS files are automatically served as transpiled JavaScript/CSS files.

This chapter provides some background on rendering and transpiling that is not necessary required for using UIX.

## Module Preloading

UIX recursively resolves the dependencies in the module tree and adds them as "modulepreload" links (`<link rel="modulepreload" href="...">`) to rendered HTML pages.
This can significantly reduce load times, especially on first loads when modules are not available in the browser cache.

Static (`import x from "y"`) and dynamic imports (`await import("y")`), as well as `datex.get` imports are resolved.

The following URLs are excluded from module preloading by default:
 * URLs explicitly imported as type modules (`import type { x } from "modules.ts"`)
 * NPM modules (identifiers starting with `npm:`, eg. `import x from "npm:..."`)
 * JSR modules (identifiers starting with `jsr:`, eg. `import x from "jsr:..."`)
 * Deno.land modules (starting with `https://deno.land/`)

In dynamic import statements, preloading can be disabled by adding a `/*lazy*/` comment after the module specifier:
```ts
const preloadedModule = await import("./module-a.ts");
const notPreloadedModule = await import("./module-b.ts" /*lazy*/);
```

Module preloading can be completely disabled by setting `preload_dependencies: false` in the `app.dx` configuration file.

## Transpilation and Minification

UIX transpiles and minifies all of the apps TypeScript modules individually using [SWC](https://swc.rs/docs/configuration/minification).
Modules are not bundled.

You can disable the minification by setting `minify_js: false` in the [`app.dx`](./09%20Configuration.md#the-appdx-file) configuration file.

## Source Maps

Source maps are enabled for the `dev` stage by default and disabled for other stages.
You can explicitly enable or disable source maps by setting the `source_maps` configuration option in the [`app.dx`](./09%20Configuration.md#the-appdx-file) file.