# Getting Started with UIX

[UIX](https://uix.unyt.org) is an open-source full-stack web framework for developing reactive web apps with restorable and shared state.
UIX apps run on a [deno](https://docs.deno.com/runtime/manual) backend and use state-of-the-art web technologies.

The [DATEX JavaScript Library](https://docs.unyt.org/manual/datex/introduction) acts as the backbone of UIX, providing usefull functionality such as reactivity and cross-device data exchange.
In contrast to frameworks like React, UIX provides *direct wiring* to the DOM for reactivity and does not need a virtual DOM.

**Our core principles**
 * Complete compatibility with web standards
 * Full compatibility with [DATEX](https://github.com/unyt-org/datex-specification) and unyt.org Supranet principles
 * Both backend and frontend code is written as ES6 TypeScript modules

**Main features**
 * Cross-network reactivity
 * Server side rendering with partial hydration
 * Hybrid backend/frontend routing
 * Cross-realm imports
 * Shared memory
 * JSX support
 * Reusable Web Components
 * SCSS support
 * [And many more](https://uix.unyt.org)...

UIX aims to simplify all phases of the app development cycle, including design, development, testing and distribution, in order to make the developer experience as convenient as possible. 
This is why UIX ships with integrated features such as:
 * Hot reloading
 * Testing library
 * Stage management
 * Version management
 * Automated deployment

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
* `--port {PORT}` / `-p {PORT}` - Specify the port on your local machine where the HTTP server should run
* `--watch` / `-w` - Setup file watcher to automatically re-transpile TypeScript and SCSS files on change
* `--live` / `-l` - Enable hot reloading on file change
* `--inspect` - Enable debugging of the deno process

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
    │   └── entrypoint.tsx      // Frontend entrypoint
    ├── app.dx                  // App config file
    └── deno.json               // Deno config file
```

Per default all content in the `frontend` directory is only available to frontend endpoints (browser clients), while content in the `backend` directory is available to backend endpoints (Deno runtime). 

Thanks to [Cross-Realm Imports](./02%20Imports.md#cross-realm-imports), UIX allows the import and usage of backend modules inside frontend modules and vice versa.
Files in the `common` directory are accessible from both the `frontend` and `backend` scope.
