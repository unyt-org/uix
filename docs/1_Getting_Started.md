# Getting Started with UIX

# 🧩 Architecture of a UIX Project
Frontend and backend source code and other resources can be put into a single UIX project.

Files in the `frontend` directory of the project are only available to frontend endpoints (browser clients), while files in the `backend` directory are only available to backend endpoints (deno).

However, a key feature of UIX is that backend modules can be imported from frontend modules and vice versa.
Files in the `common` directory are accessible from the frontend and backend.

# ✏️ Creating a new UIX Project

## Option 1: Using the UIX Project Template
You can clone the UIX Base Project from `https://git.unyt.org/unyt/code/templates/uix-templates/uix-base-project`.

## Option 2: Creating a new UIX Project from Scratch

A UIX Project requires at least three files:

 *  An `app.dx` or `app.json` config file that contains information about the app.
	All properties in this config file are optional, but we recommend to set at least an app name:
	```datex
	name: "My cool new app"
	description: "This is my cool new app"
	```
 *	A `deno.json` file containing an import map and JSX settings:
 	```json
	{
		"imports": {
			"uix": "https://cdn.unyt.org/uix/uix.ts",
			"uix/": "https://cdn.unyt.org/uix/",
			"uix_std/": "https://cdn.unyt.org/uix/uix_std/",
			"uix/jsx-runtime": "https://cdn.unyt.org/uix/jsx-runtime/jsx.ts",
			
			"unyt_core": "https://cdn.unyt.org/unyt_core/datex.ts",
			"unyt_core/": "https://cdn.unyt.org/unyt_core/",
		},
		
		"compilerOptions": {
			"jsx": "react-jsx",
			"jsxImportSource": "uix",
		}
	}
	```
 *  An `entrypoint.ts` file, located in the `backend/` or `frontend/` directory.


Per default, frontend code goes into a directory named `frontend`, backend code in a directory named
`backend`, and common library code into a directory named `common`. These names can be changed in the app configuration file (`app.dx`), and additional directories can be defined.


# 🔌 Running a UIX Project

## Runtime Requirements
The designated backend runtime for UIX is [deno](https://deno.land/manual@v1.32.3/getting_started/installation), because it provides the greatest compatibility with Web APIs and browsers. Node.JS is currently not supported.

On the frontend, UIX currently requires at least Chromium 90, Firefox 108 or Safari 16.4.

## Run Command
The UIX utility script can be installed with `curl -s https://cdn.unyt.org/uix/install.sh | sh` on Linux and MacOS.
To run a UIX project, just run `uix` in the project root directory (where the `app.dx` is located).

If you don't want to install `uix`, you can alternatively run `deno run -Aq https://cdn.unyt.org/uix/run.ts`


# 🏝 UIX as a Frontend Library
UIX was designed as a full stack framework, but it can also be used as a standalone frontend library.

## Import Map
You can directly import the UIX library from the unyt CDN (https://cdn.unyt.org/uix/uix.ts).
To resolve imports correctly, you need to add an import map to your HTML page.

```html
<html>
	<head>
		<script type="importmap">
			{
				"imports": {
					"uix": "https://cdn.unyt.org/uix/uix.ts",
					"uix/": "https://cdn.unyt.org/uix/",
					"uix_std/": "https://cdn.unyt.org/uix/uix_std/",
					"uix/jsx-runtime": "https://cdn.unyt.org/uix/jsx-runtime/jsx.ts",
					
					"unyt_core": "https://cdn.unyt.org/unyt_core/datex.ts",
					"unyt_core/": "https://cdn.unyt.org/unyt_core/",
				}
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

## Dealing with TypeScript in browsers (File Server)

You can of course use a classic build setup and compile your TypeScript files to JavaScript with tsc or other tools.

But we recommend using the unyt standalone file server that returns transpiled JS files when TS files are requested by a browser client.

*This file server is also used for the unyt CDN.*

The server can be started with:

```bash
deno run -Aq https://cdn.unyt.org/unyt_node/file_server.ts
```

The root directory for the served files can be specified with the `-p` option.
Per default, the current working directory is used as the root directory. 

To automatically recompile TypeScript files when they are changed, you can add the `-w` option.