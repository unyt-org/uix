# Getting Started with UIX

## What is UIX?

UIX is a state-of-the-art TypeScript framework for building full-stack web applications.
With UIX, you can write frontend and backend code in a single [Deno](https://docs.deno.com/runtime/manual) project.
UIX abstracts away the complexity of communication between servers and clients - there is no need to think about APIs, data serialization, or data storage.

The [DATEX JavaScript Library](https://docs.unyt.org/manual/datex/introduction) acts as the backbone of UIX, providing useful functionality such as *reactivity, restorable state and cross-device data exchange*.

UIX works out of the box with TypeScript and JSX requiring no additional tools or build steps.

UIX encourages the use of standard web APIs wherever possible, and provides a simple and intuitive abstraction layer for more advanced functionality.

> [!NOTE]
> The [UIX Guide](./18%20Guide.md) provides a comprehensive overview for developers new to UIX.


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

 * Hot reloading
 * [Stage management](./09%20Configuration.md#app-deployment-stages)
 * [Automated deployment](./15%20Deployment.md)
 * [Testing library](https://github.com/unyt-org/unyt-tests/)

## Installation

Install the UIX runtime on your system using one of the terminal commands below.

<unyt-tabs>
<unyt-tab label="macOS" default>

```sh
curl -fsSL https://unyt.land/install.sh | sh
```

</unyt-tab>
<unyt-tab label="Windows">

```powershell
irm https://unyt.land/install.ps1 | iex
```

</unyt-tab>
<unyt-tab label="Linux">

```sh
curl -fsSL https://deno.land/install.sh | bash
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

## Create a new UIX project

You can initialize a new UIX project by running
```bash
uix --init <PROJECT_NAME>
```

This will create a new [UIX Base Project](https://github.com/unyt-org/uix-base-project.git) in the given directory and start the application locally.

> [!NOTE]
> We recommend using <a target="_blank" href="https://code.visualstudio.com/download">Visual Studio Code</a> for UIX development.<br/>
> For syntax highlighting and language support (DATEX, Typescript, Deno), the <a target="_blank" href="https://marketplace.visualstudio.com/items?itemName=unytorg.datex-workbench">DATEX Workbench extension</a> can be used.


## The UIX CLI
To launch your UIX application, make sure that a [app.dx](./09%20Configuration.md#the-app-dx-file) configuration file exists in the project root.
Execute the `uix` command in the root directory of the application to initialize and run the project.

```bash
uix
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


To run your UIX project without installing the UIX CLI first, you can alternatively run the following command in the project root directory:
```bash
deno run -A --import-map https://cdn.unyt.org/importmap.json https://cdn.unyt.org/uix/run.ts
```

## UIX Project Architecture
UIX projects combine frontend and backend source code with other resources into a single code base.

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

By default, all files in the `frontend` directory are only available to browser clients *(frontend endpoints)*, while files in the `backend` directory are only available to backend endpoints *(Deno runtime)*.

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
    version: string;               // UIX version ("beta" | "0.2.0" | ...)
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
