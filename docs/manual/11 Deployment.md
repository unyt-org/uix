# Deployment
UIX provides options for automatic deployment with optional git integration.

## Backend Endpoint Locations

The *location* of an endpoint describes the actual physical of a backend endpoint in a UIX app.
Per default, the location of a backend endpoint is the device where the UIX app is started.

This default behaviour can be changed by defining a `location` property in the backend `.dx` file.

Besides the default local location, 
there are two other possible endpoint location types:
 * [Remote docker hosts](#remote-docker-hosts)
 * [Local dockers](#local-dockers)

### Remote Docker Hosts

A remote docker host is a special endpoint running on another device (e.g. on a deployment server) that manages
dockers on the device and can communicate with a UIX app to deploy new docker containers.

Unyt.org provides public docker hosts (`@+unyt_eu1`, `@+unyt_eu2`) that can be used to deploy UIX apps under `unyt.app` domains.

If you want to set up you own docker host on your server, take a look at the [Docker Host](https://github.com/unyt-org/docker-host/) documentation.

The following options can be set in a backend `.dx` file to configure a remote docker host.

* `location`: (endpoint or string) A docker host endpoint (e.g. `@+unyt_eu1` or a self-hosted endpoint) where the UIX should be hosted. The default is `@@local`, meaning that the app is run locally and not on a docker host.
* `domain`: *(text or text[])* One or multiple custom domains on which the web server is listening. This only works if the domain is pointing to the ip address of the docker host.
* `volumes`: *(url or url[])* Directories that are mapped to persistent docker volumes on the docker host

**Example:**

```datex
endpoint: @+my_app,
location: @+unyt_eu1,
volumes:  [../data]
```

With this example configuration, every time you start your by running `uix`,
it will get deployed on `@+unyt_eu1`.

To still run the app locally during development and
get a fine-grained control for the behaviour in different stages,
you can use the `stage` helper function from `#public.uix`.
It allows you to select a value for `endpoint`/`location`/`domain` etc.
depending on the current stage.

> [!NOTE]
> The stage of a UIX app execution can be set with the `--stage` argument.
> The default stage is `dev`.

### Example
```datex
use stage from #public.uix;

// set different endpoints for different stages
endpoint: stage {
    dev:        @+my_app_dev,
    staging:    @+my_app_stag,
    prod:       @+my_app_prod
},

// set remote docker host locations for 'staging'
// and 'prod'. The default 'dev' stage has no assigned value 
// and falls back to the default (running locally)
location: stage {
    staging:    @+unyt_eu1,
    prod:       @+unyt_eu2
}
```

> [!NOTE]
> When using remote docker hosts, it is currently required that
> your UIX app is available in a GitHub repository. Make sure
> that all files are committed and all commits pushed.

### Local Dockers

The *local docker* location is similar to the default local location:<br>
The endpoint still runs on the current device, but inside a [docker](https://www.docker.com/) container.

To run a UIX app in a local docker, simply set the following `location` value in the backend `.dx` file:
```
location: 'local-docker'
```

Now, you can start your app like always with the `uix` command.

> [!WARNING]
> Currently, only the following uix command line arguments are supported when running with 'local-docker'
> * `--watch`


## GitHub deployment

The `git_deploy` [plugin](./13%20Plugins.md) can be used in a `app.dx` file to automate app deployment:

```datex
plugin git_deploy (
    // Deploy this app in the 'prod' stage
    // when a push to the main branch occurs
    // The 'MY_SECRET_TOKEN' GitHub secret is passed as an
    // environment variables to the UIX app
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
* `tests`: (boolean) If this option is enabled, [tests](https://github.com/unyt-org/unyt-tests/) for all `*.test.ts`, `*.test.js` and `*.test.dx`
    files in the repository are automatically executed before deployment (enabled per default)

When the git_deploy plugin is defined, GitHub workflow files are automatically generated when the app is run.

