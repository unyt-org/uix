# JSX

UIX supports JSX syntax for creating HTML and SVG elements.

## Creating native DOM elements

All native DOM elements (e.g. `<div>`, `<p>`, `<img>`, `<svg>` ...) can be created with JSX. 

```tsx
const section = 
    <div id="section-1">
        <h1 style="font-weight:bold">Title</h1>
        <p>First Paragraph</p>
    </div>
```

In contrast to frameworks like React, the value returned by this JSX expression is an actual instance of an HTML div element.

You can directly append it to another element:

```tsx
document.body.append(section);
```

## Supported attributes

For default DOM elements, all attributes that are natively supported by the element can be used.
Components support the common attributes for DOM element (e.g. `id`, `class`, `style` or event handlers) per default, and 
can accept additional custom attributes defined in the component class or function.


## Fragments

There are two ways to create fragments in UIX.

### DocumentFragments

You can create HTML DocumentFragments with `<></>`:
```tsx
<>
    <div>Content 1</div>
    <div>Content 2</div>
</>
```

This is equivalent to 
```tsx
<DocumentFragment>
    <div>Content 1</div>
    <div>Content 2</div>
</DocumentFragment>
```
A fragment is collapsed into its child elements when appended to another DOM element.

> [!NOTE]
> Keep in mind that native DocumentFragments are *not reusable*.
> This means that after a fragment was appended to another element, it no longer has any content.
> If you want to directly return a top-level fragment for an entrypoint, you should always
> return it from a function, not as a single instantiation:
> ```tsx
> export default <>Content</> // Don't do this
> export default () => <>Content</> // This is correct
> ```
> Alternatively, you can use `uix-fragment` elements


### UIX Fragments

A `uix-fragment` is a reusable fragment that is part of the actual DOM but is never rendered itself. Just the children are visible in the DOM. It can be created like this:

```tsx
<uix-fragment>
    <div>Content 1</div>
    <div>Content 2</div>
</uix-fragment>
```

UIX Fragments do not face the reusablity issues of normal DocumentFragments, but you need to keep in mind that they are always visible to CSS selectors:

```tsx
<div>
    <uix-fragment>
        <h1>Title</h1>
    </uix-fragment>
</div>
```

```scss
div > h1 {
    // this does not work
}
div h1 {
    // this works
}
div > uix-fragment > h1 {
    // this also works
}
```

## Reactivity

Thanks to DATEX, elements created with JSX are inherently reactive, even if they
are not declared inside a component function.
JSX elements accept plain JavaScript values *or* DATEX Refs as attribute values and element contents.
When passing plain JavaScript values, the component is not updated dynamically:

```tsx
let myClass = "xyz";
const myDiv = <div class={myClass}></div>
myClass = "abc"; // myDiv class is still "xyz"
```

To achieve reactive behaviour, you need to pass in a `Ref` value:
```tsx
let myClass = $$("xyz");
const myDiv = <div class={myClass}></div>
myClass.val = "abc"; // myDiv class is now "abc"
```

### Conditional rendering

With conditional rendering, specific elements are only rendered if a certain condition is met.
There are multiple ways to achieve conditional rendering with UIX.

#### Using `always`

The `always` transform function autmatically recalculates the
result value when one of the dependency refs inside the function changes.
In this case, it is recalculated each time the value of `showDialog` is updated.

```tsx
const showDialog = $$(false);
const myDiv = <div>
    My Div
    {always (() => showDialog.val ? <div id="dialog">My Dialog</div> : <div/>)}
</div>
```

#### Using `toggle`

With the `toggle` function, you can achieve the same effect as with the `always`
function, but it is more efficient, because the return values are only every created once.
The `toggle` function switches between to values, depending on another value (in this case, `showDialog`): 

```tsx
const showDialog = $$(false);
const myDiv = <div>
    My Div
    {toggle (showDialog, <div id="dialog">My Dialog</div>, <div/>)}
</div>
```

#### Using the `display` style property

A different approach for conditional rendering is setting the `display` style property
to a ref: When `showDialog` is false, `display` is `none` and the div is not rendered.
Otherwise, `display` is `block` and the div is visible.

```tsx
const showDialog = $$(false);
const myDiv = <div>
    My Div
    <div id="dialog" style={{display:showDialog}}>My Dialog</div>
</div>
```

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

The `style` attribute accepts a string or an object with style declarations. The style properties can be pointer values that 
get dynamically updated.

```tsx
export default <div style={{color:'blue', padding:'10px'}}></div>
```

```tsx
// increase border width every 1s
const borderWidth = $$(0);
setInterval(()=>borderWidth.val++, 1000)

export default <div style={{borderStyle:'solid', borderWidth}}>content</div>
```
##### Special style values

Most style properties are assigned to strings. The following style properties also
accept other values:
 * `display`: The display property accepts a `boolean` value. If the value is `true`, `display` is set to the default display value (e.g. `display: block` for a div). If the value is `false`, `display` is set to `none`.


#### Class
Similar to the `style` attribute, the `class` accepts a string or an object.
The object must contain the potential class names as properties and booleans as the corresponding properties,
indicating whether this class should be activated.

Simple class string:
```tsx
export default <div class="main big"></div>
```

Class object:
```tsx
const enableBig = $$(false);
export default <div class={{main: true, big: enableBig}}></div> // results in class="main"

// ...
enableBig.val = true; // div class gets updated to class="main big"
```


```tsx
// increase border width every 1s
const borderWidth = $$(0);
setInterval(()=>borderWidth.val++, 1000)

export default <div style={{borderStyle:'solid', borderWidth}}>content</div>
```

#### Paths

All attributes that accept a path as a value (e.g. `src`, `href`) can be set to paths relative to the current module (For additional information check out `uix-module` in [Supported Attributes](#supported-attributes)).

Relative paths in element attributes are always resolved correctly on the backend and on the frontend.

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

If you need paths that are relative to the current URL as displayed in the browser, you can use the special `href:route` attribute:

```tsx
// frontend/entrypoint.ts
export default {
    '/some/path' : <a href:route="./other-path"/>, // resolves to "/some/other-path"
    '/some/other-path': "Hello there"
}
```

Instead of strings, `URL` values can also be set as path attributes.

#### Checkbox `checked` attribute

The special `checked` attribute of a checkbox element can be use to set or get the `checked` state of the checkbox:
```ts
// create new isChecked pointer bound to the "checked" state of the checkbox
const isChecked = $$(false);
export default <input type="checkbox" checked={isChecked}/>

// observe isChecked pointer
isChecked.observe((checked) => console.log("checkbox is checked: " + checked))
```

#### Form actions

The `action` attribute of a `<form>` element can be an URL / string containing the URL of the form request, or a [callback function](./05%20Entrypoints%20and%20Routing.md#entrypoint-functions) that is triggered on submit.

The return value of that function is rendered on the page and must be a valid [`Entrypoint` value](./05%20Entrypoints%20and%20Routing.md#entrypoint-values) (e.g. an HTML element, a string or a `Response` object).

```tsx
// backend/entrypoint.ts

// this function gets called when the form is submitted
function handleForm(ctx: Entrypoint) {
    // ...
    return "Form submitted"
}

// form
export default 
    <form action={handleForm}>
        <input type="text" name="username"/>
        <input type="password" name="password">
        <button type="submit">Login</button>
    </form>
```

#### Other UIX-specific attributes 

There are a few special attributes for uix-specific functionality:
 * `uix-module`: specify the module path which is used as a reference for relative paths, e.g.:
     ```tsx
    <img uix-module={import.meta.url} src="./relative/path/from/current/module/image.png"/>
     ```
    This is only required for compatibility with Safari. In other runtime environments (e.g. Deno), the `import.meta.url` is always automatically inferred and does not have to be explicitly set.
 * `datex-pointer`: boolean (set to true if the element should be bound to a pointer. Pointers are automatically created for elements that are sent over DATEX. Per default, only class components are automatically bound to a pointer.

## Creating components

[Components](./04%20Components.md) defined with functions or component classes can also be instantiated with JSX.
In addition to the default DOM element attributes, all component options can also be set via JSX attributes:

```tsx
const comp = <MyComponent style="color:green" text="text content"/>
```


## Using the `HTML` utility function instead of JSX

As an alternative to JSX, you can also use the `HTML` function which provides exactly the same functionality as JSX with JavaScript template strings.

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