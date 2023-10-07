<img alt="UIX - The Fullstack Framework" src="./logos/banner.svg" style="max-width:400px">

## What is UIX?

UIX is a fullstack web framework that allows you to create reactive web apps with restorable and shared state.
UIX supports both single- and multi page applications with frontend or server-side rendering and uses modern web app features.

There are four main ways to design UIX components and create UIX applications:
 * using the **TypeScript UIX Library** and JSX (focus of the documentation)
 * using the **UIX Web Editor** (still in development)
 * writing **HTML** markup
 * defining UIX states with **DATEX**

The whole UIX library is designed with a modular approach
that makes it very easy for developers to add their own custom
components as needed.

UIX Homepage: [uix.unyt.org](https://uix.unyt.org)

## Benefits of the UIX/DATEX ecosystem

In general, a UIX front-end can be integrated seamlessly into complex full-stack applications thanks to DATEX.
If you are developing a unyt.org-based application, the UIX library is a good choice for a front-end framework
since it is designed to work great in combination with DATEX.
UIX also supports seamless transitions between server- and client-side rendering.
 
UIX Component states, including tabs, open files, cursor positions and more, are synchronized with DATEX pointers and can be restored at any time.

The library also comes with a set of built-in functionalities, like handling drag and drop, context menus, files, and others.
The UIX Standard Library includes a variety of basic components, from simple text views to file trees.

UIX provides a layer of abstraction so that direct DOM manipulation with CSS and HTML is not necessarily required for creating an app with basic Components, but the implementation of more complex Components might still require CSS and HTML.
However, the saved state of a UIX Component should not contain web-specfic content like css attributes or HTML element names, since UIX is also intended to work in non-web environments.


## Documentation

1. [Getting Started](./docs/manual/1%20Getting%20Started.md)
2. [Imports](./docs/manual/2%20Imports.md)
3. [JSX](./docs/manual/3%20JSX.md)
4. [Components](./docs/manual/4%20Components.md)
5. [Entrypoints and Routing](./docs/manual/5%20Entrypoints%20and%20Routing.md)
6. [States](./docs/manual/6%20States.md)
7. [Standalone Mode](./docs/manual/7%20Standalone%20Mode.md)
8. [Configuration](./docs/manual/8%20Configuration.md)
8. [Localization](./docs/manual/9%20Localization.md)

## [Development Guidelines](./DEVELOP.md)


## UIX-DOM

The UIX fullstack framework is built ontop of [UIX-DOM](https://github.com/unyt-org/uix-dom),
a standalone library that allows you to define reactive DOM elements on the frontend and backend.

The fullstack UIX framework provides many more features, but if you just need a basic reactive DOM library,
you can take a look at UIX-DOM.