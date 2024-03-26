# Getting Started with UIX

UIX is an open-source full-stack framework for developing reactive web apps with *restorable and shared state*.
UIX apps run on a [Deno](https://docs.deno.com/runtime/manual) backend and use state-of-the-art web technologies.

The [DATEX JavaScript Library](https://docs.unyt.org/manual/datex/introduction) acts as the backbone of UIX, providing useful functionality such as *reactivity and cross-device data exchange*.
In contrast to frameworks like React, UIX provides *direct wiring* to the DOM for reactivity and does not need a virtual DOM.

**Our core principles**
 * Full compatibility with web standards
 * Full compatibility with [DATEX](https://github.com/unyt-org/datex-specification) and unyt.org Supranet principles
 * Both backend and frontend code is written as ES6 TypeScript modules
 * No JavaScript bundlers

**Main features**
 * [Cross-network reactivity](02%20Cross-Realm%20Imports.md#Reactivity)
 * [Server side rendering with partial hydration](07%20Rendering%20Methods.md)
 * [Hybrid backend/frontend routing](05%20Entrypoints%20and%20Routing.md)
 * [Cross-realm imports](./02%20Cross-Realm%20Imports.md#cross-realm-imports)
 * [Restorable state](06%20Persistent%20Contexts.md)
 * [JSX support](./03%20JSX.md)
 * [Reusable web components](./04%20Components.md)
 * [SCSS support](./11%20Style%20and%20Themes.md#SCSS)
 * [And many more](https://uix.unyt.org)...

UIX aims to simplify all phases of the app development cycle, including design, development, testing and distribution, in order to make the developer experience as convenient as possible. 
This is why UIX ships with integrated features such as:
 * Hot reloading
 * [Stage management](./08%20Configuration.md#app-deployment-stages)
 <!-- * Version management -->
 * [Automated deployment](./13%20Deployment.md)
 * [Testing library](https://github.com/unyt-org/unyt-tests/)

### CLI Installation

To install UIX, you first need to install [Deno](https://docs.deno.com/runtime/manual/getting_started/installation).

> [!WARNING]
> UIX is only supported for Deno versions > 1.40.0

<!-- #### Linux / MacOS

```bash
$ curl -s https://cdn.unyt.org/uix/install.sh | sh
```

#### MacOS (Homebrew)

On MacOS, UIX can also be installed with homebrew:
```bash
$ brew tap unyt-org/uix
$ brew install uix
```

#### Windows / other systems -->

Now, you can install UIX with `deno install`:

```bash
$ deno install --import-map https://cdn.unyt.org/uix/importmap.json -Aq -n uix https://cdn.unyt.org/uix/run.ts
```

## Creating a new UIX project

You can create a new UIX project by running
```bash
$ uix --init
```

This creates a new base project (https://github.com/unyt-org/uix-base-project.git) in the current directory
and starts the app locally.

> [!NOTE]
> We recommend using <a target="_blank" href="https://code.visualstudio.com/download">Visual Studio Code</a> for developing UIX apps.<br/>
> For syntax highlighting and language support (DATEX, Typescript, Deno), the <a target="_blank" href="https://marketplace.visualstudio.com/items?itemName=unytorg.datex-workbench">DATEX Workbench extension</a> is required.


## Running your UIX app
To run your UIX app, make sure the [app.dx](./08%20Configuration.md#the-app-dx-file) configuration file exists.
Execute the `uix` command in the root directory of your application (where the `app.dx` is located) to initialize and run the project.

```bash
$ uix
```

You can pass the following args to the UIX command line utility:
* `-p {PORT}`, `--port {PORT}`  - Specify the port
* `-b`, `--watch-backend`       - Automatically reload the backend deno process when backend files are modified
* `-l`, `--live`                - Automatically reload connected browsers tabs when files are modified
* `-w`, `--watch`               - Recompile frontend scripts when files are modified
* `-d`, `--detach`              - Keep the app running in background
* `-r`, `--reload`              - Force reload deno caches
* `-h`, `--help`                - Show the help page

---

* `--hod`, `--http-over-datex`  - Enable HTTP-over-DATEX (default: true)
* `--stage {STAGE}`             - Current deployment stage (default: dev)
* `--env {NAME=VAL}`            - Exposed environment variables (for remote deployment)
* `--clear`                     - Clear all eternal states on the backend
* `--version`                   - Get the version of your UIX installation
* `--init`                      - Inititialize a new UIX project
* `--import-map {PATH}`         - Import map path
* `--enable-tls`                - Run the web server with TLS
* `--inspect`                   - Enable debugging for the deno process
* `--unstable`                  - Enable unstable deno features


To run your UIX project without installing the UIX CLI, you can alternatively run the following command in the project root directory:
```bash
$ deno run -A --import-map https://cdn.unyt.org/importmap.json https://cdn.unyt.org/uix/run.ts
```

## Architecture of a UIX Project
In a UIX project, frontend and backend source code or other resources are combined in one single project.

```
.
└── uix-app/
    ├── backend/
    │   ├── .dx                 // Config file for the backend endpoint
    │   └── entrypoint.tsx      // Backend entrypoint
    ├── common/                 // Common modules accessible from backend and frontend
    ├── frontend/
    │   ├── .dx                 // Config file for the frontend endpoint
    │   └── entrypoint.tsx      // Frontend entrypoint
    ├── app.dx                  // App config file
    └── deno.json               // Deno config file
```

Per default, all files in the `frontend` directory are only available in browser clients (frontend endpoints), while files in the `backend` directory are only available for backend endpoints (Deno runtime).

With UIX [Cross-Realm Imports](./02%20Cross-Realm%20Imports.md#cross-realm-imports), TypeScript/JavaScript/DATEX modules from the backend can be imported and used inside frontend modules.

Files in the `common` directory can be accessed from both the `frontend` and `backend` scope.

## The UIX namespace
The `UIX` namespace can be imported
with
```ts
import { UIX } from "uix"
```

This namespace contains some important global properties:
```ts
interface UIX {
    Theme: ThemeManager;           // UIX Theme manager to register and activate themes and dark/light mode
    cacheDir: Path;                // URL pointing to the local UIX cache directory
    context: "backend"|"frontend"; // current context in which the process is running
    language: string;              // language ("de" | "en" | ...)
    version: string;               // UIX version ("beta" | "1.0.0" | ...)
}
```

## UIX development

Per default, a UIX app runs in the `dev` stage. 

In this stage, special development features are enabled:
 * You can completely reset the current page state with `CTRL+R`
 * Error stacks for backend errors thrown during routing are displayed in the browser
 * Source maps for TypeScript files are available in the browser

### Running UIX apps locally

Per default, UIX apps run on `http://localhost:80`.
If port 80 is already in use, UIX automatically finds a free port.

You can also specify a custom port with the `--port` argument if this port is not available
on your system or if you want to run multiple UIX simultaneously.

> [!WARNING]
> Keep in mind that the cookies are the same for all localhost apps, regardless of the port.
> This can lead to unexpected behaviour when opening multiple apps that are running on different localhost ports in the same browser (e.g. endpoint and themes might get overridden).


## Helpful articles

* [UIX introduction for React developers](https://unyt.blog/article/2023-11-03-gettings-started-with-uix-coming-from-react)
