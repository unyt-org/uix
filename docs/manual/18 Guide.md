# The UIX Guide

This guide conveys some important concepts and paradigms for developing applications with UIX/DATEX.
We recommend that you read this guide before starting to develop a UIX application to fully grasp the concepts and possibilities of the framework. 

## Storage

In UIX, you don't need to think a lot about how and where to store data.
UIX provides an abstraction layer that essentially treats persistent data the same way as in-memory data.

The most important point to take away is that you don't need to think about a database architecture or serialization strategy
when building a UIX app - with eternal pointers, this is all been taken care of by UIX.

### Eternal modules
In UIX, you can just write your application code as if the application runs forever and all your data is available in application memory.
You need to store a list of user data? Just think about how you would normally do this in JavaScript:

```tsx
// file: data.ts
interface UserData {
    name: string,
    email: string
}
export const users = new Set<UserData>()
```

Now make the module containing the `users` Set eternal by using the `eternal.ts` file extension:
```tsx
// file: data.eternal.ts
// The code stays the same:
interface UserData {
    name: string,
    email: string
}
export const users = new Set<UserData>()
```

The exported `users` set is now stored persistently and the current state is still available after an application restart.

This works out of the box without any special functions or data types. For larger data sets, you can optimize this
by using a special storage collection instead of a native `Set`:
```tsx
// data.eternal.ts
interface UserData {
    name: string,
    email: string
}
export const users = new StorageSet<UserData>()
```

A `StorageSet` has the same methods and properties as a normal `Set`, but it works asynchronously and saves a lot of memory by lazily loading
data from storage into memory when required.

### Storage locations

Under the hood, UIX can use multiple strategies for storing eternal data, such as in a key-value store, an SQL database, or local storage in the browser.

On the backend, eternal data is stored in a simple key-value database per default.
As an alternative, you can use an SQL database, which is more suitable for larger data sets where you need to query data.
Switching to SQL storage *does not require any changes in your application code* - it just changes the underlying storage mechanism.

On the frontend, eternal data is stored in the browser's local storage and IndexedDB.

## Networking

UIX creates an intuitive abstraction around the network layer and [DATEX](https://docs.unyt.org/manual/datex/introduction) communication.
You don't need to think about how to send data from the backend to the frontend or between browser clients.
Instead, you can just call a JavaScript function - no need for API architectures and REST. In UIX, your exported classes and functions *are* the API.

You want to get the age of a user from the backend?
Just call a function that returns the age of a user:

```tsx
// backend/age.ts
const users = new Map<string, {age: number}>();

export function getAgeOfUser(userName: string) {
    return users.get(userName)?.age
}
```

And in the frontend, you can call this function as if it was a local function:

```tsx
// frontend/age.ts
import { getAgeOfUser } from "backend/age.ts"
console.log(await getAgeOfUser("1234"))
```

Although you can retrieve individual object properties this way, the preferred
way in UIX is to just share the whole user object and read the required properties directly
on the frontend:

```tsx
// backend/age.ts
const users = new Map<string, {age: number}>();

export function getUser(userName: string) {
    return users.get(userName)
}
```

```tsx
// frontend/age.ts
import { getUser from "backend/age.ts"

const userA = await getUser("1234");
console.log(userA.age); // get age
userA.age = 42 // set age (automatically synced across the network)
```


## Reactivity

In UIX, reactive values are called pointers.
Pointers can contain any kind of JavaScript value, including strings, numbers, objects, arrays, and functions.
DOM elements can also be bound to pointers, making them reactive.

When creating a DOM element with JSX, it is automatically bound to a pointer.

```tsx
const counter = $$(0); // create a reactive pointer with initial value 0
const counterDisplay = <div>{counter}</div>; // bind the pointer to a DOM element
document.body.appendChild(counterDisplay); // append the element to the DOM
counter.val++; // increment the pointer value - updates the DOM element
```

Reactivity in UIX works cross-network per default.
You can share and synchronize pointers with other endpoints.

## Forms

UIX tries to stay as close as possible to existing Web APIs.
The HTML `<form>` element is a powerful tool for processing user-submitted data.

In UIX, you can create a `<form>` element with JSX and just bind the input values to pointers or pointer properties:

```tsx
// reactive 'User' class
@sync class User {
    @property name: string
    @property age: number
}

// <UpdateUserData/> form template
const UpdateUserData = template<{user:User}>((_, {user}) => 
    <form>
        Update User Data:
        <input type="text"   value={user.$.name}/>
        <input type="number" value={user.$.age}/>
    </form>
)

export default <UpdateUserData user={...}/>
```

In this case, you don't even need a submit button.
Input value changes are immediately propagated to the provided `User` object.
You actually don't even need a parent `<form>` element.

But what if you want to only update the `User` object after a form was submitted
by clicking a button?

UIX provides a special element attribute for this exact usecase, called `datex-update`.
Per default, `datex-update` is set to `"onchange"`, meaning every input update is immediately propagated.

To only update the bound pointer values when a submit
event was triggered, you can set `datex-update` to `"onsubmit"`:

```tsx
// <UpdateUserData/> form template with submit button
const UpdateUserData = template<{user:User}>((_, {user}) => 
    <form datex-update="onsubmit">
        Update User Data:
        <input type="text" value={user.$.name}/>
        <input type="number" value={user.$.age}/>
        <button type="submit">Save</button>
    </form>
)
```

> [!Warning]
> The "onsubmit" option is currently not supported for frontend rendering.


### Form validation

```ts
// reactive 'User' class
@sync class User {
    @assert(
      (name:string) => name.length <= 2 ? "Name must not be longer than 2 characters" : true
    )
    @property name = ""
    @property age = 42
}

function handleNewUser(user: User) {
 // ...
}

// <NewUserForm/> form template
const NewUserForm = template(() => {
    const user = new User()
    return <form action={() => handleNewUser(user)}>
        Register User:
        <input type="text"   value={user.$.name}/>
        <input type="number" value={user.$.age}/><
        <button type="submit">Speichern</button>
    </form>
})

export default () => <NewUserForm/>
```

## REST APIs

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
