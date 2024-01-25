#!/bin/sh

# URLs
uix_script_url="https://cdn.unyt.org/uix/run.ts"
uix_importmap_url="https://cdn.unyt.org/uix/importmap.json"
deno_config_url="https://dev.cdn.unyt.org/deno.json"

# install uix via deno installer
deno run --import-map $uix_importmap_url --config $deno_config_url -Aq $uix_script_url "$@"