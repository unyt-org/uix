<img alt="UIX - The Fullstack Framework" src="./logos/banner.svg" style="max-width:400px">

## What is UIX?

UIX is a fullstack web framework that allows you to create reactive web apps with *restorable and shared state*.
UIX supports both *single- and multi page* applications with frontend or server-side rendering and uses modern web app features.
In contrast to frameworks like React, UIX provides *direct wiring* to the DOM for reactivity and does not need a virtual DOM.

There are four main ways to design UIX components and create UIX applications:
 * using the **TypeScript UIX Library** and JSX (focus of the documentation)
 * defining UIX states with **DATEX**
 * using the **UIX Web Editor** (still in development)

The whole UIX library is designed with a modular approach
that makes it very easy for developers to add their own custom
components as needed.

UIX Homepage: [uix.unyt.org](https://uix.unyt.org)


## Documentation

1. [Getting Started](./docs/manual/01%20Getting%20Started.md)
2. [Imports](./docs/manual/02%20Imports.md)
3. [JSX](./docs/manual/03%20JSX.md)
4. [Components](./docs/manual/04%20Components.md)
5. [Entrypoints and Routing](./docs/manual/05%20Entrypoints%20and%20Routing.md)
6. [States](./docs/manual/06%20States.md)
7. [Standalone Mode](./docs/manual/07%20Standalone%20Mode.md)
8. [Configuration](./docs/manual/08%20Configuration.md)
8. [Localization](./docs/manual/09%20Localization.md)


## UIX DOM

The UIX full-stack framework is built on top of [UIX DOM](https://github.com/unyt-org/uix-dom),
a standalone library that allows you to define reactive DOM elements on the frontend and backend.

The full-stack UIX framework provides many more features, but if you just need a basic reactive DOM library,
you can take a look at UIX DOM.

## Contribute

Please take a look at the [Development Guidelines](./DEVELOP.md)
