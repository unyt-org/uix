# Cross-Realm Imports

Modules in the `frontend` directory of a UIX app can import exported values from `backend` modules, as if they were running on the same device and within the same process. 
Under the hood, this is achieved using DATEX messaging between the frontend and backend endpoints.

**Cross-Realm Import Example**:

```typescript
// file: backend/public.ts - running on the backend (Deno)

export function getData() {
    return [1,2,3];
}

export const map = new Map<string,string>();
map.set("a", "Value for A");
```

```typescript
// file: frontend/entrypoint.ts - running on the frontend (browser client)

import {map, getData} from "../backend/public.ts";

console.log(map); // Map {"a"->"Value for A"}
console.log(await getData()); // [1,2,3]
```

> [!WARNING]
> Because network requests are asynchronous, imported functions always return a `Promise` that must be awaited.
> For the same reason, all value updates are propagated asynchronously between endpoints.

> [!WARNING]
> The following values have limitations when they are imported as backend exports from the frontend:
> * Classes 
>   * Class definitions should always be placed in a `common` module if the class is used on both the backend and the frontend.
>   * Static class fields can still be accessed on a class imported from the backend

## Common Modules

Modules from the common directory can be imported by both the backend and the frontend.

This is useful for defining components that can be rendered by the backend or frontend, or for utility functions and libraries that are used on the backend and frontend.

> [!NOTE]
> Common modules allow the use of the *same source code* for the backend and frontend, but they do not share a state between the backend and frontend endpoints: Each module is initialized individually on each endpoint.
> A shared module state is only possible with *backend modules* that are imported from the backend and the frontend.


## Security

Only values that are explicitly imported into the frontend module's source code are publicly exposed from the backend.
All of the other exports are still only accessible within the backend context.

Even if values are exported from the backend because they are needed on the frontend, the backend module source code is never exposed.
Source code is never exposed to the public - only the exported values can be made accessible.