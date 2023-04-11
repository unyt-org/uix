# Cross-Realm Imports

## Importing backend modules from the frontend

Modules in the frontend directory of a UIX App can import exported values from modules in the backend directory, as if they are running on the same device in the same process:

```typescript
// file: backend/public.ts

export const map = new Map<string,string>();
map.set("a", "Value for A");

export function getData(){
	return [1,2,3];
}
```

```typescript
// file: frontend/entrypoint.ts

import {map, getData} from "../backend/public.ts";

console.log(map); // Map {"a"->"Value for A"}
console.log(await getData()); // [1,2,3]
```

In the background, this is accomplished via DATEX exchange between the frontend and backend endpoints.

Because network requests are asynchronous, imported functions always return a Promise that must be awaited.
You should keep in mind that value updates are also propageted asynchronously between the endpoints.

### Security

Only values that are explicitly imported from frontend modules are publicly exposed from the backend.
Other exports are still only accessible within the backend context.

Even if values are exported from the backend because they are required on the frontend, the backend module
code is never publicly exposed - only the exported values are accessible.

## Importing common modules

Modules from the common directory can be imported from both the backend and frontend.