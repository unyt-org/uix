# Persistent Contexts

## Eternal modules

UIX allows you to save and restore the context of a module across backend restarts or page reloads.
Such persistent modules are called *eternal modules*.
To create an eternal module, simply add a `.eternal.ts` or `.eternal.tsx` extension to the module filename.

Simple example:

```ts title="backend/counter.eternal.ts" icon="fa-file"
// this is an eternal module that is only initialized once
export const counter = $(0);
```

```ts title="backend/entrypoint.ts" icon="fa-file"
// this module is loaded with a new context each time the app backend is restarted

import {counter} from "./counter.eternal.ts";

counter.val++; // increments the counter value each time the backend is restarted
console.log(counter); // logs 1,2,3,4... on each backend restart
```

You can read more about (eternal) contexts in the chapter [Functions and Contexts](./11%20Functions%20and%20Contexts.md).


## Session data

Each browser client in a UIX app is automatically bound to a unique session.
You can access **shared data** for this session from both the frontend and the backend, and **private data** from the backend only.
Both shared and private data are persisted across backend restarts. They exist only as long as the frontend session has not been expired.

The shared and private data for the current session can be accessed through the `Context` object:

```tsx title="backend/entrypoint.tsx" icon="fa-file"
export default {
    '/get-name': async (ctx) => {
        // load sharedData object for this context
        const sharedData = await ctx.getSharedData()
        // return 'name' entry
        return sharedData.name
    },
    '/set-name/:name': async (ctx, {name}) => {
        // load sharedData object for this context
        const sharedData = await ctx.getSharedData()
        // set 'name' entry
        sharedData.name = name;
        return name;
    }
} satisfies Entrypoint
```

In the same way, you can access the private data for a session on the backend with `await ctx.getPrivateData()`.
You can store any DATEX compatible value in the shared/private data objects.

You can also access private data in normal backend functions that do not access a UIX context element by passing the caller information provided by `datex.meta` to `Context.getPrivateData`:
```ts
export async function updatePrivateId(id: number) {
    // get the private data for the caller endpoint
    const privateData = await Context.getPrivateData(datex.meta);
    // update the 'id' field in the private data 
    privateData.id = id;
}
```

> [!WARNING]
> Private data is stored directly on the backend and can contain any amount of data.<br>
> In contrast, shared data is stored in the browser cookies, which are limited to a maximum storage size of 4096 bytes.


### Declaring session data types

You can define the global interfaces `SharedData` and `PrivateData` for session data type safety across your entrypoints.

```ts
declare global {
    // shared session data properties, also acessible on the frontend
    interface SharedData {
        username: string
        icon?: string
    }

    // private session data properties, only acessible on the backend
    interface PrivateData {
        passwordHash: string
        uuid: string
    }
}

// ...
const sharedData = await ctx.getSharedData()
ctx.username // -> type string
ctx.nonExistingProperty // error, property does not exist!
```

## Persistent values

As as an alternative to using `eternal` modules, persistent values can also be created with the `eternal` label

```typescript
const counter = eternal ?? $(0); // counter value gets restored from the previous state or initialized if no previous state exists

counter.val ++; // counter gets incremented every time
```

For non-DATEX native types such as HTML elements, you must use `lazyEternal` to ensure that the type definitions are loaded:

```typescript
export default await lazyEternal ?? $(<div>Content</div>)
```

```typescript
const customValue = await lazyEternal ?? $(new MyCustomClass())
```
