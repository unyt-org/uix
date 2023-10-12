# Getting Started with UIX

[UIX](https://uix.unyt.org) is a free open-source full-stack web framework for developing reactive web apps with restorable and shared state.
UIX apps run on a [deno](https://docs.deno.com/runtime/manual) backend using state-of-the-art web technologies.
The [DATEX JavaScript Library](https://docs.unyt.org/manual/datex/introduction) acts as the backbone of UIX, providing usefull functionality such as reactivity and cross-device data exchange.

**Our core principles**
 * Complete compatiblity with web standards
 * Fully compatible with [DATEX](https://github.com/unyt-org/datex-specification) and unyt.org Supranet concepts
 * Code for backend and frontend is written as ES6 TypeScript modules

**Main features**
 * Full-stack Reactivity
 * Server side rendering with partial hydration
 * Hybrid backend/frontend routing
 * Cross-realm imports
 * JSX support
 * Reusable Web Components
 * SCSS Supports
 * Shared memory
 * [And many more](https://uix.unyt.org)...

UIX aims to simplify all phases of the app development cycle, including design, development, testing and distribution, in order to make the developer experience as convenient as possible. This is why UIX shipes with integrated features such as:
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

Get started by cloning the most simple UIX example project from https://github.com/unyt-org/uix-base-project:
```bash
$ git clone git@github.com:unyt-org/uix-base-project.git
```

> [!NOTE]
> We recommend using [Visual Studio Code](https://code.visualstudio.com/download) as preferred IDE.
> In VS Code, you may want to install the [DATEX Workbench](https://marketplace.visualstudio.com/items?itemName=unytorg.datex-workbench) extension
> for UIX and DATEX language support.



## Running your UIX App
To run your UIX project make sure the [app.dx]() configuration file exists.
Execute the `uix` command in the root directory of your application (where the `app.dx` is located) to initialize and run the project.

```bash
$ uix
```

You may want to pass in following args to the UIX command line utility:
* `--port {PORT}` / `-p {PORT}` - Specify the port on your local machine where the UIX should run
* `--watch` / `-w` - Setup file watch
* `--live` / `-l` - Enable hot reloading

To run your UIX project without the UIX CLI installation, you may run the following command in the project root directory to achieve similar results:
```bash
$ deno run -Aq --importmap https://dev.cdn.unyt.org/importmap.json https://dev.cdn.unyt.org/uix/run.ts
```

## Architecture of a UIX Project
With UIX, frontend and backend source code and other resources can be combined in one single project.

```
.
└── UIX/
    ├── backend/
    │   ├── .dx                 // Config file for deployment
    │   └── entrypoint.tsx      // Backend entrypoint
    ├── common/
    ├── frontend/
    │   └── entrypoint.tsx      // Frontend entrypoint
    ├── app.dx                  // Endpoint config file
    └── deno.json               // Deno config file
```

Per default all content in the `frontend` directory is only available to frontend endpoints (browser clients), while content in the `backend` directory is available to backend endpoints (Deno runtime). Thanks to [Cross-Realm Imports](./02%20Imports.md#cross-realm-imports), UIX allows import and usage of backend-modules inside the frontend code and vice versa.
Files in the `common` directory are accessible from both the `frontend` and `backend`.
