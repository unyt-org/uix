# Persistent Contexts

UIX allows you to save and restore the context of a module across backend restarts or page reloads.
Such persistent modules are called *eternal modules*.
To create an eternal module, simple add an `.eternal.ts` or `.eternal.tsx` extension to the module file name.

Simple example:

```ts
// file: backend/counter.eternal.ts
// this is an eternal module that is only initialized once

export const counter = $$(0);
```

```ts
// file: backend/entrypoint.ts
// this module is loaded with a new context each time the app backend
// is restarted

import {counter} from "./counter.eternal.ts";

counter.val++; // increments the counter value each time the backend is restarted
console.log(counter); // logs 0,1,2,3.. on each backend restart
```

You can read more about (eternal) contexts in the chapter [Functions and Contexts](./10%20Functions%20and%20Contexts.md).

## Persistent values

Persistent values can also be created on a module level for specific values using the `eternal` label:
```typescript
const counter = eternal ?? $$(0); // counter value gets restored from the previous state or initialized
                                  // if no previous state exists
counter.val ++; // counter gets incremented every time
```

For non-DATEX-native types like HTML elements, you need to use `lazyEternal` to make sure the type definitions are loaded:

```typescript
export default await lazyEternal ?? $$(<div>Content</div>)
```

```typescript
const customValue = await lazyEternal ?? $$(new MyCustomClass())
```
