# Styles and Themes

# Component styles

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



# Themes

Via the `UIX.Theme` namespace, global themes can be registered and activated.
The default themes provided by UIX are `uix-light` and `uix-dark`.

```ts
// register a new theme
UIX.Theme.registerTheme({
	name: 'my-custom-theme',
	mode: 'light', // light or dark mode
	// values are available to css variables (e.g. var(--border-color-1))
	values: {
		'text:' '#eeffee',
		'border-color-1': '#ffaa00'
	}
})

// activate a theme
UIX.Theme.setTheme('my-custom-theme');

// activate a mode (light or dark) - uses last registered theme
// that supports the requested mode
UIX.Theme.setMode('dark');

// observe light/dark mode change
UIX.Theme.onModeChange(mode => console.log("mode changed to", mode);)
```
