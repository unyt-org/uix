#!/bin/sh

# curl -s https://cdn.unyt.org/uix@dev/run.sh | sh -s -- --watch --live
# deno run --allow-all --no-check --unstable -q --import-map=importmap.dev.json https://cdn.unyt.org/uix@dev/run.ts --watch --live

if ! [ -x "$(command -v git)" ]; then
	echo 'Installing deno...'
	curl -fsSL https://deno.land/x/install/install.sh | sh
	deno upgrade --version 1.21.3
fi

deno run --allow-all --no-check -q https://cdn.unyt.org/uix/run.ts "$@"