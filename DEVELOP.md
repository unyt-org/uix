# Development Guidelines

## Using the local development UIX library in other projects

You can test your local UIX library in UIX apps on the same host:
 1. Expose the local UIX library on `localhost:4242` by running `deno task expose-uix`
 2. Copy the `importmap.uixdev.json` from the uix repo to your project repo and set the `importMap` in the projects `deno.json` to link to this file
 3. Launch your app with `uix -l` (or `deno run --import-map importmap.uixdev.json -Aqr http://localhost:4242/run.ts -wr`)

## Updating the RUN.md files (uix --help)

When new command line arguments are added or updated, run 
```bash
deno run -A run.ts --generate-help
```
once to update the `RUN.md` file.
This file is used for `uix --help` (See https://github.com/unyt-org/command-line-args for more information)

## Git feature branches
The main branch is `uix-new`. This repository uses [semantic versioning](https://medium.com/trendyol-tech/semantic-versioning-and-gitlab-6bcd1e07c0b0).

To develop a feature, create a feature branch named `feature/FEATURE-NAME`, work on the branch and create a pull request when finished.