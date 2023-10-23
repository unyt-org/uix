<img alt="UIX - The Fullstack Framework" src="./src/logos/banner.svg" style="max-width:400px">

[uix.unyt.org](https://uix.unyt.org) &nbsp;&nbsp;&nbsp;•&nbsp;&nbsp;&nbsp; a unyt.org project 

--------------------------

## What is UIX?

UIX is an open-source full-stack framework for developing reactive web apps with *restorable and shared state*.
UIX runs on a [deno](https://docs.deno.com/runtime/manual) backend and 
supports both *single- and multi page* applications 
with frontend or server-side rendering and hydration.


The [DATEX JavaScript Library](https://docs.unyt.org/manual/datex/introduction) acts as the backbone of UIX, providing useful functionality such as *reactivity and cross-device data exchange*.
In contrast to frameworks like React, UIX provides *direct wiring* to the DOM for reactivity and does not need a virtual DOM.

There are many ways to create UIX applications:
 * using the **TypeScript UIX Library** and JSX (focus of the documentation)
 * defining UIX states with **DATEX**
 * using the **UIX Web Editor** (still in development)

The UIX library is designed with  a modular approach that makes it easy for developers to add custom components and logic as needed.


**Main features**
 * [Cross-network reactivity](./docs/manual/02%20Imports%20and%20Synchronization.md#Reactivity)
 * [Server side rendering with partial hydration](./docs/manual/07%20Rendering%20Methods.md)
 * [Hybrid backend/frontend routing](./docs/manual/05%20Entrypoints%20and%20Routing.md)
 * [Cross-realm imports](./docs/manual/02%20Imports%20and%20Synchronization.md)
 * [Shared memory](./docs/manual/02%20Imports%20and%20Synchronization.md#Synchronization)
 * [JSX support](./docs/manual/03%20JSX.md)
 * [Reusable web components](./docs/manual/04%20Components.md)
 * [SCSS support](./docs/manual/14%20Style%20and%20Theme.md#SCSS)
 * [And many more](https://uix.unyt.org)...

UIX aims to simplify all phases of the app development cycle, including design, development, testing and distribution, in order to make the developer experience as convenient as possible. 
This is why UIX ships with integrated features such as:
 * Hot reloading
 * [Testing library](https://github.com/unyt-org/unyt-tests/)
 * [Stage management](./docs/manual/08%20Configuration.md#app-deployment-stages)
 * Version management
 * [Automated deployment](./docs/manual/11%20Deployment.md)

## Documentation

> [!NOTE]
> You can find all [UIX](https://uix.unyt.org) documentation and resources on [docs.unyt.org](https://docs.unyt.org).
> Please be aware that the documentation is work in progress and may change in the future.

1. [Getting Started](./docs/manual/01%20Getting%20Started.md)
2. [Imports](./docs/manual/02%20Imports%20and%20Synchronization.md)
3. [JSX](./docs/manual/03%20JSX.md)
4. [Components](./docs/manual/04%20Components.md)
5. [Entrypoints and Routing](./docs/manual/05%20Entrypoints%20and%20Routing.md)
6. [Component States](./docs/manual/06%20Component%20States.md)
7. [Rendering Methods](./docs/manual/07%20Rendering%20Methods.md)
8. [Configuration](./docs/manual/08%20Configuration.md)
9. [Localization](./docs/manual/09%20Localization.md)
10. [Functions and Contexts](./docs/manual/10%20Functions%20and%20Contexts.md)
11. [Deployment](./docs/manual/11%20Deployment.md)
12. [HTTP Tunneling](./docs/manual/12%20HTTP%20Tunneling.md)
13. [Plugins](./docs/manual/13%20Plugins.md)

## Examples
Feel free to browse a collection of UIX projects on [uix.unyt.org/templates](https://uix.unyt.org/templates).
* [UIX Base Project](https://github.com/unyt-org/uix-base-project)
* [UIX Base Project + Routing](https://github.com/unyt-org/uix-base-project-routing)
* [UIX Base Project + Login](https://github.com/unyt-org/uix-login-project)
* [Localization](https://github.com/unyt-org/example-localization)
* [Simple Messenger](https://github.com/unyt-org/example-simple-messenger)
* [Shopping List](https://github.com/unyt-org/example-shared-list)
* [Website Screenshot Tool](https://github.com/unyt-org/example-website-screenshot)
* [Tic-Tac-Toe](https://github.com/unyt-org/example-tic-tac-toe)
* [Weather App](https://github.com/unyt-org/example-weather-app)
* [Artwall](https://github.com/unyt-org/example-artwall)

## Browsers support

| [<img src="https://raw.githubusercontent.com/alrra/browser-logos/master/src/chrome/chrome_48x48.png" alt="Chrome" width="24px" height="24px" />](http://gotbahn.github.io/browsers-support-badges/)</br>Chrome | [<img src="https://raw.githubusercontent.com/alrra/browser-logos/master/src/edge/edge_48x48.png" alt="Edge" width="24px" height="24px" />](http://gotbahn.github.io/browsers-support-badges/)</br>Edge | [<img src="https://raw.githubusercontent.com/alrra/browser-logos/master/src/firefox/firefox_48x48.png" alt="Firefox" width="24px" height="24px" />](http://gotbahn.github.io/browsers-support-badges/)</br>Firefox | [<img src="https://raw.githubusercontent.com/alrra/browser-logos/master/src/safari/safari_48x48.png" alt="Safari" width="24px" height="24px" />](http://gotbahn.github.io/browsers-support-badges/)</br>Safari | [<img src="https://raw.githubusercontent.com/alrra/browser-logos/master/src/safari-ios/safari-ios_48x48.png" alt="iOS Safari" width="24px" height="24px" />](http://gotbahn.github.io/browsers-support-badges/)</br>iOS Safari | [<img src="https://raw.githubusercontent.com/alrra/browser-logos/master/src/samsung-internet/samsung-internet_48x48.png" alt="Samsung" width="24px" height="24px" />](http://gotbahn.github.io/browsers-support-badges/)</br>Samsung | [<img src="https://raw.githubusercontent.com/alrra/browser-logos/master/src/opera/opera_48x48.png" alt="Opera" width="24px" height="24px" />](http://gotbahn.github.io/browsers-support-badges/)</br>Opera |
| --------- | --------- | --------- | --------- | --------- | --------- | --------- |
| Chrome 94+ | Edge 104+ | Firefox 94+ | Safari 15.5+ | Safari 16+ | *unknown* | *unknown*

## UIX DOM

The UIX full-stack framework is built on top of [UIX DOM](https://github.com/unyt-org/uix-dom),
a standalone library that allows you to define reactive DOM elements on the frontend and backend.

The full-stack UIX framework provides many more features, but if you just need a basic reactive DOM library,
you can take a look at UIX DOM.

## Contributing

We welcome every contribution!<br>
Please take a look at the [development guidelines](./DEVELOP.md) and the unyt.org [contribution guidlines](https://github.com/unyt-org/.github-private/blob/main/CONTRIBUTING.md).

## Connect with us

![https://unyt.org/discord](https://dcbadge.vercel.app/api/server/qJwsRRqezy)

**Check out our [Blog](https://unyt.blog)!**

---

<sub>&copy; unyt 2023 • [unyt.org](https://unyt.org)</sub>
