# Cross-Realm Imports

Modules in the `frontend` directory of a UIX app can use exported values from modules in the `backend` directory, as if they are running on the same device and within the same process. 
This is accomplished with DATEX exchange between the frontend and backend endpoints.

**Cross-Realm Import Example**:

```typescript
// file: backend/public.ts

export function getData() {
    return [1,2,3];
}

export const map = new Map<string,string>();
map.set("a", "Value for A");
```

```typescript
// file: frontend/entrypoint.ts

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
>   * Class definitions should always be put in a `common` module if the class is used both on the backend and frontend.
>   * static class fields can still be accessed on a class imported from the backend
> * Symbols exported from a backend module cannot be imported in a frontend module

## Common Modules

Modules from the common directory can be imported from both the backend and frontend.

This is useful for definining components that can be rendered by the backend or frontend, or for utility functions or libraries that are used on the backend and frontend.

> [!NOTE]
> Common modules allow the usage of the *same source code* for the backend and frontend, but they do not share a state between the backend and frontend endpoints: Every module is initialized individually on each endpoint.
> A shared module state is only possible with *backend modules* imported from the backend and frontend.


## Security

Only values that are explicitly imported in frontend module source code are publicly exposed from the backend.
All of the other exports are still only accessible within the backend context.

Even if values are exported from the backend because they are required on the frontend, the backend module source
code is never publicly exposed - only the exported values are accessible.
