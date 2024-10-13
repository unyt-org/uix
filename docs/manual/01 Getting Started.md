# Getting Started with UIX

*Welcome to the UIX documentation! We’re glad you’re here  <3*

## What is UIX?

[UIX](https://github.com/unyt-org/uix) is a state-of-the-art TypeScript framework for building full-stack web applications.
With UIX, you can write frontend and backend code in a single [Deno](https://docs.deno.com/runtime/manual) project.
UIX abstracts away the complexity of communicating between servers and clients - there is no need to think about APIs, data serialization, or data storage.

The [DATEX JavaScript Library](https://docs.unyt.org/manual/datex/introduction) acts as the backbone of UIX, providing useful functionality such as *reactivity, restorable state and cross-device data exchange*.

UIX works out of the box with TypeScript and JSX requiring no additional tools or build steps.

The framework encourages the use of standard web APIs wherever possible, and provides a simple and intuitive abstraction layer for more advanced functionality.

> [!NOTE]
> The [UIX Guide](https://docs.unyt.org/guide) provides a comprehensive overview for developers new to UIX.


## Main Features

 * [Cross-network reactivity](02%20Cross-Realm%20Imports.md#Reactivity)
 * [Server side rendering with partial hydration](08%20Rendering%20Methods.md)
 * [Hybrid backend/frontend routing](05%20Entrypoints%20and%20Routing.md)
 * [Cross-realm imports](./02%20Cross-Realm%20Imports.md#cross-realm-imports)
 * [Restorable state](06%20Persistent%20Contexts.md)
 * [JSX support](./03%20JSX.md)
 * [Reusable web components](./04%20Components.md)
 * [And many more](https://uix.unyt.org)...

UIX aims to simplify all phases of the application development cycle, including design, development, testing and deployment, in order to make the developer experience as convenient as possible. 
For this reason, UIX ships with built-in features such as

 * [Hot reloading](#the-uix-cli)
 * [Stage management](./09%20Configuration.md#app-deployment-stages)
 * [Automated deployment](./15%20Deployment.md)
 * [Testing library](https://github.com/unyt-org/unyt-tests/)

## Installation

Install the UIX runtime on your system using one of the shell commands below.

<unyt-tabs>
<unyt-tab label="macOS" default>

```sh
curl -fsSL https://unyt.land/install.sh | bash
```

</unyt-tab>
<unyt-tab label="Windows">

```powershell
irm https://unyt.land/install.ps1 | iex
```

</unyt-tab>
<unyt-tab label="Linux">

```sh
curl -fsSL https://unyt.land/install.sh | bash
```

</unyt-tab>
</unyt-tabs>

After installation, you should have the [Deno for UIX](https://github.com/unyt-org/deno) and [UIX](https://github.com/unyt-org/uix) executables available on your system path. You can verify the installation by running:

```shell
uix --version
```


> [!NOTE]
> Please ensure that the system environment variable `PATH` includes the `~/.uix/bin` folder as instructed by the UIX installer. Restarting your terminal or IDE after installation might be helpful to make the `uix` command available.

Please make sure to have the [`git`](https://git-scm.com/downloads) utility installed on your system since it is used for the deployment of UIX apps.

## Development environment
While you can use any editor or integrated development environment (IDE) for UIX development, we recommend using one with support for `Deno` and `TypeScript`. This will provide useful features like syntax highlighting, code completion, and linting, which can improve productivity and help avoid common errors. 


We recommend using <a target="_blank" href="https://code.visualstudio.com/download">Visual Studio Code</a> for UIX development. Make sure to load the [Deno extension](vscode:extension/denoland.vscode-deno) and [initialize the Deno Workbench configuration](https://docs.deno.com/runtime/reference/vscode/#enabling-deno-in-a-vs-code-workspace) for your UIX project to enable syntax highlighting and import resolution.

For advanced syntax highlighting and language support *(for DATEX and JSX)*, the <a target="_blank" href="https://marketplace.visualstudio.com/items?itemName=unytorg.datex-workbench">DATEX Workbench extension</a> for Visual Studio can be used. Find more information [here](./20%20DATEX%20Workbench.md).

## Create a new UIX project

You can initialize a new UIX project by running
```bash
uix --init <name>
```

This will create a new [Hello UIX](https://github.com/unyt-org/uix-template-hello-uix) project in the given directory and launch the application locally.

You can also select a predefined template such as [`hello-uix`](https://github.com/unyt-org/uix-template-hello-uix), [`base`](https://github.com/unyt-org/uix-template-base), [`deployment`](https://github.com/unyt-org/uix-template-deployment) or [`routing`](https://github.com/unyt-org/uix-template-routing) when passing the `template` flag:

```bash
uix --init <name> --template [template]
```

You can find the full list of available templates [here](https://github.com/orgs/unyt-org/repositories?type=source&q=uix-template-+template%3Atrue).

## The UIX CLI
To launch your UIX application, make sure that a [app.dx](./09%20Configuration.md#the-app-dx-file) configuration file exists in the project root.
Execute the `uix` command in the root directory of the application to initialize and run the project.

```bash
uix
```


You can pass the following args to the UIX command line utility:

### Default options

| Option | Description |
|-|-|
| `-p <port>`, `--port <port>` | Specify the port |
| `-b`, `--watch-backend` | Automatically reload the backend Deno process when backend files are modified |
| `-l`, `--live`         | Automatically reload connected browser tabs when files are modified |
| `-w`, `--watch`        | Recompile frontend scripts when files are modified |
| `-d`, `--detach`       | Keep the app running in the background |
| `-r`, `--reload`       | Force reload Deno caches |
| `-h`, `--help`         | Show the help page |
---

### Advanced options
| Option | Description |
|-|-|
| `--hod`, `--http-over-datex`   | Enable HTTP-over-DATEX (default: true) |
| `--stage <stage>`              | Current deployment stage *(default: dev)* |
| `--env <name=value>`           | Exposed environment variables (for remote deployment) |
| `--clear`                      | Clear all eternal states on the backend |
| `--version`                    | Get the version of your UIX installation |
| `--init [name]`                | Initialize a new UIX project |
| `--template <name>`            | Selects a predefined template when used with `--init` |
| `--import-map <path>`          | Import map path |
| `--enable-tls`                 | Run the web server with TLS |
| `--inspect`                    | Enable debugging for the Deno process |
| `--unstable`                   | Enable unstable Deno features |


To run your UIX project without installing the UIX CLI first, you can alternatively run the following command in the project root directory:
```bash
deno run -A --import-map https://cdn.unyt.org/importmap.json https://cdn.unyt.org/uix/run.ts
```

## UIX Project Architecture
A UIX project combines frontend and backend source code with other resources into a single code base.

```
.
└── uix-app/
    ├── backend/
    │   ├── .dx               // Backend config file
    │   └── entrypoint.tsx    // Backend entrypoint
    ├── common/               // Shared modules for backend and frontend
    ├── frontend/
    │   ├── .dx               // Frontend config file
    │   └── entrypoint.tsx    // Frontend entrypoint
    ├── app.dx                // App config file
    └── deno.json             // Deno config file
```

By default, all files in the `frontend` directory are only available to browser clients *(frontend endpoints)*, while files in the `backend` directory are only available to Deno server instances (*backend endpoints*).

UIX [Cross-Realm Imports](./02%20Cross-Realm%20Imports.md#cross-realm-imports) allow crossing this boundary between frontend and backend. You can directly import TypeScript modules from the backend in frontend modules and access exported functions and values.

Files in the `common` directory can be accessed from both the `frontend` and `backend` realm and can contain shared logic, types, components or resources.

## Deno configuration
In order to run your UIX application, you need to provide a [`deno.json`](#denojson) configuration file and a [`importmap`](#importmapjson) in the toplevel of your project.

### deno.json
The [`deno.json`](https://docs.deno.com/runtime/fundamentals/configuration/) should contain a reference to the importmap that should be used for your application and will allow JSX to work. For advanced language support, the compiler options `lib` should include `dom` and `deno.window`.

Reactivity in UIX is handled by [`JUSIX`](https://docs.unyt.org/guide/reactivity). It can be enabled by setting the compiler options `jsxImportSource` property in `deno.json` to `jusix`, or disabled by setting it to `uix`.

```json title="deno.json" icon="fa-file"
{
    "importMap": "./importmap.json",
    "compilerOptions": {
        "jsx": "react-jsx",
        "jsxImportSource": "jusix",
        "lib": [
            "dom",
            "deno.window"
        ]
    }
}
```

### importmap.json
Typing out the module name with the full URL and version specifier can become tedious when importing them in your UIX project.

The [`importmap.json`](https://docs.deno.com/runtime/fundamentals/modules/), which is based on the [Import Maps Standard](https://github.com/WICG/import-maps), is required for your UIX project to resolve import specifiers such as `uix` or `datex-core-legacy`, and to allow UIX-style JSX.


```json title="importmap.json" icon="fa-file"
{
    "imports": {
        "datex-core-legacy": "https://cdn.unyt.org/datex-core-js-legacy@0.2.x/datex.ts",
        "datex-core-legacy/": "https://cdn.unyt.org/datex-core-js-legacy@0.2.x/",
        "uix": "https://cdn.unyt.org/uix@0.3.x/uix.ts",
        "uix/": "https://cdn.unyt.org/uix@0.3.x/src/",
        "uix/jsx-runtime": "https://cdn.unyt.org/uix@0.3.x/src/jsx-runtime/jsx.ts",
        "jusix/jsx-runtime": "https://cdn.unyt.org/uix@0.3.x/src/jsx-runtime/jsx.ts",
        "unyt-tests/": "https://cdn.unyt.org/unyt_tests/"
    }
}
```

> [!NOTE]
> We recommend using pinned versions of the modules imported from the [unyt.org CDN](https://cdn.unyt.org) to protect your UIX project from breaking changes in upcoming releases. In this case, even with a [UIX CLI](#the-uix-cli) update, your app will be started with the pinned versions specified in the importmap.

## The UIX namespace
The `UIX` namespace can be imported
with
```ts
import { UIX } from "uix";
```

The `UIX` namespace contains the following properties:

```ts
interface UIX {
    Theme: ThemeManager;             // UIX Theme manager to register and activate themes and dark/light mode
    cacheDir: Path;                  // URL pointing to the local UIX cache directory
    context: 'backend' | 'frontend'; // current context in which the process is running
    language: string;                // language ('de' | 'en' | ...)
    version: string;                 // UIX version ('beta' | '0.3.0' | ...)
}
```

## UIX development

By default, a UIX application starts up in the development (`dev`) stage. 

This is the stage where special development features are enabled:
 * You can completely reset the current page state with `CTRL+R`
 * Error stacks for backend errors thrown during routing are displayed in the browser
 * [Source maps](https://github.com/mozilla/source-map) for TypeScript files are available in the browser

### Running UIX apps locally

By default, UIX applications run on `http://localhost:80`.
If the port 80 on the host system is already in use, UIX will automatically select a free port.

With the [`--port`](#default-options) argument, the UIX CLI lets you specify a custom port on which to start the UIX application. This can be useful if you plan to run multiple UIX instances in parallel.

> [!WARNING]
> Note that HTTP cookies are shared between all localhost applications, regardless of the port.
> This can lead to unexpected behavior when opening multiple apps that are running on different ports in the same browser (e.g. client endpoints and theme data might get overridden).


## Helpful articles

* [UIX introduction for React developers](https://unyt.blog/article/2023-11-03-gettings-started-with-uix-coming-from-react)
