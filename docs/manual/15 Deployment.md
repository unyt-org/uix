# Deployment
UIX provides options for automated deployment with optional `git` integration.

## Backend Endpoint Locations

The *location* of an endpoint describes the actual physical of a backend endpoint in a UIX app.
Per default, the location of a backend endpoint is the device where the UIX app is started.

This default behavior can be changed by defining a `location` property in the backend `.dx` file.

Besides the default local location, 
there are two other possible endpoint location types:
 * [Remote Docker hosts](#remote-docker-hosts)
 * [Local Dockers](#local-dockers)

### Remote Docker Hosts

A remote Docker host is a special endpoint running on another device (e.g. on a deployment server) that manages Dockers on the device and can communicate with a UIX app to deploy new Docker containers.

The unyt.org entity provides public Docker hosts (`@+app-host-eu2`) that can be used to deploy UIX apps under the `unyt.app` domain.

If you want to set up you own Docker host on your machine, take a look at the [Docker Host](https://github.com/unyt-org/docker-host/) documentation.

The following options can be set in the backend `.dx` file to configure a remote Docker host to be used.

* `location`: *(endpoint or text)* A Docker host endpoint (e.g. `@+app-host-eu2` or a self-hosted endpoint) where the UIX should be hosted. The default is `@@local`, meaning that the app is run locally and not on a Docker host.
* `domain`: *(text or text[])* One or multiple custom domains on which the web server is listening. This only works if the domain is pointing to the ip address of the Docker host. The domain name may include characters `a-z`, digits `0-9`, hypens, and dots as separator if part of a subdomain and must not start with a hypen.
* `volumes`: *(url or url[])* Directories that are mapped to persistent Docker volumes on the Docker host


#### Inspecting UIX apps remote docker hosts

You can start a UIX app with `--inspect` to debug the app it is running on a remote Docker host.
To access the inspect port, you must have `ssh` access to the Docker host server and run the following command to map the server inspect port to a port on your local device:

```bash
ssh -L 127.0.0.1:9229:127.0.0.1:9229 YOUR_USERNAME@YOUR_SERVER_DOMAIN
```

**Example:**

```datex title="backend/.dx"
endpoint: @+my_app,
location: @+app-host-eu2,
volumes:  [../data]
```

With this example configuration, every time you start your app by running `uix`, it will get deployed on `@+app-host-eu2`.

In order to run the application locally during development and get fine-grained control for the behavior in different stages, you can use the `stage` helper function from `#public.uix`.
It allows you to select a value for `endpoint`/`location`/`domain` etc. depending on the current stage.

> [!NOTE]
> The stage of a UIX app execution can be set with the `--stage` argument.
> The default stage is `dev`.

### Example
```datex title="backend/.dx"
use stage from #public.uix;

// set different endpoints for different stages
endpoint: stage {
    dev:        @+my_app_dev,
    staging:    @+my_app_stag,
    prod:       @+my_app_prod
},

// set remote Docker host locations for 'staging'
// and 'prod'. The default 'dev' stage has no assigned value 
// and falls back to the default (running locally)
location: stage {
    staging:    @+app-host-eu1,
    prod:       @+app-host-eu2
}
```

> [!NOTE]
> When using remote Docker hosts, it is currently required that
> your UIX app is available in a GitHub repository. Make sure
> that all files are committed and all commits are pushed.

### Local Dockers

The *local Docker* location is similar to the default local location:<br>
The endpoint still runs on the current device, but inside a [Docker](https://www.docker.com/) container.

To run a UIX app in a local Docker, simply set the following `location` value in the backend `.dx` file:
```
location: 'local-docker'
```

Now, you can start your app like always with the `uix` command.

> [!WARNING]
> Currently, only the following uix command line arguments are supported when running with 'local-docker'
> * `--watch`
> * `--inspect`
> * `--verbose`
> * `--clear`


## GitHub deployment

The `git_deploy` [plugin](./17%20Plugins.md) can be used in a `app.dx` file to automate app deployment:

```datex title="app.dx"
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

* `branch`: (text or text[]) One or more branches on which the deployment is triggered
* `on`: (text or text[]) GitHub event name that triggers the deployment
* `secrets` (text or text[]) List of GitHub secrets that are exposed to the app as environment variables
* `tests`: (boolean) If this option is enabled, [tests](https://github.com/unyt-org/unyt-tests/) for all `*.test.ts`, `*.test.js` and `*.test.dx`
    files in the repository are automatically executed before deployment (enabled per default)

When the git_deploy plugin is defined, GitHub workflow files are automatically generated when the app is run.

