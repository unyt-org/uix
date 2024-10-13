# REST APIs

Although UIX applications are normally *not* built on top of classic APIs, there are still use cases where a UIX backend has to provide a REST API to communicate with external services.

REST API endpoints can easily be created using UIX entrypoint routing.

The `handleTypedRequest` helper function can be used to handle requests containing JSON data and/or return responses containing JSON data:

```tsx
/// import { handleTypedRequest } from "uix/http/typed-requests.ts"

export default {
  '/my-api-endpoint': handleTypedRequest({id: number, name: string}, data => {
    console.log("received:", data.id, data.name);
    return {status: "OK"};
  })
}
```

The request data is automatically parsed and validated.

With the `RequestMethod` filters, you can distinguish between `GET`, `POST` and other request types in a declarative fashion:


```tsx
/// import { struct, inferType } from "datex-core-legacy/types/struct.ts";
/// import { handleTypedRequest } from "uix/http/typed-requests.ts"

// User struct definition
const User = struct({id: number, name: string});
type User = inferType<typeof User>;

// users array
const users = new Array<User>();

// API routes
export default {

    '/users': {

        // GET: Return all users as JSON
        [RequestMethod.GET]: () => provideJSON(users),

        // POST: Add a new user  
        [RequestMethod.POST]: handleTypedRequest(User, user => {
            users.push(user);
            return {status: "OK"};
        })

    }
    
}
```