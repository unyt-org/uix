# Component Standalone Mode

## Contexts in a UIX app

Components and other values can exist in different contexts within a UIX app. They can also be moved between contexts or exist
in multiple contexts at once.

 * **Backend context**: on a backend entrypoint module
 * **Display context**: on a frontend entrypoint module
 * **Standalone context**: special variant of a **display context**, has no module context

The **origin context** of a value is the module context in which the value was created. This can be a backend or display context.


## Standalone Mode
UIX Components are rendered in standalone mode with `UIX.renderStatic`.
In this mode, static HTML is prerendered on the backend and sent to the frontend. 
The UIX library and other core libraries are not initialized.

It is still possible to add interactivity and other TS functionality to components in standalone mode:

Component methods and properties that are decorated with `@standalone` or `@bindOrigin` are available in standalone contexts.
Any other values, like variables from the module or global scope are not available.

```tsx

@Component
export class ButtonComponent extends BaseComponent {
    // standalone properties
    @standalone clickCounter = 0;
    @standalone @id count = <span>{this.options.text}</span>;
    @standalone @content button = <button onclick={()=>this.handleClick()}>I was clicked {this.count} times</button>;

    @standalone handleClick() {
        // standalone context: only standalone properties are available
        this.clickCounter++;
        this.count.innerText = this.clickCounter.toString();
    }
}
```

## Supported values in Standalone Mode

The following values can be used as standalone properties:
 * JSON-compatible values (Arrays, number, strings, ...)
 * HTML Elements (only in combiniation with `@content`, `@child` or `@layout`)

## Lifecycle

Some internal component lifecycle handlers are also supported in standalone mode.
They must be explicitly enabled with `@standalone`.

```tsx
@Component
export class ButtonComponent extends BaseComponent {

    @standalone override onDisplay() {
        console.log("displayed in standalone mode: " + this.standalone)
    }

}
```
The `standalone` property is `true` when the component is loaded in standalone mode.


## Using UIX library functions

Keep in mind that reactive functionality is not supported in standalone mode.
If you want to use JSX, you need to explicitly import the UIX JSX Runtime:

```tsx
@Component
export class ButtonComponent extends BaseComponent {

    @standalone override async onDisplay() {
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

    @standalone override async onDisplay() {
        // explict import in standalone mode
        const { UIX } = await import("uix");
        UIX.Theme.setMode("dark");
    }

}

```

## Origin contexts in standalone mode

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

This behaviour can be overriden: To always call an event handler in the browser (display) context, wrap the
handler with `UIX.inDisplayContext()`:

```tsx
// backend/entrypoint.ts
export default (
    <input type="button" value="Click me" onclick={UIX.inDisplayContext(()=>console.log("always called on the frontend"))}/>
)
```

When an element in a component is decorated with `@standalone`, all handlers for the element are executed in the display context per default:
```tsx
// backend/MyComponent.ts
export class MyComponent extends UIX.BaseComponent {
    @standalone button = <button onclick={()=>console.log("click handler in standalone mode, called in the browser context")}>Click Me!</button>
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