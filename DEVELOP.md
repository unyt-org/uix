# Development Guidelines

## Testing new UIX Components and other functionality
You can update the test-app to test new Components and functionality (read the [README](./test-app/README.md) for more information).
The test app can be launched with `deno task test-app` from the root directory.

## Gitlab (Internal)
The main branch is `develop`. This repository uses a workflow like described [here](https://medium.com/trendyol-tech/semantic-versioning-and-gitlab-6bcd1e07c0b0).
To develop a feature, branch of develop and call the branch `feature/YOUR-NAME`. When finished, go to Gitlab > CI > Pipelines > Run Pipeline > select your branch, add a variable called `DEPLOY_TYPE` and `major` or `minor` as value.
This creates a release branch, and merge request.
When making fixes to a branch (refer to the article), branch off the release branch and do a manual merge request to the branch in question