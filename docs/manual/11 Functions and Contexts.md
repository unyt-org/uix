# Functions and Contexts in UIX

## Contexts in a UIX app

In UIX, we use the term 'context' to describe a module scope on a particular endpoint that was created at a specific time. 
This context contains variables that can be accessed inside the context and exported within the context.

To give an example, a context could be uniquely identified by the following parameters:
  * Module https://cdn.unyt.org/example/module.ts
  * Endpoint @example
  * Created on 4/20/2023 01:23

When the endpoint is restarted and the same module is loaded again, a new context is created. This can be prevented by using [eternal modules](#restorable-contexts-eternal-modules).

In general, UIX distinguished between two context types:

 * **Backend context**: a module loaded on a backend endpoint
 * **Display context**: a module loaded on a frontend endpoint

Values and functions can exist in different contexts within a UIX app. They can also be moved between contexts and exist in multiple contexts at once.

The **origin context** of a value is the module context where the value was originally created. This can be a backend or a frontend context.
When a value is moved to another context, the new context is called the **host context**.
There can be more than one host context for a given value.

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
@template(...)
class MyComponent extends Component {
    myMethod() {
        ...
    }
}
```
 * Or as exported functions from the backend
```tsx
export function register() {
    // ...
}
```

<br/>
By default, all of these functions behave as you would expect in any JavaScript code.
But UIX can extend this behavior, as you will see in the following examples.


### Scenario 1: Stationary exported functions

By default, all functions in a UIX app are stationary, meaning that they exist only in their origin context and cannot be transferred to another endpoint.

However, they can still be *called* from other endpoints - the function execution just always takes place in the original context.

As a simple example, let's call an exported backend function from the client (frontend):
```ts title="backend/entrypoint.ts" icon="fa-file"
export function callMe() {
    return 'thanks';
}
```
```ts title="frontend/entrypoint.ts" icon="fa-file"
import { callMe } from "backend/entrypoint.ts";
const result = await callMe(); // 'thanks'
```

This is almost identical to the more trivial example of 
importing a function from one frontend module into another frontend module.
The only difference is the additional `await` that is required for all functions called from an external context.

### Scenario 2: Stationary event handlers

When using functions as callbacks for events on HTML elements, they are also stationary by default and are executed inside their origin context.

This means that if an event handler is defined on an HTML element exported from a backend entrypoint, it will still be executed on the backend entrypoint, even when the element is displayed in the browser (frontend context):

```tsx title="backend/entrypoint.tsx" icon="fa-file"
const counter = $(0);

export default 
    <button onclick={() => {
        console.log("button was clicked")
        counter.val++
    }}>
        I was clicked {counter} times
    </button>;
```
In this example, `'button was clicked'` is logged on the backend when the button is clicked in the browser.

> [!NOTE]
> If the exact same entrypoint module was a frontend module, the logs would be shown in the frontend, since the origin context is also the frontend context.


### Scenario 3: Event handlers in the frontend context

Now that we understand the default behavior of functions, let us look at another scenario: 

> What if we want to execute the `onclick` handler from the last example in the browser, even though the button was created and rendered in the backend?

There are many reasons for this behavior: Maybe we want to show an alert to the user, or we want to download a file, or we want to update some DOM content on the frontend, etc.

To achieve this, we just need to make a small change in our example code: replace the `onclick` attribute with a *labeled* `onclick:frontend` attribute.
This tells UIX that the event handler function must be executed in the frontend context:

```ts title="backend/entrypoint.tsx" icon="fa-file"
const counter = $(0);

export default 
    <button onclick:frontend={() => { // add a :frontend label
        console.log('button was clicked')
        counter.val++
    }}>
        I was clicked {counter} times
    </button>;
```

But if we try to run this code now, we will get an error: `Uncaught ReferenceError: counter is not defined`.
This happens because the event handler function now lives in a new frontend context and can no longer access variables from its original context by default.

To fix this, we need to explicitly state that we want to access the `counter` variable from the original context.
This is done with a `use()` declaration at the top of the function body:
```ts title="backend/entrypoint.tsx" icon="fa-file"
const counter = $(0);

export default 
    <button onclick:frontend={() => {
        use (counter) // use the counter variable from the origin context
        console.log('button was clicked')
        counter.val++
    }}>
        I was clicked {counter} times
    </button>;
```

Now everything works as expected.


> [!NOTE]
> use() declarations don't have any effect when used in normal functions. 
> There is no harm in adding them to a stationary function that may be transferred at some point.

### Restorable contexts (eternal modules)

Modules with the file extension `.eternal.ts`, `.eternal.tsx`, or `.eternal.js` maintain a persistent context across endpoint restarts.

The state of the module is stored as DATEX and recreated when the endpoint is restarted.

Eternal modules can be used as a persistent storage without the overhead of file I/O or database mappings - everything is just normal typescript code.

Eternal modules can be used like any other module, exported values can be imported and updated, and functions can be called.

The only thing to keep in mind when using eternal modules is that functions must always include `use()` declarations to restore the original context.

Example:
```ts title="backend/counter.eternal.ts" icon="fa-file"
// this is only ever called once:
console.log("init eternal context"); 

// 'counter' keeps its current value, even after a server restart / page reload
export const counter = $(0);

export function incrementCounter() {
    use (counter); // references the counter of the original context
    counter.val++;
}
```

> [!NOTE]
> It is recommended that eternal modules be used primarily to store data and functions.
> Class definitions with DATEX bindings should always be declared in separate non-eternal modules so that they can be properly recreated on restart. This is a limitation of the current datex-core beta implementation and will be fixed in the next releases.

## Limitations of use() declarations

`use` declarations are a powerful tool for creating tranferable and restorable JavaScript functions.

Nevertheless, there are some constraints you should keep in mind:
 1) Variables that are accessed with `use()` are readonly - they cannot be reassigned. The values are immutable by default. This restriction does not apply to pointer values: if you need mutable values, use pointers.
 2) All values accessed with `use()` must be DATEX-compatible
 3) `use()` declarations for a context without a loaded DATEX runtime (this is the case when using `renderBackend`) must be called with the `"standalone"` flag: `use("standalone, ...)`.<br>
  With this flag, additional restrictions apply to `use()` declarations:
    * Pointer values are also immutable
    * Only JSON-compatible values and functions are supported as dependency values and as arguments/return values of functions that were injected as dependencies.

Furthermore, keep in mind:
 * `use` declarations must always be added at the beginning of a function body.
 * Multiple `use` statements in one function are not allowed.
 * Functions injected with `use()` are expected to always return a `Promise` and must be awaited to get the result.

In single-line arrow functions, `use` statements can be combined with an `&&` operator or separated with commas:

```ts
const x = $(10);

const fn1 = () => use(x) && x * 2;
const fn2 = () => (use(x), x * 2);
```

## use() examples

### Calling a backend function

In this example, we fetch some data from the backend by calling a function that is injected into the frontend context with `use()`.

```tsx title="backend/entrypoint.tsx" icon="fa-file"
function getData(name: string, count: bigint) {
    return {
        name,
        count,
        map: new Map([['data', 'xyz']])
    };
}

export default (
    <div>
        <button onclick:frontend={async () => {
            use (getData); // enable access to getData in the frontend context (browser client)
            const data = await getData('alex', 99999999n); // call getData() on backend and get result
            document.getElementById("data").innerText = data.map.get('data'); // update dom element content
        }}>Load Data</button>
        <p id="data"/>
    </div>
);
```

Since we did not provide an explicit rendering method, we used the default `renderHybrid`.
In this case, we have a full DATEX runtime on the client and are not restricted by constraint 3 (see [Limitations of use() declarations](#limitations-of-use-declarations)).

If we want to achieve the same thing with `renderBackend`, we need to modify or code to use only JSON-compatible values.
To allow the event handler function to run in a context without a DATEX Runtime which leads to the limitations just mentioned, we need to add the `"standalone"` flag to the `use()` declaration: 


```tsx title="backend/counter.eternal.tsx" icon="fa-file"
import { renderBackend } from "uix/base/render-methods.ts";

function getData(name: string, count: number) {
    return {
        name,
        count,
        map: {data: 'xyz'}
    };
}

export default renderBackend(
    <div>
        <button onclick:frontend={async () => {
            use ("standalone", getData); // enable access to getData in the frontend context (browser client)
            const data = await getData('alex', 99999999); // call getData() on backend and get result
            document.getElementById('data').innerText = data.map["data"]; // update dom element content
        }}>Load Data</button>
        <p id="data"/>
    </div>
);
```

> [!NOTE]
> The `"standalone"` flag can also be set when rendering with `renderHybrid`. In this case, the event handler function is already activated before the DATEX Runtime is fully initialized, leading to faster initial response times.


## Security Considerations

<sup>This section is not relevant for understanding how contexts work in UIX, but it talks about a relevant topic related to transferable functions: <i>Preventing arbitrary remote code execution</i></sup>

By design, DATEX code can be executed remotely, but it is always run in an isolated sandbox. Permissions for specific functionality must be explicitly granted to specific endpoints.

In contrast to normal DATEX functions, transferable functions containing JavaScript source code pose a potentially higher threat, because they have access to the global (`window`) object and can do almost anything within the scope of a web page.

Therefore, by default, transferable functions can only be called when they were created by the same endpoint. In addition, the DATEX runtime maintains a whitelist of all remote endpoints that are allowed to transfer executable JavaScript source code to the endpoint.

Within a UIX app, the only endpoint in this whitelist is the app backend endpoint, which is always considered trustworthy.