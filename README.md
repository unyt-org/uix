<img alt="UIX - The Fullstack Framework" src="./logos/banner.svg" style="max-width:400px">

## What is UIX?

UIX is a fullstack web framework that allows you to create reactive web apps with restorable and shared state. UIX supports both single- and multi page applications and uses modern web app features.

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

1. [Getting Started](./docs/manual/1%20Getting%20Started.md)
2. [Entrypoints and Routing](./docs/manual/2%20Entrypoints%20and%20Routing.md)
3. [Imports](./docsmanual/3%20Imports.md)
4. [Components](./docs/manual/4%20Components.md)
5. [States](./docs/manual/5%20States.md)
6. [JSX](./docs/manual/6%20JSX.md)
6. [Component Standalone Mode](./docs/manual/7%20Standalone%20Mode.md)

## [Development Guidelines](./DEVELOP.md)