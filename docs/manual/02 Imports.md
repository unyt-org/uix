# Cross-Realm Imports

Modules in the `frontend` directory of an UIX App can use exported values from modules in the `backend` directory, as if they are running on the same device and within the same process. This is accomplished via DATEX exchange between the frontend and backend endpoints.

Modules from the common directory can be imported from both the backend and frontend.
*The exports from common modules don't share a state between the backend and frontend endpoints, every module is initialized indvidually on each endpoint.*

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
> You should keep in mind that all value updates are propagated asynchronously between endpoints.

## Security

Only values that are explicitly imported in frontend module source code are publicly exposed from the backend.
All of the other exports are still only accessible within the backend context.

Even if values are exported from the backend because they are required on the frontend, the backend module source
code is never publicly exposed - only the exported values are accessible.
