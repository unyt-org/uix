# Rendering and Transpilation

When UIX is used as a fullstack framework, HTML pages are automatically rendered for all routes. 
The HTML contains script and style dependencies, import maps and metadata.

Typescript and SCSS files are automatically served as transpiled JavaScript/CSS files.

This chapter provides some background knowledge regarding rendering and transpilation, which
is not required for using UIX.

## Module Preloading

UIX recursively resolves the dependencies in the module tree and adds them as "modulepreload" links (`<link rel="modulepreload" href="...">`) to rendered HTML pages.
This can significantly decrease loading times, especially for initial loads when modules are not available in the browser cache.

Static (`import x from "y"`) and dynamic imports (`await import("y")`), as well as `datex.get` imports are resolved.

The following URLs are excluded from module preloading per default:
 * URLs that are explicitely imported as type modules (`import type {} from "modules.ts"`)
 * NPM modules (identifiers starting with `npm:`, eg. `import x from "npm:..."`)
 * Deno.land modules (starting with `https://deno.land/`)

In dynamic import statements, preloading can be disabled by adding a `/*lazy*/` comment after the module specifier:
```ts
const preloadedModule    = await import("./module-a.ts")
const notPreloadedModule = await import("./module-b.ts" /*lazy*/)
```

Module preloading can be completely disabled by setting `preload_dependencies: false` in the `app.dx` configuration file.

# Transpilation and Minification

UIX transpiles and minifies each TypeScript module individually.
Modules are not bundled.

You can disable minification by setting `minify_js: false` in the `app.dx` configuration file.

# Source Maps

Source maps are enabled for the `dev` stage per default and disabled for other stages.
You can explicitly enable or disable source maps by setting the `source_maps` configuration option in the `app.dx` file.