# Development Guidelines

## Adding and testing new components

 1. Add a new module in the `components/` directory that exports the component class or function with the same name as the module file
 2. Test the new component by adding an example instance to the testComponents object in `common/test-components.tsx`
 4. Expose the local UIX library on `localhost:4242` by running `deno task expose-uix`
 3. Start the test app on `localhost:4201` with `deno task run-test-app` from the root directory

## Updating the RUN.md files (uix --help)

When new command line arguments are added or updated, run 
```bash
deno run -A run.ts --generate-help
```
once to update the `RUN.md` file.
This file is used for `uix --help` (See https://github.com/unyt-org/command-line-args for more information)

## Using the local development UIX library in other projects

You can test your local UIX library in UIX apps on the same host:
 1. Expose the local UIX library on `localhost:4242` by running `deno task expose-uix`
 2. Copy the `importmap.uixdev.json` from the uix repo to your project repo
 2. Launch your app with `deno run -Aqr http://localhost:4242/run.ts -wr --import-map importmap.uixdev.json`


## Git feature branches
The main branch is `develop`. This repository uses [semantic versioning](https://medium.com/trendyol-tech/semantic-versioning-and-gitlab-6bcd1e07c0b0).

To develop a feature, branch of develop and call the branch `feature/YOUR-NAME`. When finished, go to Gitlab > CI > Pipelines > Run Pipeline > select your branch, add a variable called `DEPLOY_TYPE` and `major` or `minor` as value.
This creates a release branch, and merge request.
When making fixes to a branch (refer to the article), branch off the release branch and do a manual merge request to the branch in question