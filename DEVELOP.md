# Development Guidelines

## Adding and testing new components

 1. Add a new module in the `components/` directory that exports the component class or function with the same name as the module file
 2. Test the new component by adding an example instance to the testComponents object in `common/testComponents.tsx`
 4. Expose the local UIX library on `localhost:4200` by running `deno task expose-uix`
 3. Start the test app on `localhost:4201` with `deno task run-test-app` from the root directory

## Using the local development UIX library in other projects

You can test your local UIX library in UIX apps on the same host:
 1. Expose the local UIX library on `localhost:4200` by running `deno task expose-uix`
 2. Launch your app with `uix --import-map http://localhost:4200/importmap.uixdev.json`


## Git feature branches
The main branch is `develop`. This repository uses [semantic versioning](https://medium.com/trendyol-tech/semantic-versioning-and-gitlab-6bcd1e07c0b0).

To develop a feature, branch of develop and call the branch `feature/YOUR-NAME`. When finished, go to Gitlab > CI > Pipelines > Run Pipeline > select your branch, add a variable called `DEPLOY_TYPE` and `major` or `minor` as value.
This creates a release branch, and merge request.
When making fixes to a branch (refer to the article), branch off the release branch and do a manual merge request to the branch in question