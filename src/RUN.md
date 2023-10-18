# Run Options
This file contains an auto-generated list of the available command line options.

## DATEX Core
DATEX Runtime for JavaScript/TypeScript.
Visit https://unyt.org/datex for more information


Optional:

 * `-v, --verbose`            Show logs for all levels, including debug logs
 * `-c, --cache-path`         Overrides the default path for datex cache files (.datex-cache)

## UIX
Fullstack Web Framework with DATEX Integration.
Visit https://unyt.org/uix for more information


Optional:

 * `--path`                   The root path for the UIX app (parent directory for app.dx and deno.json)
 * `-b, --watch-backend`      Restart the backend deno process when backend files are modified
 * `-l, --live`               Automatically reload connected browsers tabs when files are modified
 * `-w, --watch`              Recompile frontend scripts when files are modified
 * `--hod, --http-over-datex` Enable HTTP-over-DATEX (default: true)
 * `--stage`                  Current deployment stage (default: dev)
 * `--env`                    Exposed environment variables (for remote deployment)
 * `--login`                  Show login dialog
 * `-p, --port`               The port for the HTTP server (default: 80)
 * `--enable-tls`             Enable TLS for the HTTP server
 * `--clear`                  Clear all eternal states on the backend
 * `--version`                Get the version of your UIX installation
 * `--import-map`             Import map path
 * `-r, --reload`             Force reload deno caches
 * `--inspect`                Enable debugging for the deno process
 * `--unstable`               Enable unstable deno features
 * `-d, --detach`             Keep the app running in background

## Other Options

Optional:

 * `-h, --help`               Show the help page