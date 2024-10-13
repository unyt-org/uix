<img alt="UIX - The Fullstack Framework" src="./src/logos/banner.svg" style="max-width:400px">

[uix.unyt.org](https://uix.unyt.org) &nbsp;&nbsp;&nbsp;•&nbsp;&nbsp;&nbsp; a unyt.org project 

--------------------------

## What is UIX?

UIX is an open-source full-stack framework for developing reactive web apps with *restorable and shared state*.
UIX runs on a [deno](https://docs.deno.com/runtime/manual) backend and 
supports both *single- and multi page* applications with frontend or server-side rendering and hydration.


The [DATEX JavaScript Library](https://docs.unyt.org/manual/datex/introduction) acts as the backbone of UIX, providing useful functionality such as *reactivity and cross-device data exchange*.
In contrast to frameworks like React, UIX provides *direct wiring* to the DOM for reactivity and does not need a virtual DOM.

There are many ways to create UIX applications:
 * using the **TypeScript UIX Library** and JSX (focus of the documentation)
 * defining UIX states with **DATEX**
 * using the **UIX Web Editor** (still in development)

The UIX library is designed with  a modular approach that makes it easy for developers to add custom components and logic as needed.


**Main features**
 * [Cross-network reactivity](./docs/manual/02%20Cross-Realm%20Imports.md#Reactivity)
 * [Server side rendering with partial hydration](./docs/manual/08%20Rendering%20Methods.md)
 * [Hybrid backend/frontend routing](./docs/manual/05%20Entrypoints%20and%20Routing.md)
 * [Cross-realm imports](./docs/manual/02%20Cross-Realm%20Imports.md)
 * [Shared memory](./docs/manual/02%20Cross-Realm%20Imports.md#Synchronization)
 * [JSX support](./docs/manual/03%20JSX.md)
 * [Reusable web components](./docs/manual/04%20Components.md)
 * [And many more](https://uix.unyt.org)...

UIX aims to simplify all phases of the app development cycle, including design, development, testing and distribution, in order to make the developer experience as convenient as possible. 
This is why UIX ships with integrated features such as:
 * [Testing library](https://github.com/unyt-org/unyt-tests/)
 * [Stage management](./docs/manual/09%20Configuration.md#app-deployment-stages)
 * [Automated deployment](./docs/manual/15%20Deployment.md)
 * Version management
 * Hot reloading

## Documentation

> [!NOTE]
> You can find all [UIX](https://uix.unyt.org) documentation and resources on [docs.unyt.org](https://docs.unyt.org).
> Please be aware that the documentation is work in progress and may change in the future.

1. [Getting Started](./docs/manual/01%20Getting%20Started.md)
2. [Imports](./docs/manual/02%20Cross-Realm%20Imports.md)
3. [JSX](./docs/manual/03%20JSX.md)
4. [Components](./docs/manual/04%20Components.md)
5. [Entrypoints and Routing](./docs/manual/05%20Entrypoints%20and%20Routing.md)
6. [Component States](./docs/manual/06%20Component%20States.md)
7. [Persistent Contexts](./docs/manual/07%20Persistent%20Contexts.md)
8. [Rendering Methods](./docs/manual/08%20Rendering%20Methods.md)
9. [Configuration](./docs/manual/09%20Configuration.md)
10. [Localization](./docs/manual/10%20Localization.md)
11. [Functions and Contexts](./docs/manual/11%20Functions%20and%20Contexts.md)
12. [Styles and Themes](./docs/manual/12%20Styles%20and%20Themes.md)
13. [Shadow DOM](./docs/manual/13%20Shadow%20DOM.md)
14. [Utility Functions](./docs/manual/14%20Utility%20Functions.md)
15. [Deployment](./docs/manual/15%20Deployment.md)
16. [HTTP Tunneling](./docs/manual/16%20HTTP%20Tunneling.md)
17. [Plugins](./docs/manual/17%20Plugins.md)
18. [Rendering](./docs/manual/18%20Rendering.md)
19. [App Communication](./docs/manual/19%20App%20Communication.md)

## Templates and Examples
Feel free to browse a collection of UIX projects on [uix.unyt.org/templates](https://uix.unyt.org/templates).
* [Template Hello UIX](https://github.com/unyt-org/uix-template-hello-uix)
* [Template Base](https://github.com/unyt-org/uix-template-base)
* [Template Routing](https://github.com/unyt-org/uix-template-routing)
* [Template Deployment](https://github.com/unyt-org/uix-template-deployment)
---
* [Example Localization](https://github.com/unyt-org/example-localization)
* [Example Simple Messenger](https://github.com/unyt-org/example-simple-messenger)
* [Example Shopping List](https://github.com/unyt-org/example-shared-list)
* [Example Website Screenshot Tool](https://github.com/unyt-org/example-website-screenshot)
* [Example Tic-Tac-Toe](https://github.com/unyt-org/example-tic-tac-toe)
* [Example Weather App](https://github.com/unyt-org/example-weather-app)
* [Example Artwall](https://github.com/unyt-org/example-artwall)
* [Example Video Call](https://github.com/unyt-org/example-video-call)

## Browsers support
*Certain features of UIX are also supported in legacy browser versions. The following overview is for general guidance in order to show the major browsers and their minimum version number required to use **all** of UIX's features.*

| [<img src="https://raw.githubusercontent.com/alrra/browser-logos/master/src/chrome/chrome_48x48.png" alt="Chrome" width="24px" height="24px" />](http://gotbahn.github.io/browsers-support-badges/)</br>Chrome | [<img src="https://raw.githubusercontent.com/alrra/browser-logos/master/src/edge/edge_48x48.png" alt="Edge" width="24px" height="24px" />](http://gotbahn.github.io/browsers-support-badges/)</br>Edge | [<img src="https://raw.githubusercontent.com/alrra/browser-logos/master/src/firefox/firefox_48x48.png" alt="Firefox" width="24px" height="24px" />](http://gotbahn.github.io/browsers-support-badges/)</br>Firefox | [<img src="https://raw.githubusercontent.com/alrra/browser-logos/master/src/safari/safari_48x48.png" alt="Safari" width="24px" height="24px" />](http://gotbahn.github.io/browsers-support-badges/)</br>Safari | [<img src="https://raw.githubusercontent.com/alrra/browser-logos/master/src/safari-ios/safari-ios_48x48.png" alt="iOS Safari" width="24px" height="24px" />](http://gotbahn.github.io/browsers-support-badges/)</br>iOS Safari | [<img src="https://raw.githubusercontent.com/alrra/browser-logos/master/src/samsung-internet/samsung-internet_48x48.png" alt="Samsung" width="24px" height="24px" />](http://gotbahn.github.io/browsers-support-badges/)</br>Samsung | [<img src="https://raw.githubusercontent.com/alrra/browser-logos/master/src/opera/opera_48x48.png" alt="Opera" width="24px" height="24px" />](http://gotbahn.github.io/browsers-support-badges/)</br>Opera |
| --------- | --------- | --------- | --------- | --------- | --------- | --------- |
| Chrome 120+ | Edge 120+ | Firefox 117+ | Safari 17.5+ | Safari 17.5+ | *unknown* | *unknown*

## UIX DOM

The UIX full-stack framework is built on top of [UIX DOM](https://github.com/unyt-org/uix-dom),
a standalone library that allows you to define reactive DOM elements on the frontend and backend.

The full-stack UIX framework provides many more features, but if you just need a basic reactive DOM library,
you can take a look at UIX DOM.

## Contributing

We welcome every contribution!<br>
Please take a look at the [development guidelines](./DEVELOP.md) and the unyt.org [contribution guidlines](https://github.com/unyt-org/.github/blob/main/CONTRIBUTING.md).

## Connect with us

![https://unyt.org/discord](https://dcbadge.vercel.app/api/server/qJwsRRqezy)

**Check out our [Blog](https://unyt.blog)!**

## Contributors ✨

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/benStre"><img src="https://avatars.githubusercontent.com/u/35869401?v=4?s=100" width="100px;" alt="Benedikt Strehle"/><br /><sub><b>Benedikt Strehle</b></sub></a><br /><a href="https://github.com/unyt-org/uix/issues?q=author%3AbenStre" title="Bug reports">🐛</a> <a href="#content-benStre" title="Content">🖋</a> <a href="https://github.com/unyt-org/uix/commits?author=benStre" title="Documentation">📖</a> <a href="#design-benStre" title="Design">🎨</a> <a href="#ideas-benStre" title="Ideas, Planning, & Feedback">🤔</a> <a href="#maintenance-benStre" title="Maintenance">🚧</a> <a href="https://github.com/unyt-org/uix/commits?author=benStre" title="Tests">⚠️</a> <a href="#projectManagement-benStre" title="Project Management">📆</a> <a href="https://github.com/unyt-org/uix/commits?author=benStre" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://unyt.org"><img src="https://avatars.githubusercontent.com/u/27917349?v=4?s=100" width="100px;" alt="Jonas Strehle"/><br /><sub><b>Jonas Strehle</b></sub></a><br /><a href="#design-jonasstrehle" title="Design">🎨</a> <a href="https://github.com/unyt-org/uix/commits?author=jonasstrehle" title="Code">💻</a> <a href="https://github.com/unyt-org/uix/commits?author=jonasstrehle" title="Documentation">📖</a> <a href="#ideas-jonasstrehle" title="Ideas, Planning, & Feedback">🤔</a> <a href="#maintenance-jonasstrehle" title="Maintenance">🚧</a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!


---

<sub>&copy; unyt 2024 • [unyt.org](https://unyt.org)</sub>
