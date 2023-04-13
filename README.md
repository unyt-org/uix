# UIX - Extendable UI Framework based on DATEX

## What is UIX?

With UIX, you can create reactive, responsive web apps with restorable and shared state. UIX supports single- and multi page architectures and uses modern web app features.

There are four main ways to design UIX components and create UIX applications:
 * using the **TypeScript/JavaScript UIX Library** (focus of the documentation)
 * using the **UIX Web Editor** (still in development)
 * writing **HTML** markup
 * defining UIX states with **DATEX**

The whole UIX library is designed with a modular approach
that makes it very easy for developers to add their own custom
components as needed.

## Benefits of the UIX/DATEX ecosystem

In general, a UIX front-end can be integrated seamlessly into complex full-stack applications thanks to DATEX.
If you are developing a unyt-based application, the UIX library is a good choice for a front-end framework
since it is designed to work great in combination with DATEX.
UIX also supports seamless transitions between server- and client-side rendering.
 
UIX Component states, including tabs, open files, cursor positions and more, are synchronized with DATEX pointers and can be restored at any time.

The library also comes with a set of built-in functionalities, like handling drag and drop, context menus, files, and others.
The UIX Standard Library includes a variety of basic components, from simple text views to file trees.

UIX provides a layer of abstraction so that direct DOM manipulation with CSS and HTML is not necessarily required for creating an app with basic Components, but the implementation of more complex Components might still require CSS and HTML.
However, the saved state of a UIX Component should not contain web-specfic content like css attributes or HTML element names, since UIX is also intended to work in non-web environments.


## Documentation

1. [Getting Started](./docs/1_Getting_Started.md)
2. [Entrypoints and Routing](./docs/2_Entrypoints_and_Routing.md)
3. [Imports](./docs/3_Imports.md)
4. [Components](./docs/4_Components.md)
5. [States](./docs/5_States.md)


## How to Develop
The main branch is `develop`. This repository uses a workflow like described [here](https://medium.com/trendyol-tech/semantic-versioning-and-gitlab-6bcd1e07c0b0).
To develop a feature, branch of develop and call the branch `feature/YOUR-NAME`. When finished, go to Gitlab > CI > Pipelines > Run Pipeline > select your branch, add a variable called `DEPLOY_TYPE` and `major` or `minor` as value.
This creates a release branch, and merge request.
When making fixes to a branch (refer to the article), branch off the release branch and do a manual merge request to the branch in question
