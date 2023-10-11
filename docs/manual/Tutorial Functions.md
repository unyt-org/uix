# Functions and Contexts in UIX

## Contexts in a UIX app

In UIX, we use the term 'context' to describe a module scope on a specific endpoint that
was created at a specific time. 
This context contains variables that can be accessed inside the context and also be exported.

To give an example, a context could be uniquely identified by the following parameters:
  * Module https://cdn.unyt.org/example/module.ts
  * Endpoint @example
  * Created on 4/20/2023 01:23

When the endpoint is restarted and the same module is loaded again,
a new context is created. This can be prevented by using [eternal modules](#restorable-contexts-eternal-modules).

In general, UIX distinguished between two context types:

 * **Backend context**: a module loaded on a backend endpoint
 * **Display context**: a module loaded on a frontend endpoint

Values and functions can exist in different contexts within a UIX app. They can also be moved between contexts and exist
in multiple contexts at once.

The **origin context** of a value is the module context in which the value was originally created. This can be a backend or display context.
When a value is moved to another context, this new context is called the **host context**.
For a given value, more than one host context can exist at the same time.

## Functions

Functions appear in many different places within a UIX app: 
 * As event handlers, e.g.
```tsx
const button = 
    <button onclick={() => console.log("clicked")}>
        Click me
    </button>
```
 * As component methods
```tsx
@Component
class MyComponent extends UIXComponent {
    myMethod() {
        ...
    }
}
```
 * Or as exported API functions from the backend
```tsx
export function register() {

}
```

Per default, all of those functions behave as you would expect in any JavaScript code.
But there is also some special UIX-specific behaviour, as you will see in the following examples.


### Scenario 1: Stationary exported functions

Per default, all functions in a UIX app are stationary, meaning that they only exist
in their origin context and cannot be transferred to another endpoint.

However, they can still be *called* from other endpoints - the function execution just always
happens in the origin context.

As a simple example, let't call an exported backend function from the frontend:
```ts
/// file: backend/entrypoint.ts
export function callMe() {
    return "thanks"
}
```
```ts
/// file: frontend/entrypoint.ts
import {callMe} from "backend/entrypoint.ts";
const result = await callMe() // "thanks"
```

This is nearly identical (despite the required additional `await`) to the more trivial example of 
importing a function from a frontend module inside another frontend module.


### Scenario 2: Stationary event handlers

When using functions as callbacks for events on HTML elements, they
are also stationary per default and are executed inside their origin context.

This means that when an event handler is defined on a HTML element exported from a backend entrypoint,
it is still executed on the backend entrypoint, also when the element is displayed in the browser (display context):

```tsx
/// file: backend/entrypoint.ts

const counter = $$(0)

export default 
    <button onclick={() => {
        console.log("button was clicked")
        counter.val++
    }}>
        I was clicked {counter} times
    </button>
```
In this example, `"button was clicked"` is logged on the backend when the button is clicked in the browser.

> [!NOTE]
> If the exact same entrypoint module was a frontend entrypoint, the logs would also be shown in the frontend,
> since the origin context is the frontend (display) context.


### Scenario 3: Event handlers in the display context

Now that we understand the default behaviour of functions, lets take a look at a
different scenario: 

> What if we *want* to execute the `onclick` handler from the last
> example in the browser, despite the button being created and rendered in the
> backend?

There are many reasons for such a behaviour: Maybe we want to show an alert to the user,
or we want to download a file, or ...

To achieve this, we only need to make one small change in our example code: replacing
the `onclick` attribute with a labeled `onclick:display` attribute.
This tells UIX that the event handler function must be transferred to the display context:

```ts
/// file: backend/entrypoint.ts

const counter = $$(0)

export default 
    <button onclick:display={() => { // add a :display label
        console.log("button was clicked")
        counter.val++
    }}>
        I was clicked {counter} times
    </button>
```

But if we try to run this code now, we will get an error: `Uncaught ReferenceError: counter is not defined`.
This happens because the event handler function now lives in a new display context and can no longer access variables from its original context per default.

To fix this, we need to explicitly state that we want to access the `counter` variable from the original context.
This is done with a `use()` declaration at the top of the function body:
```ts
/// file: backend/entrypoint.ts

const counter = $$(0)

export default 
    <button onclick:display={() => {
        use (counter) // use the counter variable from the origin context
        console.log("button was clicked")
        counter.val++
    }}>
        I was clicked {counter} times
    </button>
```

Now everything works as expected.


> [!NOTE]
> use() declarations don't have an effect if they are used in normal functions. 
> It doesn't hurt to add them to a stationary function that might be transferred
> at some point.

### Restorable contexts (eternal modules)

Modules with the file extension `.eternal.ts`, `.eternal.tsx`, or `.eternal.js`
keep a persistent context across restarts of an endpoint.

The state of the module is stored as DATEX and recreated when the endpoint is
restarted.

Eternal modules can be used as a persistent storage without any additional overhead that comes with
File I/O or Database mappings - everything is just normal typescript code.

Eternal modules can be used like an other module, exported values can be imported, updated and
functions can be called.

The only thing to keep in mind when using eternal modules is that functions must always include `use()`
declarations to restore the original context.

> [!NOTE]
> It is recommended to use eternal modules mostly to store data and functions.
> Class definitions with DATEX bindings should always be declared in separate non-eternal
> modules so that they can be properly recreated on restart. This is a limitation of the current datex-core
> beta implementation and will be fixed in the next versions.

## Limitations of use() declarations

`use` declarations are a powerful tool for creating tranferable and restorable JavaScript functions.

Nevertheless, there are some constraints you should keep in mind:
 1) Variables that are accessed with `use()` are readonly - they cannot be reassigned. The values are immutable per default. This restriction does not apply to pointer values. If you need mutable values, use pointers.
 2) All values accessed with `use()` must be DATEX-compatible
 3) When content is rendered on the backend with `renderStandalone`, `use()` declarations are limited to functions

`use` declarations must always be added at the beginninf of a function body.
Multiple `use` statements in one function are not allowed.

In single-line arrow functions, `use` statements can be combined with an `&&` operator or separated with commas:

```ts
const x = $$(10);

const fn1 = () => use(x) && x * 2;
const fn2 = () => (use(x), x * 2);
```

## Security: Preventing arbitrary remote code execution
