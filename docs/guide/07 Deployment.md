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

Follow these steps to launch your UIX app in minutey.

1. Install Docker on your server:
	
	Follow the [Docker installation guide](https://docs.docker.com/get-started/get-docker/) for your server's operating system.
2. Install the Docker Host Endpoint on your server:

	```bash
	curl -s https://raw.githubusercontent.com/unyt-org/docker-host/master/setup.sh | bash -s @+YOUR_DOCKER_HOST
	```
	Make sure to pass a unique [endpoint id]() to the install script. The setup script will create a docker host instance by installing [Deno](https://github.com/denoland/deno) and creating a persistent service inside of `etc/systemd/system`
