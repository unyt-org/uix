# Run Options
This file contains an auto-generated list of the available command line options.

## DATEX Core
DATEX Runtime for JavaScript/TypeScript.
Visit https://unyt.org/datex for more information


Optional:

 * `--clear`                  Clear all eternal states on the backend
 * `-v, --verbose`            Show logs for all levels, including debug logs
 * `-c, --cache-path`         Overrides the default path for datex cache files (.datex-cache)

## UIX
Fullstack Web Framework with DATEX Integration.
Visit https://unyt.org/uix for more information


Optional:

 * `--path`                   The root path for the UIX app (parent directory for app.dx and deno.json)
 * `-b, --watch-backend`      Restart the backend deno process when backend files are modified
 * `-l, --live`               Automatically reload connected browsers tabs when files are modified and enable automatic backend restarts
 * `-w, --watch`              Recompile frontend scripts when files are modified
 * `--hod, --http-over-datex` Enable HTTP-over-DATEX (default: true)
 * `--datex-cli`              Enable DATEX CLI
 * `--stage`                  Current deployment stage (default: dev)
 * `--env`                    Exposed environment variables (for remote deployment)
 * `-y, --allow-all`          Autmatically confirm all dialogs
 * `-n, --allow-none`         Automatically decline all dialog
 * `--login`                  Show login dialog
 * `--init`                   Inititialize a new UIX project
 * `--template`               Pass a template to the UIX init call to create your project from
 * `--port`                   The port for the HTTP server (default: 80)
 * `--enable-tls`             Enable TLS for the HTTP server
 * `--git-token`              GitHub/GitLab token for running in remote location
 * `--host-token`             Docker Host access token for running in remote location
 * `--clear`                  Clear all eternal states on the backend
 * `--transpile-cache-path`   Path to store transpiled file persistently
 * `-r, --reload`             Reload dependency caches
 * `--version`                Get the version of your UIX installation
 * `--import-map`             Import map path
 * `--inspect`                Enable debugging for the deno process
 * `--unstable`               Enable unstable deno features
 * `-d, --detach`             Keep the app running in background

## Other Options

Optional:

 * `-h, --help`               Show the help page