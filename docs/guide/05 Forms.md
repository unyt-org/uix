# Forms

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
By default, `datex-update` is set to `"onchange"`, meaning every input update is immediately propagated.

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


## Validation

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