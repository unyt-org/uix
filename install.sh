# Copyright 2023 unyt.org

# URLs
uix_script_url="https://dev.cdn.unyt.org/uix/run.sh"
uix_importmap_url="https://dev.cdn.unyt.org/importmap.json"

# install uix via deno installer
deno install --importmap $uix_importmap_url -Aqr -n uix $uix_script_url