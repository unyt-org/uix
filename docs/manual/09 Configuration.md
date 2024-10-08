# App Configuration

A UIX app can be configured with 2 types of files: An `app.dx` file that specifies general options for the entire app, and individual `.dx` files located in frontend or backend directories that specify options for the specific endpoints.

## DATEX Script files (.dx)

UIX uses DATEX Script files as its configuration files.

DATEX Script is a superset of JSON. It also supports URLs, relative paths and user-defined types. Single- and multiline comments can be used.

Example:
```datex title="MyFile.dx"
{
    normalJSON: [1, "text", {"a": "b"}],
    url: https://example.com, // this is a comment
    relativePath: ../my/file/path,
}
/*
 This is a multiline comment
*/
```

To learn more about DATEX Script, check out the [DATEX documentation](https://docs.unyt.org/manual/datex/introduction).


## The app.dx file
The `app.dx` file serves as the main configuration file for a UIX application. It defines essential settings, metadata, and optional features that shape how your app behaves and appears.

### General Options

The following options provide some general information or behavior of the app.

* `name`: *(text)* - The name of the app
* `description`: *(text)* - Short description for the app
* `icon`: *(text or url)* - URL path to an app icon image - can also be a relative path, e.g. `./common/res/icon.png`
* `installable`: *(boolean)* - The app can be installed as standalone web app
* `meta`: *(Record<string,string>)* - Custom `<meta>` tags (name and content) that are added to the HTML head on each page
* `manifest`: *Record<string,any>* - Custom web manifest options that override the defaults set by UIX
* `experimental_features`: *string[]* - List of [experimental UIX features](#experimental-features) that should be enabled

<!--
* `installable`: *(boolean)* - The app can be installed as standalone web app
* `offline_support`: *(boolean)* - Adds a service worker with offline cache
* `expose_deno`: *(boolean)* - Experimental, allows access for the Deno namespace from frontend contexts
-->

### Experimental Features

Experimental features are subject to change and might be enabled by default in future versions of UIX.
To enable specific features, add them to the `experimental_features` list in the `app.dx` file.

Available experimental features:

* `indirect-references`: Sets the `INDIRECT_REFERENCES` flag for the DATEX Runtime, which enables for indirect references to pointers from other pointers.
* `view-transitions`: Enables [CSS view transitions](https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API) for backend navigations and frontend navigations.
<!-- * `"frontend-navigation"`: Enables the new frontend navigation system, which allows for client-side routing without full page reloads.
* `"embedded-reactivity"`: Enables compile-time reactivity features for JSX templates and the `$()` syntax
* `"protect-pointers"`: Sets the `PROTECT_POINTERS` DATEX Runtime flag, which disables pointer read/write access for remote endpoints by default. Backend exports and pointers returned from backend functions are still publicly accessible by all endpoints.
 -->
### Paths

The paths for frontend, backend and common files can be explicitly set in the `app.dx` files.
By default, the frontend path is `./frontend/`, the backend path is `./backend/` and the common path is `./common/`.

* `frontend`: *(url or url[])* - Directory for frontend code
* `backend`:  *(url or url[])* - Directory for backend code
* `common`: *(url or url[])* - Directory with access from both frontend end backend code
* `pages`: *(url or url[])* **experimental!** - Common directory with structural access from both frontend end backend code. File paths are automaticially mapped to app routes.

### Example app.dx configuration
```datex title="app.dx"
name: "My App",
description: "I made a thing",
icon: "https://example.org/icon.ico";
```

## App Deployment Stages

UIX apps can be run in different **stages**. The names of the stages are not predefined and can be set as needed.
(*Exception: The default stage is called 'dev'.*)

To run a UIX app in a specific stage, use the `--stage` options:
```bash
uix --stage production
```

By default configuration, running a UIX app in a different stage has no noticeable effect.

The current stage can be accessed via `app.stage`:
```ts
import { app } from "uix/app/app.ts";
const stage = app.stage // 'production'
```

In `app.dx` files, the `#public.uix.stage` helper function can be used to access the stage, enabling custom [deployment configurations](./15%20Deployment.md).

## The .dx files

`.dx` files can be put in frontend or backend directories.
A `.dx` configuration file in a backend directory is applied to the backend endpoint,
a `.dx` file in a frontend directory is applied to each frontend endpoint.

### Options

By default, a `.dx` config file can contain the following options:
* `endpoint`: (endpoint) The endpoint that should be used for this directory
* `connect`: (boolean) Connect to the supranet on start (default: true)
* `keys`: (Crypto.ExportedKeySet) Set custom private + public keys for this endpoint

Additional options may be passed in for backend endpoints `.dx` configurations (See [Deployment](./15%20Deployment.md)).


### The "stage" helper function

To dynamically set options in the `.dx` configuration file depending on the current [deployment stage](#app-deployment-stages), the `#public.uix.stage` helper function can be used:
```datex title=".dx"
use stage from #public.uix; // import the 'stage' helper function

endpoint: stage {
    dev:        @+my_app_dev,  // selected when running in 'dev' stage
    staging:    @+my_app_stag, // selected when running in 'staging' stage
    prod:       @+my_app_prod  // selected when running in 'prod' stage
}
```
