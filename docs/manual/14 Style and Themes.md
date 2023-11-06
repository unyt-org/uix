# Styles and Themes

## External style files

To apply css styles to a component in a module `my_component.ts`, you can create a CSS or SCSS file next to the module file, called `my_component.css` or `my_component.scss`. 

The styles declared in this file are automatically adopted for all instances of the component and are not exposed
to other components.

You can use the `:host` selector to access the component root element (also when not using a shadow dom).

For general global styles, you can add an `entrypoint.(s)css` file next to the `entrypoint.ts` file.

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
  // light or dark mode
	mode: 'light', 
	// custom css variables (e.g. var(--border-color-1))
	values: {
		'text:' '#eeffee',
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
### Enabling themes

Registered themes can be set as the default theme for
dark or light mode.

```ts 
// set themes as a the default dark/light mode theme
UIX.Theme.setDefaultDarkTheme("my-custom-dark-theme")
UIX.Theme.setDefaultLightTheme("uix-light-plain")
```

### Manually overriding the theme and mode

It is recommended to let UIX select the theme automatically,
but you can also override the current theme:

```ts
UIX.Theme.setTheme('my-custom-theme');
```

The mode can also be overridden manually:

```ts
UIX.Theme.setMode('dark');
```

### Observing mode changes

Changes between dark and light mode can be handled with `UIX.Theme.onModeChange`:

```ts
UIX.Theme.onModeChange(mode => console.log("mode changed to", mode);)
```