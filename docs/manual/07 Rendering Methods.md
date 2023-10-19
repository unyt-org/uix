# Rendering Methods

It is a core principle of UIX that code can be used interchangable on the frontend and backend.
This means that most components and JSX element definitions can either be created on the frontend (commmonly known as 'client-side rendering')
or on the backend (commonly known as 'server-side rendering').

This chapter will explain the different rendering modes for server-side rendering that can mostly be used
interchangably to provide UI from the *backend*.

> [!NOTE]
> The rendering modes discussed in this chapter are not supported for frontend (client-side) rendering.
> Using rendering modes on the frontend will not lead to errors to keep compatibility, but they don't
> have any effect in regards to performance and loading times.

## Overview

UIX distinguishes between four backend rendering methods:
 * *static* rendering
 * *backend* rendering
 * *hybrid* rendering
 * *dynamic* rendering

With the exception of static rendering, all of the rendering methods
provide reactive elements.

Static, backend and hybrid rendering pre-render the UI on the backend and send it
to the browser as pure HTML.


## Static Rendering

As the name suggests, static rendering can be used for completely static pages
that provide no JS-based interactivity (forms are still supported).

Example:
```ts
import {renderStatic} from "uix/base/render-methods.ts";

```


## Standalone Mode
UIX Components are rendered in standalone mode with `renderStandalone`.
In this mode, static HTML is prerendered on the backend and sent to the frontend. 
The UIX library and other core libraries are not initialized on the frontend.

It is still possible to add interactivity and other TS functionality to components in standalone mode:

Component methods and properties that are decorated with `@frontend` or event handlers defined with a `*:frontend` attribute are available in standalone contexts.

```tsx

@Component
export class ButtonComponent extends BaseComponent {
    // standalone properties
    @frontend clickCounter = 0;
    @frontend @id count = <span>{this.options.text}</span>;
    @frontend @content button = <button onclick={()=>this.handleClick()}>I was clicked {this.count} times</button>;

    @frontend handleClick() {
        // standalone context: only standalone properties are available
        this.clickCounter++;
        this.count.innerText = this.clickCounter.toString();
    }
}
```

### Supported values in Standalone Mode

The following values can be used as standalone properties:
 * JSON-compatible values (Arrays, number, strings, ...)
 * HTML Elements (only in combiniation with `@content`, `@child` or `@layout`)

### Lifecycle

Some internal component lifecycle handlers are also supported in standalone mode.
They must be explicitly enabled with `@standalone`.

```tsx
@Component
export class ButtonComponent extends BaseComponent {

    @frontend override onDisplay() {
        console.log("displayed in standalone mode: " + this.standalone)
    }

}
```
The `standalone` property is `true` when the component is loaded in standalone mode.


### Using UIX library functions

Keep in mind that reactive functionality is not supported in standalone mode.
If you want to use JSX, you need to explicitly import the UIX JSX Runtime:

```tsx
@Component
export class ButtonComponent extends BaseComponent {

    @frontend override async onDisplay() {
        await import("uix/jsx-runtime/jsx.ts");
        this.append(<div>Content</div>)
    }

}

```

If you want to use any other UIX-specific functionality, you need to explicitly import UIX:

```tsx
// import in the module scope - not available in standalone mode
import { UIX } from "uix";

@Component
export class ButtonComponent extends BaseComponent {

    @frontend override async onDisplay() {
        // explict import in standalone mode
        const { UIX } = await import("uix");
        UIX.Theme.setMode("dark");
    }

}

```


### Event handlers

Event handlers added to an element (e.g. in JSX) are always executed in their origin context per default.
This means that when the HTML element was created on the backend, the event handler is always called on the backend.

```tsx
// backend/entrypoint.ts
export default UIX.renderStatic(
    <input type="button" value="Click me" onclick={()=>console.log("called on the backend")}/>
)
```

```tsx
// backend/entrypoint.ts
export default (
    <input type="button" value="Click me" onclick={()=>console.log("also called on the backend")}/>
)
```

When the element is created on the frontend, the handler is called on the frontend as expected:

```tsx
// frontend/entrypoint.ts
export default (
    <input type="button" value="Click me" onclick={()=>console.log("called on the frontend")}/>
)
```

This behaviour can be overriden: To always call an event handler in the browser (display) context, use the `:frontend` label for the `onclick` attribute:

```tsx
// backend/entrypoint.ts
export default (
    <input type="button" value="Click me" onclick:label={()=>console.log("always called on the frontend")}/>
)
```

When an element in a component is decorated with `@frontend`, all handlers for the element are executed in the display context per default:
```tsx
// backend/MyComponent.ts
export class MyComponent extends UIX.BaseComponent {
    @frontend button = <button onclick={()=>console.log("click handler in standalone mode, called in the browser context")}>Click Me!</button>
}
```

### Component methods

Component methods decorated with `@bindOrigin` are always executed in the origin context of the component.

```tsx
// backend/MyComponent.ts
export class MyComponent extends UIX.BaseComponent {

    // standalone functionality - available in the browser standalone context
    @standalone button = <button onclick={()=>this.clickHandler()}>Click Me!</button>

    // clickHandler is executed in the backend context, but can be called from the
    // standalone context
    @bindOrigin clickHandler {
        console.log("button was clicked");
        this.clicks++;
        this.internalHander();
    }
    
    // internal component functionality in the backend context
    clicks = 0
    internalHandler() {
        console.log("doing internal stuff on the backend")
    }

}
```

Per default, methods decorated with `@bindOrigin` only support JSON compatible values as arguments and return values. 
To enable full DATEX support, use `@bindOrigin({datex:true})`
