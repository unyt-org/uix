# The UIX Guide

This guide conveys some important concepts and paradigms for developing applications with UIX/DATEX.
We recommend that you read this guide before starting to develop a UIX application to fully grasp the concepts and possibilities of the framework. 


## Storage

In UIX, you normally don't need to think a lot about how and where to store data.
UIX provides an abstraction layer that essentially treats in-memory data and persistent data the same way.

The most important point to take away is that you don't need to think about a database architecture or serialization strategy
when building a UIX app - with eternal pointers, this is all been taken care of by UIX.

### Eternal modules
In UIX, you can just write your application code as if the application runs forever and all your data is available in the application memory.
You need to store a list of user data? Just think about how you would normally do this in JavaScript:

```tsx
// data.ts
interface UserData {
    name: string,
    email: string
}
export const users = new Set<UserData>()
```

Now make the module containing the `users` Set eternal by using an `eternal.ts` file extension:
```tsx
// data.eternal.ts
interface UserData {
    name: string,
    email: string
}
export const users = new Set<UserData>()
```

The Set is now stored persistently and the current state is still available after a restart of the application.

This works out of the box without any special functions or data types. For larger amounts of data, you can optimize this
by using a special storage collection instead of a native `Set`:
```tsx
// data.eternal.ts
interface UserData {
    name: string,
    email: string
}
export const users = new StorageSet<UserData>()
```

A `StorageSet` provides the same methods and properties as a normal `Set`, but it works asynchronously and saves a lot of memory by lazily loading
data into memory when required.

### Storage locations




## Networking

UIX also creates an intuitive abstraction around the network layer and DATEX communication.
You don't need to think about how to send data from the backend to the frontend or between browser clients.
Instead, you can just call a JavaScript function - no need for API architectures and REST. In UIX, your exported classes and functions *are* the API.


## Reactivity

Reactivity in UIX works cross-network per default.
You can share reactive values (pointers) with other endpoints.

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
