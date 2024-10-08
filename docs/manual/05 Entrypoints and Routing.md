# Entrypoints

In a UIX app, the user interface is provided by [default exports](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/export#using_the_default_export) from the `entrypoint.ts`/`entrypoint.tsx` files located at the root of the `backend` or `frontend` directories.

There are variety of values that can be exported from an entrypoint for display in the browser, including strings, HTML Elements, Blobs and [more](#entrypoint-values).

Example entrypoints:
```typescript title="backend/entrypoint.tsx" icon="fa-file"
export default "Hello, this is a simple text displayed on a website and loaded from the backend entrypoint";
```
```tsx title="frontend/entrypoint.tsx" icon="fa-file"
export default 
    <section>
        <h1>Title</h1>
        <p>Description...</p>
    </section>;
```

## Entrypoint configurations
### Frontend only entrypoint
If there are no backend entrypoint exports, the UI is generated directly from the frontend entrypoint on each frontend client.
This configuration is useful for complex web applications with user-specific UI and also when the UI content should not be available on the backend.

### Backend only entrypoint
UI generated on the backend entrypoint is "moved" to the frontend client.
UIX supports [multiple methods](./08%20Rendering%20Methods.md) for backend rendering.

### Backend and frontend entrypoint
If entrypoint exports exist for both the frontend and the backend, they will be merged automatically.
This configuration is especially useful when combined with [Entrypoint Routes](#route-maps).


The following diagram visualizes the concept of route merging in UIX:
![Entrypoint Routing](./res/entrypoints.svg)

Backend routes are always prioritized over frontend routes.

In this example, the route `/support/technical` follows the *frontend* entrypoint route and resolves to `Tech Support`.
The route `/home/about` is resolved on the *backend* to `About us`.

## Entrypoint values

### HTML elements
HTML elements are appended directly to the body of the document. They can be created using the built-in DOM APIs (`document.createElement()`) or using JSX syntax:
```tsx title="entrypoint.tsx" icon="fa-file"
import { Entrypoint } from "uix/html/entrypoints.ts";
export default <div>Content</div> satisfies Entrypoint;
```

Like other entrypoint values, HTML elements are DATEX compatible and their content can be synchronized.
Keep in mind that the content is not updated when it is provided with [`renderStatic`](./08%20Rendering%20Methods.md#static-rendering).

```tsx title="entrypoint.tsx" icon="fa-file"
const counter = $(0);
setInterval(()=>counter.val++,1000);

export default <div>Count: {counter}</div> satisfies Entrypoint;
```

### Strings
Strings are displayed as text appended to the document body (color and background color depend on the current app theme).

Examples:
```tsx title="entrypoint.tsx" icon="fa-file"
export default 'Hi World' satisfies Entrypoint;
```
```tsx title="entrypoint.tsx" icon="fa-file"
const content = $("content");
export default content satisfies Entrypoint;
content.val = 'new content';
```

If you only want to display plain text without a parent HTML document and CSS styles, you can use `provideContent('text content')`.


### Route maps

Route maps are simple JavaScript objects with route patterns as keys and entrypoint values as values.

When a route is requested from the backend or loaded on the frontend, the most specific (*longest*) matching route entry is resolved to an entrypoint value.

A simple route map might look like this:
```tsx title="entrypoint.tsx" icon="fa-file"
export default {
    '/home': <HomePage/>,
    '/about': <div>About us...</div>
} satisfies Entrypoint;
```

Since route maps are valid `Entrypoint` values, multiple route maps can be nested. Since a route part must match the route pattern key exactly, the parent route key must end with `*` for the route to be resolved recursively.

```tsx title="entrypoint.tsx" icon="fa-file"
export default {
    '/articles/*': {
        '/first': 'First Article...',
        '/second': 'Second Article...'
    }
} satisfies Entrypoint;
```

Besides the `*` syntax, many more patterns, such as Regular Expressions, are supported in route map keys. Internally, route maps use the [URLPattern API](https://developer.mozilla.org/en-US/docs/Web/API/URLPattern/URLPattern).
Matches can be accessed via the second argument in the callback function. The raw `URLPatternResult` can be acessed via `ctx.urlPattern`.

```tsx title="entrypoint.tsx" icon="fa-file"
export default {
    // Match user route with name
    '/user/:name/': (_, {name}) => `Hello ${name}!`
    // Match page route using a Regular Expression
    '/page/(1|2|3)/': (ctx) => `This is page ${ctx.urlPattern.pathname.groups[0]}` 
    // Fallback if nothing else matches
    '*': 'Not found' 
} satisfies Entrypoint;
```

### Route map filters

Route Maps also accept special symbols, called *filters* as keys.
They can be used to follow a specific route only if a certain condition is met.

An important use case for filters is the `RequestMethod` filter, which can be used to route depending on the HTTP request method:

```tsx title="backend/entrypoint.tsx" icon="fa-file"
import { RequestMethod } from "uix/routing/request-methods.ts"

export default {
    '/login': {
        // Provide login page
        [RequestMethod.GET]: provideFile("common/index.html"),
        // Handle POST method triggered from login page    
        [RequestMethod.POST]: (ctx) => handleLogin(ctx)
    }
} satisfies Entrypoint;
```

Custom route filters can be created with the `createFilter()` method from:
```tsx title="backend/entrypoint.tsx" icon="fa-file"
import { createFilter } from "uix/routing/route-filter.ts";

const isAdmin = createFilter((ctx: Context) => 
    ctx.privateData.isAdmin);
const isPayingCustomer = createFilter((ctx: Context) => 
    ctx.privateData.isPayingCustomer);

export default {
    '/api/*': {
        [isAdmin]:          ctx => handleAPICall(ctx, {rateLimit: Infinity}).
        [isPayingCustomer]: ctx => handleAPICall(ctx, {rateLimit: 1000}),
        '*' :               ctx => handleAPICall(ctx, {rateLimit: 10}),
    }
} satisfies Entrypoint;
```

In this example, API calls are triggered with different rate limits depending on the type of the requesting client.
The wildcard (`'*'`) selector can be used as with normal routes to provide fallback behavior if none of the other cases match.

### Blobs
Blobs are displayed directly as files in the browser (creating a file response with the correct mime type).

Example:
```tsx title="backend/entrypoint.tsx" icon="fa-file"
export default datex.get('./image.png') satisfies Entrypoint;
```

### Filesystem files
In a Deno environment, `Deno.FSFile` values can be returned as entrypoint values. They create a file response with the correct mime type.

The `provideFile()` function can also be used to return files from the local file system.

```tsx title="backend/entrypoint.tsx" icon="fa-file"
import { provideFile } from "uix/providers/common.tsx";

export default provideFile('./image.png') satisfies Entrypoint;
```

### Dynamic Images
The `provideImage()` method allows you to generate dynamic images using JSX and CSS. This is useful for generating social media images such as Open Graph images, Twitter cards, and more.

The following options are available for `provideImage`:

```tsx
provideImage(
  element: Element,
  options: {
    width?: number = 200
    height?: number = 200
    fonts?: {
      name: string,
      data: Uint8Array | ArrayBuffer,
      weight?: number,
      style?: 'normal' | 'italic',
      lang?: string
    }[]
    contentType?: 'png' | 'svg' = 'svg',
    // Options that will be passed to the UIX HTTP response
    status?: number = 200
  }
)
```
You can render your favicon using following code:
```tsx title="backend/entrypoint.tsx" icon="fa-file"
import type { Entrypoint } from "uix/html/entrypoints.ts";
import { provideImage } from "uix/providers/image.ts";
import { app } from "uix/app/app.ts";

export default {
    '/favicon.png': provideImage(<div style={{
            color: 'white',
            height: '100%',
            fontSize: 30,
            background: app.stage === 'dev' ? 
                'orange' :
                'black',
            display: 'flex',
            lineHeight: 2,
            justifyContent: 'center',
            alignItems: 'center',
            flexDirection: 'column'
        }}>
            <h1>My App</h1>
            <span>
                <i style={{color: app.stage === 'dev' ?
                    'black' :
                    'orange'}}>
                    {app.stage}
                </i>-Stage
            </span>
        </div>, {
            width: 250,
            height: 250,
            contentType: 'png'
        })
    )
} satisfies Entrypoint;
```

> [!WARNING]
> Not all CSS features can be used to create dynamic images from JSX, as Satori only supports a subset of CSS. Please refer to [Satori's documentation](https://github.com/vercel/satori#css) for a list of supported properties and elements.

### Redirects

`URL` objects result in a redirect response (HTTP Status Code **304**) to the given URL.
This can also be achieved with `provideRedirect()`:

```tsx title="backend/entrypoint.tsx" icon="fa-file"
import { provideRedirect } from "uix/providers/common.tsx";

export default {
    '/github': new URL('https://github.com/unyt-org'),
    '/to/:id': (_, { id }) => 
        provideRedirect(`https://${id}.unyt.app`),
} satisfies Entrypoint;
```

### Virtual redirects

Virtual redirects are similar to normal redirects, but they directly return a response with the content of the redirect URL, not a redirect response (HTTP Status **304**).

```tsx title="backend/entrypoint.tsx" icon="fa-file"
import { provideVirtualRedirect } from "uix/providers/common.tsx";

export default provideVirtualRedirect('/example/home') satisfies Entrypoint;
```

### Entrypoint functions
In the example above, an entrypoint function is used to return custom content based on the context of a route. Entrypoint functions take a single argument, a [`Context`](#uixcontext) object and return a `Entrypoint` or `Promise<Entrypoint>`.

Example:
```tsx title="backend/entrypoint.tsx" icon="fa-file"
export default (ctx: Context) => {
    return `You visited this page from ${ctx.request.address} and your language is ${ctx.language}`;
} satisfies Entrypoint;
```

When an entrypoint function throws an error, the error value is returned like a normal return value, but with an HTTP status code **500**.

### UIX components

UIX components implement the [Route Manager](#route-managers) interface and can handle routes internally.
When a component is encountered in the route chain, the `onRoute` method is called on the component.


```typescript
class Component {
    // return the child element to which the route is resolved
    // if the route contains more sections, onRoute is called on this child element with the next route
    // section as the identifier
    onRoute(identifier:string, is_initial_route:boolean): Component | boolean |void
    // return internal state of last resolved route
    getInternalRoute(): Path.route_representation | Promise<Path.route_representation> 
}
```

Component routing can be used to display or focus on different child components depending on the route:
```tsx
@template()
class Parent extends Component {
    #activeChild?: HTMLElement

    override onRoute(identifier:string) {
        // find the child that has the same id as the identifier
        this.#activeChild = this.querySelector(`#${identifier}`);
        this.#activeChild?.focus();
        return this.#activeChild;
    }

    override getInternalRoute() {
        return [this.#activeChild.id]
    }
}

export default {
    // content for /about
    '/about': 'About us', 
    // content for /version
    '/version': 1,		  

    // content for all other routes
    // e.g. /a -> div#a is focused
    '*': <Parent>
        <div id="a">A</div>
        <div id="b">B</div>
        <div id="c">C</div>
    </Parent>
};
```

## Error handling

### Throwing values
Values that are thrown with `throw` from an entrypoint function are treated similarly to returned values - the value is still rendered in the browser. There is only one difference: The response will have an error status code instead of the default **200** status code.

```tsx title="backend/entrypoint.tsx" icon="fa-file"
export default {
    '/:id': (_, { id }) => {
         if (id !== '4269420')
             throw 'Invalid login'; // displays 'Invalid login' with status code 500
         return 'The secret is 42!'; // displays 'The secret is 42!' with status code 200
     }
} satisfies Entrypoint;
```

### Throwing errors

Instances of `Error` that are thrown or returned b an entrypoint function will be rendered in the browser as an error info box including a stack trace when running in `dev` stage.

```tsx title="backend/entrypoint.tsx" icon="fa-file"
export default {
    '/:id': (_, { id }) => {
         if (id !== '4269420')
             throw new Error('Invalid login'); // displays an error info box (with stack trace)
         return 'The secret is 42!';
     }
} satisfies Entrypoint;
```

### HTTPStatus

`HTTPStatus` values can be returned or thrown to create a response with a specific status code.
Additionally, custom content can be returned using the `with` method:

```tsx title="backend/entrypoint.tsx" icon="fa-file"
import { HTTPStatus } from "uix/html/http-status.ts";
export default {
    '/:id': (_, { id }) => {
         if (id !== '4269420')
             throw HTTPStatus.BAD_REQUEST.with('MyCustomMessage'); // displays "MyCustomMessage" with status code 400 (Bad Request)
         return "The secret is 42!";
     }
} satisfies Entrypoint;
```

## UIX providers

UIX provider utility functions allow the backend entrypoint to return HTTP responses directly from an entrypoint.

### List of UIX providers:
 * ```typescript
   function provideValue(value:unknown, options? :{ type?: Datex.DATEX_FILE_TYPE, formatted?: boolean})
   ```
   This function returns a HTTP Response with the mime type `application/json`, `application/datex` or `text/datex`,
   containing the serialized value. When the `options.type` is `Datex.DATEX_FILE_TYPE.JSON`, the value must be serializable with JSON.stringify. The default value for `options.type` is `Datex.FILE_TYPE.DATEX_SCRIPT`. In this configuration, any DATEX-compatible value can be provided.
 * ```typescript
   function provideJSON(value:unknown, options?: { formatted?: boolean })
   ```
   This function returns a HTTP Response with the mime type `application/json`,
   containing the serialized value. The value must be JSON-compatible.
 * ```typescript
   function provideContent(content: string | ArrayBuffer, type: mime_type = 'text/plain;charset=utf-8', status?: number)
   ```
   Returns a HTTP Response with custom content and a custom mime type and status code.


## Route handlers

Route handlers are similar to [Dynamic Entrypoint Functions](#dynamic-entrypoint-functions), but they are represented with an interface. 
Unlike a dynamic entrypoint function, which only takes a UIX context as a parameter, the `getRoute` method of a route handler additionally takes the remaining route as an argument.

```typescript
export interface RouteHandler {
    // return entrypoint for a route
    getRoute(route:Path.Route, context:Context): Entrypoint|Promise<Entrypoint> 
}
```


## Route managers
The `RouteManager` interface represents an entity with an internal route state.
In contrast to other entrypoints, it has the ability to modify the requested route.

When a route manager is encountered while resolving a route, the `resolveRoute` method is called with the remaining part of the current route.
The route manager decides how to update its internal state and returns the part of the route that it was able to resolve.
The actual route on the client is updated to contain only this portion.
The `getInternalRoute` should always return the route represented by the current state, and should match the route part returned by `resolveRoute`.

The `RouteManager` interface is implemented by UIX components.

```typescript
interface RouteManager {
    // return part of route that could be resolved
    resolveRoute(route: Path.Route, context: Context): Path.route_representation | Promise<Path.route_representation> 
    // return internal state of last resolved route
    getInternalRoute(): Path.route_representation | Promise<Path.route_representation> 
}
```

## Entrypoint proxies

An entrypoint proxy can be wrapped around any entrypoint value to intercept routing and add custom functionality.
The abstract `EntrypointProxy` class has two methods that can be implemented:

```typescript
abstract class EntrypointProxy implements RouteHandler {
    /**
     * This method is called before a route is resolved by the entrypoint
     * It can be used to implement a custom routing behavior
     * for some or all routes, overriding the entrypoint routing
     * 
     * The returned value replaces the entrypoint, if not null
     * 
     * @param route requested route
     * @param context UIX context
     * @returns entrypoint override or null
     */
    abstract intercept?(route: Path.Route, context: Context): void|Entrypoint|Promise<void|Entrypoint>

    /**
     * This method is called after a route was resolved by the entrypoint
     * It can be used to override the content provided for a route by returning 
     * a different entrypoint value. 
     * When null is returned, the route content is not changed
     * 
     * @param content content as resolved by entrypoint
     * @param render_method render method as resolved by entrypoint
     * @param route the requested route
     * @param context UIX context
     * @returns entrypoint override or null
     */
    abstract transform?(content: Entrypoint, render_method: RenderMethod, route: Path.Route, context: Context): void | Entrypoint | Promise<void | Entrypoint>
}
```

## Context

A UIX `Context` is created for each entrypoint request (when requesting a URL from a backend entrypoint or when redirecting to a URL on the frontend) and can be accessed in [Dynamic Entrypoint Functions](#dynamic-entrypoint-functions), [Route Managers](#route-managers) and [Route Handlers](#route-handlers).
It contains information about the client, about the route, and about the HTTP request (for backend entrypoints only).

```typescript
interface Context {
    request?: Request
    requestData = {
        address: string | null
    }

    path: string
    params: Record<string,string>;
    urlPattern?: URLPatternResult
    searchParams: URLSearchParams

    language: string
    endpoint: Datex.Endpoint

    getSharedData(): Promise<Record<string, unknown>>
    getPrivateData(): Promise<Record<string, unknown>>
}
```