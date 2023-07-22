#!/bin/sh

# curl -s https://cdn.unyt.org/uix/run.sh | sh -s -- --watch --live
# deno run -Aq --import-map=importmap.dev.json https://cdn.unyt.org/uix/run.ts -l
deno run --importmap https://dev.cdn.unyt.org/importmap.json -Aqr https://dev.cdn.unyt.org/uix/run.ts "$@"