# Copyright 2023 unyt.org

# URLs
uix_script_url="https://cdn.unyt.org/uix/run.ts"
uix_importmap_url="https://cdn.unyt.org/uix/importmap.json"

# install uix via deno installer
deno install --import-map $uix_importmap_url -Aqr -n uix $uix_script_url

# deno install --import-map https://dev.cdn.unyt.org/uix1/importmap.dev.json -Aqr -n uix1 https://dev.cdn.unyt.org/uix1/run.ts