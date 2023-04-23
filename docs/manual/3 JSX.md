# JSX

UIX supports JSX syntax for creating HTML/SVG elements and UIX components.

## Creating native DOM elements

All native DOM elements (e.g. `<div>`, `<p>`, `<img>`, `<svg>` ...) can be created with JSX. 


```tsx
const section = 
    <div id="section-1">
        <h1 style="font-weight:bold">Title</h1>
        <p>First Paragraph</p>
    </div> as HTMLDivElement
```

## Supported attributes

For native DOM elements, all attributes that are natively supported by the element can be used.
Components support the common attributes for DOM element (e.g. `id`, `class`, `style` or event handlers) per default, and 
can accept additional custom attributes defined in the component class or function.

Additionally, there are special attributes for uix-specific functionality:
 * `uix-module`: specify the module path which is used as a reference for relative paths, e.g.:
     ```tsx
    <img uix-module={import.meta.url} src="./relative/path/from/current/module/image.png"/>
     ```
    This is only required for compatibility with Safari. In other runtime environments (e.g. Deno), the `import.meta.url` is always automatically inferred and does not have to be explicitly set.
 * `datex-pointer`: boolean (set to true if the element should be bound to a pointer. Pointers are automatically created for elements that are sent over DATEX. Per default, only class components are automatically bound to a pointer.


### Special attributes values


#### Event handlers
Every attribute value can be set to a DATEX pointer.
When the pointer value changes, the attribute is also updated.

Some attributes support special values. For example, all event listener attributes (`on[event]=...`) can take a callback function as a value.


```tsx
const btnDisabled = $$(false);

export default
    <div>
        <button disabled={btnDisabled}>Button</button>
        <button onclick={()=>btnDisabled.val=false}>Enable</button>
        <button onclick={()=>btnDisabled.val=true}>Disable</button>
    </div>
```

#### Style

The `style` attribute also accepts an object with style declarations. The style properties can be pointer values that 
get dynamically updated.

```tsx
export default <div style={{color:'blue', padding:'10px'}}></div>
```

```tsx
// increase border width every 1s
const borderWidth = $$(0);
setInterval(()=>borderWidth.val++, 1000)

export default <div id="sd" style={{borderStyle:'solid', borderWidth}}>content</div>
```

#### Paths

All attributes that accept a path as a value (e.g. `src`, `href`) can be set to paths relative to the current module (For additional information check out `uix-module` in [Supported Attributes](#supported-attributes)).

Relative paths in element attributes are always correctly resolved on the backend and on the frontend.

```tsx
// backend/entrypoint.ts
export default {
    '/img1': <img href="../common/images/1.png"/>, // file is in common directory: can be resolved on the frontend
    '/img2': <img href="./res/images/2.png"/>, // file is in backend directory: only accessible on the backend, not available on the frontend!
}
```
```tsx
// frontend/entrypoint.ts
export default {
    '/img3': <img href="../common/images/3.png"/>, // file is in common directory: can be resolved on the frontend
    '/img4': <img href="./res/images/4.png"/>, // file is in frontend directory: accessible on the frontend
}
```


## Creating components

Component defined with functions or Component classes can also be created with JSX.
In addition to the default DOM element attributes, all Component options can also be set
via JSX attributes:

```tsx
const comp = <UIX.Components.TextView style="color:green" text="text content"/>
```


## Using the `HTML` utility function instead of JSX

As an alternative to JSX, you can also use the `HTML` function which provides the exact same functionality as JSX with JavaScript template strings.

JSX:
```tsx
const count: Datex.Pointer<number> = $$(0);
const div = 
    <div>
        <p>Count: {count}</p>
    </div> as HTMLDivElement
```

HTML:
```tsx
const count: Datex.Pointer<number> = $$(0);
const div = HTML`
    <div>
        <p>Count: ${count}</p>
    </div>` as HTMLDivElement
```

In contrast to JSX, the `HTML` function does not require an extra transpiler step and can also be used in plain `.js` files.

### DATEX Injections

Besides JavaScript injections (with `${}`), the `HTML` function also supports reactive DATEX code injections with the `#()` syntax:
```ts
const count = $$(0);
const div = HTML `<div>next count: #(${count} + 1)</div>`
```
The expression inside `#()` is always handled as a transform function that results in a new reactive
pointer avlue.

This is equivalent to a JavaScript `always()` transform function
```ts
const div = HTML `<div>next count: ${always(() => count + 1)}</div>`
```
or a DATEX `always` command
```ts
const div = HTML `<div>next count: ${always `${count} + 1`}</div>`
```

## JSX return types

TypeScript currently does not support dynamic return types for JSX declarations.
This means that all JSX-generated elements must be explicitly cast to the correct class.
The same is true for elements created with the `HTML` function.

```tsx
const anchor = <a href="/link">Link</a> as HTMLAnchorElement
```
```tsx
const anchor = HTML `<a href="/link">Link</a>` as HTMLAnchorElement
```