#!/bin/sh

# curl -s https://cdn.unyt.org/uix/run.sh | sh -s -- --watch --live
# deno run -Aq --import-map=importmap.dev.json https://cdn.unyt.org/uix/run.ts -l

if ! [ -x "$(command -v git)" ]; then
	echo 'Installing deno...'
	curl -fsSL https://deno.land/x/install/install.sh | sh
	deno upgrade --version 1.21.3
fi

deno run --importmap https://dev.cdn.unyt.org/importmap.json -Aqr https://dev.cdn.unyt.org/uix/run.ts "$@"