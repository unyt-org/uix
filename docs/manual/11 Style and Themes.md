# Styles and Themes

## External style sheets

To apply css styles to a component in a module `my_component.ts`, you can create a CSS or SCSS file next to the module file, called `my_component.css` or `my_component.scss`. 

The styles declared in this file are automatically adopted for all instances of the component and are not exposed
to other components.

You can use the `:host` selector to access the component root element (also when not using a shadow dom).

If you need to apply styles to elements outside of a component,
you can define general global styles in an `entrypoint.(s)css` file next to the `entrypoint.ts` file.

## Inline styles

Another way to add css rules to a component is to use inline styles with the `@style` decorator:

```ts
@style(SCSS `
  div {
    background: red;
    font-size: 2em;
  }
`)
@template(...)
class MyComponent extends Component {
   ...
}
```

The `@style` decorator accepts a `CSSStylesheet` as a parameter.
The best way to create this stylesheet is using the `SCSS` template function.


## Element-scoped styles

Besides setting individual css properties on the `"style"` attribute of an element, you can also use
the custom UIX `"stylesheet"` attribute for applying a stylesheet to the scope of the element.

```tsx
// normal "style" attribute:
export default <div style="color:red">...</div> 

// "stylesheet" attribute:
export default <div stylesheet="./myStyle.css">  
    <h1>Title</h1>
  </div> 
```
```css
/* file: myStyle.css */

/* applies to the outer div*/
:scope {
  color: green
}

/* applies to all h1 elements contained in the div*/
h1 {
  font-size: 2em;
}
```

This is the preferred way over putting styles in the `entrypoint.css` or a custom theme stylesheet,
because the styles are always scoped to the element in which they are needed and never leaked out to
other elements in the DOM.

Element-scoped styles can also be used inside function components, which do not support [external style sheets](#external-style-sheets) like class components.

> [!WARNING]
> This feature only works in browsers that support the experimental [`@scope` block](https://developer.mozilla.org/en-US/docs/Web/CSS/@scope).


### The `SCSS` template function

The `SCSS` function creates a `CSSStylesheet` from any valid (s)css string (@import directives are not allowed).
Additionally, it supports reactive properties:

```ts
const fontSize: Datex.Ref<string> = $$("10px")
const stylesheet: CSSStylesheet = SCSS `
  h1.big {
    font-size: ${fontSize};
    color: ${it => it.myColor};
  }
`
fontSize.val = "20px"
```

In this example, the `font-size` property is bound to a pointer, and the color is bound to a computed value, where `it` references an element for which the selector is applied.


## Themes

Via the `UIX.Theme` namespace, global themes can be registered and activated.
Themes can be defined as dark or light mode themes.

Per default, UIX automatically decides which mode (dark or light) to use, depending
on the preferred OS mode.

The default themes provided by UIX are `uix-light` and `uix-dark`.

### Registering custom themes

Before a custom theme can be used, it has to be registered:

```ts
// register a new theme
UIX.Theme.registerTheme({
  name: 'my-custom-light-theme',
  // light or dark mode (can be undefined if the theme doesn't respect dark/light mode preferences)
  mode: 'light', 
  // custom css variables (e.g. var(--border-color-1))
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
})
```
### Activating themes

Themes can be activated with `UIX.Theme.useThemes`.
The first available (registered) dark-mode theme from the list is used
as the new dark-mode theme, the first light-mode theme from the list is used
as the new light-mode theme.

When `UIX.Theme.useThemes` is called, all previously activated themes are removed.

```ts 
// activate themes - the current theme is selected depending on the dark/light mode preference
UIX.Theme.useThemes("my-custom-dark-theme", "uix-light-plain")
```

> [!NOTE]
> Themes should always be activated both on the frontend and backend. 
> To prevent duplicate code, put the theme activation in a common module and import it
> from both the backend and frontend. Make sure that custom themes are also registered
> in a common module. 

### Manually overriding the mode

It is recommended to let UIX switch between the dark and light theme automatically,
but you can override the current mode:

```ts
UIX.Theme.setMode('dark');
```

### Observing mode changes

Changes between dark and light mode can be handled with `UIX.Theme.onModeChange`:

```ts
UIX.Theme.onModeChange(mode => console.log("mode changed to", mode);)
```