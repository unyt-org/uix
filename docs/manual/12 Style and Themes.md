# Styles and Themes
UIX supports different ways of styling your application, including:

* [**Global CSS**](#global-styles): Simple to use and familiar for those experienced with traditional CSS.
* [**CSS Modules**](#component-style-sheets): Create locally scoped CSS classes for your class components to improve maintainability.
* [**Tailwind CSS**](#tailwind-css): A utility-first CSS framework that allows for rapid custom designs by composing utility classes.
* [**Inline CSS**](./03%20JSX.md#style): Embed CSS directly in your [JSX components](./03%20JSX.md), enabling dynamic and scoped styling.
* [**Element-scoped CSS**](#element-scoped-styles): Allows for having CSS styles bound to single JSX elements, enabling element-scoped styling.
* [**Reactive CSS**](#the-css-template-function): Allows for creating CSS Stylesheets with reactive properties.
* **Sass** (*deprecated*): A popular CSS preprocessor that extends CSS with features like variables, nested rules, and mixins.

## Global style sheets
You can define general global styles in an `entrypoint.css` file next to the `entrypoint.ts` file for backend or frontend.

> [!NOTE]
> Although SCSS is supported natively by UIX, we recommend using CSS files rather than SCSS files. Modern CSS already includes most of the features that are provided by SCSS.
> For this reason, CSS support will be completely removed from UIX in future versions.


## Component style sheets

To apply CSS styles to a component in a module, you can create a CSS file next to the module file (e.g. `MyComponent.tsx`) sharing the same base name (e.g. `MyComponent.css`).

The styles declared in the CSS file are automatically applied to all instances of the component and are not exposed to other components.

You can use the `:host` selector to access the component root element (also when not using a [Shadow DOM](./13%20Shadow%20DOM.md)).

```tsx title="common/MyComponent.tsx" icon="fa-file"
@template(<p>Hello, UIX!</p>)
class MyComponent extends Component {
    // ...
}
```

```css title="common/MyComponent.css" icon="fa-file"
:host {
    color: red;
    font-size: large;
    p {
        margin: 10px;
    }
}
```

If you need to apply styles to elements outside of a component, you can use [global stylesheets](#global-style-sheets).

## Component inline styles

Another way to add CSS rules to a component is to use inline styles with the `@style` decorator:

```ts
@style(css `
  div {
    background: red;
    font-size: 2em;
  }
`)
@template(...)
class MyComponent extends Component {
   // ...
}
```

The `@style` decorator accepts a `CSSStylesheet` as a parameter.
The best way to create this stylesheet is using the `css` template function.


## Element-scoped styles

In addition to setting individual CSS properties on an element's `"style"` attribute, you can also use the custom UIX `"stylesheet"` attribute to apply a stylesheet to the scope of the element.

```tsx
// normal "style" attribute:
<div style="color: red">...</div>;

// "stylesheet" attribute:
<div stylesheet="./MyStyle.css">  
    <h1>Title</h1>
</div>;
```
```css title="MyStyle.css" icon="fa-file"
/* applies to the outer div*/
:scope {
  color: green
}

/* applies to all h1 elements contained in the div*/
h1 {
  font-size: 2em;
}
```

This is the preferred method over placing styles in the `entrypoint.css` or a custom theme stylesheet, because the styles are always scoped to the element in which they are needed and never leaked out to other elements in the DOM.

Element-scoped styles can also be used inside function components, which do not support [external style sheets](#external-style-sheets) like class components.

> [!WARNING]
> This feature only works in browsers that support the experimental [`@scope` block](https://developer.mozilla.org/en-US/docs/Web/CSS/@scope#browser_compatibility).


### The `css` template function

The `css` function creates a `CSSStylesheet` from any valid CSS string (*@import directives are not allowed*). Additionally, it supports reactive properties:

```ts
const fontSize: Ref<string> = $('10px');
const stylesheet: CSSStylesheet = css `
  h1.big {
    font-size: ${fontSize};
    color: ${it => it.myColor};
  }
`;
fontSize.val = '20px';
```

In this example, the `font-size` property is bound to a pointer, and the color is bound to a computed value, where `it` references an element for which the selector is applied.

## Themes

The `UIX.Theme` namespace, is used to register and activate global themes. Themes can be defined as dark or light mode themes.

By default, UIX automatically decides which mode (dark or light) to use, depending on the preferred operating system mode.

The default themes provided by UIX are [`uix-light`](https://github.com/unyt-org/uix/blob/uix-new/src/themes/uix-light.ts) and [`uix-dark`](https://github.com/unyt-org/uix/blob/uix-new/src/themes/uix-dark.ts). More information on native themes can be found in the [Predefined Themes](#predefined-themes) section.

### Custom Themes

You can create and apply a custom theme by using the `registerTheme` method of `UIX.Theme`. This allows you to define and apply a personalized visual style for your application's frontend and backend:

```ts
registerTheme(theme: {
    name: string,
    mode?: 'light' | 'dark',
    values: Record<string, string>,
    stylesheets?: (string | URL)[],
    onActivate?: () => void,
    onDeactivate?: () => void
});
```

Here’s an example of how to register a light theme:

```ts
import { UIX } from "uix";

UIX.Theme.registerTheme({
    // unique theme name
    name: 'my-custom-light-theme',

    // light or dark (can be undefined if the theme doesn't respect dark/light mode preferences)
    mode: 'light',
    
    // custom CSS variables (e.g. var(--border-color-1))
    values: {
        'text': '#eeffee',
        'border-color-1': '#ffaa00'
    },

    // custom globally applied stylesheets
    stylesheets: [
        'https://example.com/style.css'
    ],

    onActivate() {
        // called when theme is activated
    },
    
    onDeactivate() {
        // called when theme is deactivted
    }
});
```

> [!NOTE]
> Registering themes does not necessarily activate the theme. You can activate a theme using the [`useThemes`](#activating-themes) method.

### Activating themes

Themes can be activated via the `useThemes` method of `UIX.Theme`.
The first available *(registered)* dark-mode theme from the list is used
as the new dark-mode theme, the first light-mode theme from the list is used as the new light-mode theme.

When `useThemes` is called, all previously activated themes are removed.

```ts 
import { UIX } from "uix";

// activate themes - the current theme is selected depending on the dark/light mode preference
UIX.Theme.useThemes('my-custom-dark-theme', 'uix-light-plain');
```

> [!NOTE]
> Themes should always be activated in both frontend and backend. 
> To avoid duplicate code, put the theme activation in a common module and import it from both the backend and the frontend. Make sure that custom themes are also registered in a common module. 

### Predefined Themes
UIX provides two predefined themes out-of-the-box that are selected if no theme is set: [`uix-light`](https://github.com/unyt-org/uix/blob/uix-new/src/themes/uix-light.ts) and [`uix-dark`](https://github.com/unyt-org/uix/blob/uix-new/src/themes/uix-dark.ts). These themes are designed with a clean, professional look that fits a wide variety of applications, making them an excellent starting point for most UI projects.

#### Tailwind CSS
UIX also offers full support for [Tailwind CSS](https://tailwindcss.com/), a popular utility-first CSS framework that allows developers to rapidly build modern UIs using predefined CSS classes.

To use TailwindCSS in your UIX application, import the theme and apply it:

```ts
import { UIX } from "uix";
import { tailwindcss } from "uix/themes/tailwindcss.ts";

UIX.Theme.useTheme(tailwindcss);
```

This will activate the `TailwindCSS` theme, enabling you to write JSX with Tailwind utility classes:

```tsx title="frontend/entrypoint.tsx" icon="fa-file"
export default <div class="text-red-500">
    Hello, UIX!
</div>;
```
More information can be found in the [Tailwind CSS documentation](https://tailwindcss.com/docs).

> [!NOTE]
> UIX does support live reloading for TailwindCSS themes when starting UIX with the [`-l` flag](./01%20Getting%20Started.md#the-uix-cli).

### Manually overriding the mode

It is recommended to let UIX automatically switch between the dark and light theme, but you can override the current mode:

```ts
UIX.Theme.setMode('dark');
```

### Observing theme and mode changes

For some use cases, it may be useful to change content or styling depending on the current theme or mode.

The `theme` and `mode` properties of `UIX.Theme` are bound to reactive pointers and can be used in combination with `effect` and `always` to react to changes:

```ts
effect(() => console.log(`Mode changed to ${UIX.Theme.mode}`));
```

```tsx
<div>
    {always(() =>
      UIX.Theme.mode == 'dark' ?
        'Dark mode' :
        'Light mode'
    )}
</div>
```

Alternatively, you can access the underlying pointers directly with `UIX.Theme.$.theme` / `UIX.Theme.$.mode`.
