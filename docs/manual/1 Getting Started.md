# Getting Started with UIX

## Creating a new UIX Project

You can get started by cloning a simple UIX example project from https://github.com/unyt-org/uix-base-project:
```bash
git clone git@github.com:unyt-org/uix-base-project.git
```

If you are using VS Code, you can also install the [DATEX Workbench](https://marketplace.visualstudio.com/items?itemName=unytorg.datex-workbench) extension
for UIX and DATEX support.



## Running a UIX Project

To run the UIX project, run the following command in the project root directory (where the `app.dx` is located):
```bash
deno run -Aq --importmap https://dev.cdn.unyt.org/importmap.json https://dev.cdn.unyt.org/uix/run.ts
```
Alternatively, you can install the UIX command line tool.

### The UIX command line tool

#### Install on Linux / MacOS
```bash
curl -s https://dev.cdn.unyt.org/uix/install.sh | sh
```
If the `uix` command is not available afterwards, you might have to run `source ~/.bash_profile`.

#### Install on MacOS
On MacOS, UIX can also be installed with homebrew:
```bash
brew tap unyt-org/uix
brew install uix
```

After installation, you can just run the `uix` command in your project root directory.




## Architecture of a UIX Project

With UIX, frontend and backend source code or other resources can be put into a single project.

Files in the `frontend` directory of the project are only available to frontend endpoints (browser clients), while files in the `backend` directory are only available to backend endpoints (Deno).

However, a key feature of UIX is that backend modules can be imported from frontend modules and vice versa.
Files in the `common` directory are accessible from the frontend and backend.



## UIX as a Frontend Library
UIX was designed as a fullstack framework, but it can also be used as a standalone frontend library.

### Import Map
You can directly import the UIX library from the unyt CDN (https://cdn.unyt.org/uix/uix.ts).
To resolve imports correctly, you need to add an import map to your HTML page.

```html
<html>
    <head>
        <script type="importmap">
            {
                "imports": {
                    "unyt/": "https://dev.cdn.unyt.org/",
                    "unyt_core": "https://dev.cdn.unyt.org/unyt_core/datex.ts",
                    "uix": "./uix.ts",
                    "unyt_core/": "https://dev.cdn.unyt.org/unyt_core/",
                    "uix/": "./",
                    "uix_std/": "./uix_std/",
                    "unyt_tests/": "https://dev.cdn.unyt.org/unyt_tests/",
                    "unyt_web/": "https://dev.cdn.unyt.org/unyt_web/",
                    "unyt_node/": "https://dev.cdn.unyt.org/unyt_node/",
                    "unyt_cli/": "https://dev.cdn.unyt.org/unyt_cli/",
                    "uix/jsx-runtime": "./jsx-runtime/jsx.ts"
            }
        </script>
        <script type="module" src="./main.ts"></script>
    </head>
</html>
```


```typescript
import { UIX } from "uix";
// ...
```

### Dealing with TypeScript in browsers (File Server)

You can of course use a classic build setup and compile your TypeScript files to JavaScript with tsc or other tools.

For some uses cases, especially during development, it could be helpful to use the unyt standalone file server that automatically serves transpiled JS files when TS files are requested by a browser client.

We also use this file server for our CDN, because it provides great compatibility with Deno:
When `.ts` files are requested by a Deno runtime, the server still returns the original source with type information.

The server can be started with:

```bash
deno run -Aq https://cdn.unyt.org/uix/server/standalone-file-server.ts
```

The root directory for the served files can be specified with the `-p` option.
Per default, the current working directory is used as the root directory. 

To automatically recompile TypeScript files when they are changed, you can add the `-w` option.
