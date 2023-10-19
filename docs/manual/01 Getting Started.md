# Getting Started with UIX

UIX is an open-source full-stack web framework for developing reactive web apps with *restorable and shared state*.
UIX apps run on a [deno](https://docs.deno.com/runtime/manual) backend and use state-of-the-art web technologies.

The [DATEX JavaScript Library](https://docs.unyt.org/manual/datex/introduction) acts as the backbone of UIX, providing useful functionality such as *reactivity and cross-device data exchange*.
In contrast to frameworks like React, UIX provides *direct wiring* to the DOM for reactivity and does not need a virtual DOM.

**Our core principles**
 * Complete compatibility with web standards
 * Full compatibility with [DATEX](https://github.com/unyt-org/datex-specification) and unyt.org Supranet principles
 * Both backend and frontend code is written as ES6 TypeScript modules

**Main features**
 * [Cross-network reactivity](02%20Imports%20and%20Synchronization.md#Reactivity)
 * [Server side rendering with partial hydration](07%20Rendering%20Modes.md)
 * [Hybrid backend/frontend routing](05%20Entrypoints%20and%20Routing.md)
 * [Cross-realm imports](./02%20Imports%20and%20Synchronization.md)
 * [Shared memory](02%20Imports%20and%20Synchronization.md#Synchronization)
 * [JSX support](./03%20JSX.md)
 * [Reusable web components](./04%20Components.md)
 * [SCSS support](./11%20Style%20and%20Themes.md#SCSS)
 * [And many more](https://uix.unyt.org)...

UIX aims to simplify all phases of the app development cycle, including design, development, testing and distribution, in order to make the developer experience as convenient as possible. 
This is why UIX ships with integrated features such as:
 * Hot reloading
 * [Testing library](https://github.com/unyt-org/unyt-tests/)
 * [Stage management](./08%20Configuration.md#app-deployment-stages)
 * Version management
 * [Automated deployment](./11%20Deployment.md)

### CLI Installation

#### Linux / MacOS

```bash
$ curl -s https://dev.cdn.unyt.org/uix/install.sh | sh
```
If the `uix` command is not available afterwards, you might have to run `source ~/.bash_profile`.

#### MacOS (Homebrew)

On MacOS, UIX can also be installed with homebrew:
```bash
$ brew tap unyt-org/uix
$ brew install uix
```

#### Windows / other systems

Installation via `deno install`:

```bash
$ deno install --import-map https://cdn.unyt.org/importmap.json -Ar -n uix https://cdn.unyt.org/uix/run.ts
```


## Initial Project Setup

Get started by cloning a simple UIX example project from https://github.com/unyt-org/uix-base-project:
```bash
$ git clone https://github.com/unyt-org/uix-base-project.git
```

> [!NOTE]
> We recommend using [Visual Studio Code](https://code.visualstudio.com/download) for developing UIX apps.
> In VS Code, you can install the [DATEX Workbench](https://marketplace.visualstudio.com/items?itemName=unytorg.datex-workbench) extension
> for UIX and DATEX language support.



## Running your UIX app
To run your UIX project, make sure the [app.dx]() configuration file exists.
Execute the `uix` command in the root directory of your application (where the `app.dx` is located) to initialize and run the project.

```bash
$ uix
```

You can pass the following args to the UIX command line utility:
* `-p {PORT}`, `--port {PORT}`                - Specify the port
* `-b`, `--watch-backend`       - Restart the backend deno process when backend files are modified
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
* `--import-map {PATH}`         - Import map path
* `--enable-tls`                - Run the web server with TLS
* `--inspect`                   - Enable debugging for the deno process
* `--unstable`                  - Enable unstable deno features


To run your UIX project without installing the UIX CLI, you can alternatively run the following command in the project root directory:
```bash
$ deno run -A --import-map https://cdn.unyt.org/importmap.json https://cdn.unyt.org/uix/run.ts
```

## Architecture of a UIX Project
With UIX, frontend and backend source code and other resources can be combined in one single project.

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

Per default all content in the `frontend` directory is only available to frontend endpoints (browser clients), while content in the `backend` directory is available to backend endpoints (Deno runtime). 

Thanks to [Cross-Realm Imports](./02%20Imports.md#cross-realm-imports), UIX allows the import and usage of backend modules inside frontend modules and vice versa.
Files in the `common` directory are accessible from both the `frontend` and `backend` scope.
