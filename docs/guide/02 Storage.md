# Storage

In UIX, you don't have to think much about how and where to store data.
UIX provides an abstraction layer that essentially treats persistent data the same way as in-memory data.

The most important point to take away is that you don't have to think about a database architecture or serialization strategy when building a UIX app - with eternal pointers, UIX takes care of all that.

## Eternal modules
In UIX, you can simply write your application code as if the application would run forever and all your data would be available in application memory.
Need to store a list of user data? Just think about how you would normally do that in JavaScript:

```tsx title="data.ts" icon="fa-file"
interface UserData {
    name: string,
    email: string
}
export const users = new Set<UserData>()
```

Now make the module containing the `users` Set eternal by using the `eternal.ts` file extension:
```tsx title="data.eternal.ts" icon="fa-file"
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
```tsx title="data.eternal.ts" icon="fa-file"
interface UserData {
    name: string,
    email: string
}
export const users = new StorageSet<UserData>()
```

A `StorageSet` has the same methods and properties as a normal `Set`, but it works asynchronously and saves a lot of memory by lazily loading
data from storage into memory when required.

## Storage locations

Under the hood, UIX can use multiple strategies for storing eternal data, such as in a key-value store, an SQL database, or local storage in the browser.

On the backend, eternal data is stored in a simple key-value database by default.
As an alternative, you can use an SQL database, which is more suitable for larger data sets where you need to query data.
Switching to SQL storage *does not require any changes in your application code* - it just changes the underlying storage mechanism.

On the frontend, eternal data is stored in the browser's local storage and IndexedDB.
