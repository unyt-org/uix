# URLs
uix_script_url="https://cdn.unyt.org/uix/run.ts"
uix_importmap_url="https://cdn.unyt.org/uix/importmap.json"

# install uix via deno installer
deno install --import-map $uix_importmap_url -Aqr -n uix $uix_script_url