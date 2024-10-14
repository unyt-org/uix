# Networking

UIX creates an intuitive abstraction around the network layer and [DATEX](https://docs.unyt.org/manual/datex/introduction) communication.
You don't need to think about how to send data from the backend to the frontend or between browser clients.
Instead, you can just call a JavaScript function - no need for API architectures and REST. In UIX, your exported classes and functions *are* the API.

You want to get the age of a user from the backend?
Just call a function that returns the age of a user:

```tsx title="backend/age.ts" icon="fa-file"
const users = new Map<string, {age: number}>();

export function getAgeOfUser(userName: string) {
    return users.get(userName)?.age
}
```

And in the frontend, you can call this function as if it was a local function:

```tsx title="frontend/age.ts" icon="fa-file"
import { getAgeOfUser } from "backend/age.ts"
console.log(await getAgeOfUser("1234"))
```

Although you can retrieve individual object properties this way, the preferred
way in UIX is to just share the whole user object and read the required properties directly
on the frontend:

```tsx title="backend/age.ts" icon="fa-file"
const users = new Map<string, {age: number}>();

export function getUser(userName: string) {
    return users.get(userName)
}
```

```tsx title="frontend/age.tsx" icon="fa-file"
import { getUser } from "backend/age.ts"

const userA = await getUser("1234");
console.log(userA.age); // get age
userA.age = 42 // set age (automatically synced across the network)
```
