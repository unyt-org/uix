# Deployment
UIX provides options for automatic deployment with git integration.

## Docker host
**TODO** add chapter

### Options
* `location`: (endpoint) A [docker host](https://github.com/unyt-org/docker-host/) endpoint (e.g. `@+unyt_eu1` or a self-hosted endpoint) where the UIX should be hosted. The default is `@@local`, meaning that the app is run locally and not on a docker host.
* `domain`: *(text or text[])* One or multiple custom domains on which the web server is listening. This only works if the location is set to a docker host and the domain is pointing to the ip address of the docker host.
* `volumes`: *(url or url[])* Directories that are mapped to persistent docker volumes when running on a docker host

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


## GitHub deployment

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
