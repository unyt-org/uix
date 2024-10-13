# Deployment

Deploying UIX apps is an essential part of taking your project into production, and while the unyt.app infrastructure is a great solution, there are several ways to host your own UIX projects outside of it. This guide will walk you through how to deploy your UIX app on your own server, use a custom domain, and set up your own CI for deployment.

**Note**:
Unlike some frameworks, UIX doesn’t involve a traditional "build" process. UIX projects are designed to run directly using the `uix` command, which makes deployment straightforward. Instead of compiling your project, you’ll be able to directly run it on any machine that has UIX installed.

You can upload your UIX project to your machine using tools like `scp`, serve UIX at a specific port using the `uix`-CLI and configure your backbone infrastructure (such as `Nginx` reverse proxy) to forward incoming HTTP requests to the selected port. *Voilà - your app is live!*

If you don't like to setup all the infrastructure on your own, we recommend deploying apps using the [UIX Docker Host](https://github.com/unyt-org/docker-host) inside containers for better portability and management.

## Deploying UIX with the Docker Host (Recommended)
> [!NOTE]
> Docker Hosts are only support on Linux systems.
> If you experience some issues with your Linux distribution please let us know.

Follow these steps to launch your UIX app in minutey. For more information check out the [Docker Host repository](https://github.com/unyt-org/docker-host/tree/v2).

1. Install Docker on your server:
	
	Follow the [Docker installation guide](https://docs.docker.com/get-started/get-docker/) for your server's operating system.
2. Install the Docker Host Endpoint on your server:

	```bash
	curl -s https://raw.githubusercontent.com/unyt-org/docker-host/main/setup.sh | bash -s @+YOUR_DOCKER_HOST
	```
	Make sure to pass a unique [endpoint id](https://docs.unyt.org/manual/datex/endpoints) to the install script. The setup script will create a Docker Host instance by installing [Deno](https://github.com/denoland/deno) and creating a persistent service inside of `etc/systemd/system`.

	You can check if the installation was successfull using the following command: 
	```bash
	systemctl status unyt_docker_host_HOST_ENDPOINT.service
	```
3. Configure your UIX app to use the Docker Host:

	After setting up the Docker Host on your server, add the host endpoint as location into your UIX apps `backend/.dx` configuration file.

	```datex title="backend/.dx"
	use stage from #public.uix;

	endpoint: stage {
		prod: @+your_app
	},

	location: stage {
		prod: @+YOUR_DOCKER_HOST
	},

	domain: stage {
		prod: 'YOUR-DOMAIN.com'
	}
	```
4. Deploy the UIX app into production on your local machine:

	With the Docker host and `.dx` configured, deploy your app from your local machine by running:
	```bash
	uix --stage prod
	```

	This command will deploy your UIX app to your custom Docker host, making it live on your custom domain.

	> [!WARNING]
	> If the Docker Host you plan to deploy to has a access token configured, you need to pass this access token to UIX to make sure your app can authenticate.<br/>
	> You can set the access token as `HOST_TOKEN` environment variable on your local UIX projects console.
	> ```bash
	> export HOST_TOKEN=YOUR_TOKEN
	> ```


### How does that work?
*Alright. Some technical background on Docker Hosts.*

The Docker Host instance installed as a service on your remote machine will startup a persistent Deno process. The Docker Hosts joins the [Supranet](https://unyt.org/supranet) using the configured endpoint id and exposes a public DATEX interface called `ContainerManager`.

DATEX can then access the interface using following code:

```ts
use ContainerManager from @+YOUR_DOCKER_HOST;

ContainerManager.doWhatever(...)
```

When running the `uix --stage prod` command, UIX's [`run.ts`](https://cdn.unyt.org/uix/run.ts) will check the configured location inside of the `app.dx` config file for the given stage *(`dev` is set as default)*.

If a remote endpoint for the current stage is configured, UIX will call the `createUIXAppContainer()` method of the public `ContainerManager` interface on the remote host.

UIX under the hood does incovates something like following for remote deployment:

```ts
ref container = ContainerManager.createUIXAppContainer(
	$HOST_TOKEN, 		// remote access token
	$projectGitURL, 	// git url of the UIX app 
	$projectBranch, 	// git branch of the UIX app
	@+your_app, 		// endpoint for the prod stage
	"prod", 			// current stage
	["YOUR-DOMAIN.com"] // configured domain
);
```

By calling the `createUIXAppContainer()` method on the Docker Host, the remote deployment is initialized using the passed parameters.

The Docker Host will first verify the access token, clone the git repository and spin up a custom Docker container for the deployed app. To also allow for persistent storage accross deployment tasks, corresponding Docker volumes are generated.

If the Docker Host is configured to handle the reverse proxy tasks, corresponding configuration is added to the Docker image automatically. Using custom `traefik` configurations, the Docker host can map configured domains ([YOUR-DOMAIN.com](https://YOUR-DOMAIN.com)) to the container of the UIX app and therefore allow for HTTP traffic to be handled by the deployed app.