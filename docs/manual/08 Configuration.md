# App Configuration

A UIX app can be configured with 2 types of files: An `app.dx` file specifying general options for the
entire app, and individual `.dx` files located in frontend or backend directories that specify options for
the specific endpoints.

## The app.dx file

### General Options

The following options provide some general information or behaviour of the app.

* `name`: (text) The name of the app
* `description`: (text) Short description for the app
* `icon_path`: (text or url) URL path to an app icon image
* `installable`: (boolean) The app can be installed as standalone web app
* `offline_support`: (boolean) Adds a service worker with offline cache
* `expose_deno`: (boolean) Experimental, allows access for the Deno namespace from frontend contexts
    
### Paths

The paths for frontend, backend and shared (common) files can be explicitly set in the `app.dx` files.
Per default, the frontend path is `./frontend/`, the backend path is `./backend/` and the common path is `./common/`.

* `frontend`: (url or url[]) Directory for frontend code
* `backend`:  (url or url[]) Directory for backend code
* `common`: (url or url[]) Directory with access from both frontend end backend code
* `pages`: (url or url[]) Common directory with access from both frontend end backend code - gets mapped per default with a UIX.PageProvider for all frontends and backends without a entrypoint

### Deployment (git_deploy Plugin)

The `git_deploy` DATEX plugin can be used in the `app.dx` file to automate app deployment:

```datex
plugin git_deploy (
    // deployment for 'prod' stage
    prod: {
        branch: 'main',
        on: 'push',
        secrets: ['MY_SECRET_TOKEN']
    }
)
```

The `git_deploy` plugin takes an object where the keys are the [stage names](#app-deployment-stages) and the values are an object with the following options:
* `branch`: (text or text[]) On or more branches on which the deployment is triggered
* `on`: (text or text[]) GitHub event name that triggers the deployment
* `secrets` (text or text[]) List of GitHub secrets that are exposed to the app as environment variables
* `tests`: (boolean) Should run [tests](https://github.com/unyt-org/unyt-tests) before deploying the app - default is true

When the git_deploy plugin is defined, GitHub workflow files are automatically generated when the app is run.

### Example app.dx configuration
```datex
name: "My App",
description: "I made a thing",
installable: true,
offline_support: true,

common: [./lib, ./common]; // multiple common paths

plugin git_deploy (
    staging: {
        branch: 'main',
        on: 'push'
    }
)
```
## App Deployment Stages

UIX apps can be run in different **stages**. The names of the stages are not predefined and can be set as needed.
(*Exception: The default stage is called 'dev'.*)

To run a UIX app in a specific stage, use the `--stage` options:
```bash
uix --stage production
```

## The .dx files

`.dx` files can be put in frontend or backend directories.

### Default Options

Per default, they can contain the following options:
* `endpoint`: (endpoint) The endpoint that should be used for this directory

### Additional Options for backend endpoints
* `location`: (endpoint) A [docker host](https://github.com/unyt-org/docker-host/) endpoint (e.g. `@+unyt_eu1` or a self-hosted endpoint) where the UIX should be hosted. The default is `@@local`, meaning that the app is run locally and not on a docker host.
* `domain`: (text or text[]) One or multiple custom domains on which the web server is listening. This only works if the location is set to a docker host and the domain is pointing to the ip address of the docker host.
* `volumes`: (url or url[]) Directories that are mapped to persistent docker volumes when running on a docker host

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

### Example
```datex
use stage from #public.uix;

endpoint: stage {
    dev: 		@+my_app_dev,
    staging:	@+my_app_stag,
    prod: 		@+my_app_prod
},

location: stage {
    staging: 	@+unyt_eu1,
    prod: 		@+unyt_eu2
},

domain: stage {
    staging:  ['staging.example.io'],
    prod:     ['example.io']
},

volumes: [../data]
```
