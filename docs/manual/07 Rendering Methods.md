# Rendering Methods

It is a core principle of UIX that code can be used interchangably on the frontend and backend.
This means that most components and JSX element definitions can either be created on the frontend (commmonly known as 'client-side rendering')
or on the backend (commonly known as 'server-side rendering').

This chapter will explain the different rendering methods for server-side rendering (that can mostly be used
interchangably).

> [!NOTE]
> The rendering modes discussed in this chapter are not supported for frontend (client-side) rendering.
> Using rendering modes on the frontend will not lead to errors to keep compatibility, but they don't
> have any effect with regards to performance and loading times.

## Overview

UIX distinguishes between four backend rendering methods:
 * [*static* rendering](#static-rendering)
 * [*backend* rendering](#backend-rendering)
 * [*hybrid* rendering](#hybrid-rendering) (default)
 * [*dynamic* rendering](#dynamic-rendering)

With the exception of static rendering, all of the rendering methods
provide reactive elements.

Static, backend and hybrid rendering pre-render the UI on the backend and send it
to the browser as pure HTML.


## Static Rendering

As the name suggests, static rendering can be used for completely static pages
that provide no JavaScript-based interactivity (forms and form action methods are still supported).

Example:
```tsx
// file: backend/entrypoint.tsx
import {renderStatic} from "uix/base/render-methods.ts";
import type {Context} from "uix/routing/context.ts";

function handleForm(ctx: Context) {
    // handle form submit
}

export default renderStatic(
    <form action={handleForm}>
        My Static Form
        <input type="text" name="name" placeholder="name"/>
        <input type="submit" value="Submit form data"/>
    </form>
)

```

## Backend Rendering

When using backend rendering, there is no UIX or DATEX library loaded on the client-side.
All reactivity happens on the backend. 

You can still execute JavaScript on the frontend using [`@frontend` decorators or `:frontend` labels](10%20Functions%20and%20Contexts.md#scenario-3-event-handlers-in-the-frontend-context),
but keep in mind that only default browser APIs are available.

Example:
```tsx
// file: backend/entrypoint.tsx
import {renderBackend} from "uix/base/render-methods.ts";

const counter = $$(0);

export default renderBackend(
    <div>
        Counter: {counter}
        <button onclick={() => counter.val++}>Increment counter</button>
        <button onclick:frontend={() => alert("Hello")}>Show alert</button>
    </div>
)
```

> [!NOTE]
> Event handlers assigned to a JSX element (like the `onclick` handler on the increment button in the example above) are always executed in their origin context per default.
> This means that when the HTML element is created on the backend, the event handler is also called on the backend per default.
> 
> You can read more about this behaviour in the chapter [Functions and Contexts](./10%20Functions%20and%20Contexts.md)


## Hybrid Rendering

Hybrid rendering is the default method used for server-side rendering.

It behaves similarily to [backend rendering](#backend-rendering), with the only difference
that there a complete UIX library and DATEX runtime is available on the frontend.

Example:
```tsx
// file: backend/entrypoint.tsx

const counter = $$(0);

export default
    <div>
        Counter: {counter}
        <button onclick={() => counter.val++}>Increment counter</button>
        <button onclick:frontend={() => alert("Hello")}>Show alert</button>
    </div>
```

## Hybrid Rendering with Frontend Slots

With hybrid rendering, it is also possible to partially render content completely on the frontend inside predefined *slots*.

To achieve this, define the content for both the backend and frontend entrypoint.

`<frontend-slot>` elements can only be defined in the backend entrypoint.
A `<frontend-slot>` can contain placeholder content that is displayed until the
actual slot content is fully rendered on the frontend.


```tsx
// file: backend/entrypoint.tsx

export default (
    <div>
        <title>Hello</title>
        <frontend-slot>
            Loading...
        </frontend-slot>
    </div>
)
```

In the frontend entrypoint, the content that that gets rendered inside the frontend slot is defined.

```tsx
// file: frontend/entrypoint.tsx

export default (
    <div>Created on frontend</div>
)
```

You can also assign frontend-rendered elements to specific slots with names:
```tsx
// file: backend/entrypoint.tsx

export default (
    <div>
        <frontend-slot name="a"/>
        More backend content
        <frontend-slot name="b"/>
    </div>
)
```

```tsx
// file: frontend/entrypoint.tsx

export default <>
    <div slot="a">Div A</div> 
    <div slot="b">Div B</div> 
</>
```


### Component Lifecycle

When a component is rendered with hybrid rendering,
the `onConstruct` and `onCreate` lifecycle methods are called on
the backend. 

If `onDisplay` is marked with `@frontend`, it is called
as soon as the component is available on the frontend.
Without the `@frontend` decorator, onDisplay is never called.

```tsx
@template()
export class ButtonComponent extends Component {

    onCreate() {
        console.log("created") // called on the backend
    }
 
    @frontend onDisplay() {
        console.log("displayed") // called on the frontend
    }

}
```


## Dynamic Rendering

Dynamic rendering behaves exactly the same as hybrid rendering, with the only difference that
there is no HTML pre-rendering. 
The content is only visible after the UIX and DATEX libraries are initialized on the frontend.

We recommend to only use this mode if server-side rendering leads to problems or is explicitly not wanted.

Example:
```ts
// file: backend/entrypoint.tsx
import {renderDynamic} from "uix/base/render-methods.ts";

const counter = $$(0);

export default renderDynamic(
    <div>
        Counter: {counter}
        <button onclick={() => counter.val++}>Increment counter</button>
        <button onclick:frontend={() => alert("Hello")}>Show alert</button>
    </div>
)
```
