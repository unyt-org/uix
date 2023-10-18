# App Configuration

A UIX app can be configured with 2 types of files: An `app.dx` file specifying general options for the
entire app, and individual `.dx` files located in frontend or backend directories that specify options for
the specific endpoints.

## The app.dx file

### General Options

The following options provide some general information or behaviour of the app.

* `name`: *(text)* - The name of the app
* `description`: *(text)* - Short description for the app
* `icon`: *(text or url)* - URL path to an app icon image
<!--
* `installable`: *(boolean)* - The app can be installed as standalone web app
* `offline_support`: *(boolean)* - Adds a service worker with offline cache
* `expose_deno`: *(boolean)* - Experimental, allows access for the Deno namespace from frontend contexts
-->

### Paths

The paths for frontend, backend and shared (common) files can be explicitly set in the `app.dx` files.
Per default, the frontend path is `./frontend/`, the backend path is `./backend/` and the common path is `./common/`.

* `frontend`: *(url or url[])* - Directory for frontend code
* `backend`:  *(url or url[])* - Directory for backend code
* `common`: *(url or url[])* - Directory with access from both frontend end backend code
* `pages`: *(url or url[])* **experimental!** - Common directory with structural access from both frontend end backend code. File paths are automaticially mapped to app routes.

### Example app.dx configuration
```datex
name: "My App",
description: "I made a thing",
icon: "https://example.org/icon.ico",
common: [./lib, ./common]; // multiple common paths
```

## App Deployment Stages

UIX apps can be run in different **stages**. The names of the stages are not predefined and can be set as needed.
(*Exception: The default stage is called 'dev'.*)

To run a UIX app in a specific stage, use the `--stage` options:
```bash
$ uix --stage production
```

## The .dx files

`.dx` files can be put in frontend or backend directories.

### Options

Per default, a .dx file can contain the following options:
* `endpoint`: (endpoint) The endpoint that should be used for this directory

Additional options for backend endpoint may be passed according to the options defined in [Deployment](./11%20Deployment.md).


### The "stage" helper function

To dynamically set options in the `.dx` configuration file depending on the current [deployment stage](#app-deployment-stages),
the `#public.uix.stage` helper function can be used:
```datex
use stage from #public.uix; // import the 'stage' helper function

endpoint: stage {
    dev: 		@+my_app_dev,  // selected when running in 'dev' stage
    staging:	@+my_app_stag, // selected when running in 'staging' stage
    prod: 		@+my_app_prod  // selected when running in 'prod' stage
}
```
