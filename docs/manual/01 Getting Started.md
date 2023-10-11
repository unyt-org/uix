# Getting Started with UIX

[UIX](https://uix.unyt.org) is a full-stack web framework for developing reactive web apps with restorable and shared state.
UIX apps run on a [deno](https://docs.deno.com/runtime/manual) backend and use modern web technologies.
The [DATEX JavaScript Library](https://docs.unyt.org/manual/datex/introduction) acts as the backbone of UIX, providing reactivity and cross-device data exchange functionality.

The core principles of UIX:
 * Complete compatiblity with web standards
 * Compatible with [DATEX](https://github.com/unyt-org/datex-specification) and unyt.org supranet concepts
 * Code for backend and frontend is written as ES6 TypeScript modules

Main features of UIX:
 * Reactivity
 * Server side rendering with partial hydration
 * Hybrid backend/frontend routing
 * Cross-realm imports
 * JSX support
 * Reusable Components
 * SCSS Supports
 * Shared memory

UIX also makes the development and deployment process easy with:
 * Hot reloading
 * Integrated testing
 * Stage management
 * Version management
 * Automated deployment

### Installing the UIX command line tool

#### Linux / MacOS

```bash
curl -s https://dev.cdn.unyt.org/uix/install.sh | sh
```
If the `uix` command is not available afterwards, you might have to run `source ~/.bash_profile`.

#### MacOS (Homebrew)

On MacOS, UIX can also be installed with homebrew:
```bash
brew tap unyt-org/uix
brew install uix
```

## Creating a new UIX Project

You can get started by cloning a simple UIX example project from https://github.com/unyt-org/uix-base-project:
```bash
git clone git@github.com:unyt-org/uix-base-project.git
```

> [!NOTE]
> We recommend using [Visual Studio Code](https://code.visualstudio.com/download) as an IDE.
> In VS Code, you can also install the [DATEX Workbench](https://marketplace.visualstudio.com/items?itemName=unytorg.datex-workbench) extension
> for UIX and DATEX language support.




## Running a UIX Project



To run the UIX project, run the following command in the project root directory (where the `app.dx` is located):
```bash
deno run -Aq --importmap https://dev.cdn.unyt.org/importmap.json https://dev.cdn.unyt.org/uix/run.ts
```
Alternatively, you can install the UIX command line tool.



## Architecture of a UIX Project

With UIX, frontend and backend source code or other resources can be put into a single project.

Files in the `frontend` directory of the project are only available to frontend endpoints (browser clients), while files in the `backend` directory are only available to backend endpoints (Deno).

However, a key feature of UIX is that backend modules can be imported from frontend modules and vice versa.
Files in the `common` directory are accessible from the frontend and backend.
