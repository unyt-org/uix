# Reactivity

UIX is reactive! That is because UIX utilizes the powerfull DATEX Pointers under the hood. Pointers can contain any kind of JavaScript value, including strings, numbers, objects, arrays, functions and many more. DOM elements can also be bound to pointers, making them reactive. 

UIX’s reactivity system can look like magic when you see it in action the first time. Take this simple app made with UIX:

```tsx
const counter = $(0);
setInterval(() => counter.val++, 1000);

<div>
  <p>Counter = {counter}</p>
  <p>Counter + 1 = {counter + 1}</p>
</div>
```

Somehow UIX just knows that if the value of the counter changes, it should do these things:
1. Update the counter in the first paragraph to the correct value
2. Recalculate the expression `counter + 1`
3. Update the counter in the second paragraph to the expressions value


It's obvious - this isn't how JavaScript traditionally behaves. Let's introduce you to the magic behind UIX!

Consider this simple expression:
```js
const myVar = 4;
<div>{myVar + 5}</div>;
```
In plain JavaScript, this wouldn't work without manual DOM updates. You would have to write explicit logic to update the DOM when the value of myVar changes. For example:
```js
const myVar = 4;
document.querySelector('#some-element').innerText = myVar + 5;
```
In regular JavaScript, the DOM is static unless you explicitly manipulate it with DOM APIs. This is where UIX introduces its powerful reactivity system, which automates the whole process of updating DOM based on state updates.

## The Role of the "always" method
JSX in UIX can handle dynamic expressions and reactive updates using the `always` method provided by DATEX:
```tsx
const myVar = $(4);
<div>always(() => myVar + 1)</div>;
```
This tells UIX to automatically update the div's content whenever the value of the `myVar` Ref changes. The expression inside `always` creates a "smart transform" that updates the value and therefore the DOM when its dependencies change.

You can use the `always` method to manually control reactivity when needed.


## JUSIX: The module behind the "magic"
However, to make the developer experience smoother, UIX can automatically wrap certain expressions in `always` calls. This eliminates the need for developers to write `always` explicitly every time they want reactivity. This is basicially the magic we have seen in the introduction's `counter` example.

UIX uses the SWC transpiler to convert TypeScript and JSX code into plain JavaScript for both the frontend and backend.
Our custom SWC plugin called [JUSIX](https://github.com/unyt-org/jusix) handles the interpretation of JSX code as reactive JavaScript.

JUSIX is integrated in our custom version of Deno, called [Deno for UIX](https://github.com/unyt-org/deno), as part of the [`deno_ast` parser](https://github.com/unyt-org/deno_ast).
Additionally, the [JUSIX WASM plugin](https://github.com/unyt-org/jusix/tree/wasm-plugin) transpiles the frontend code to plain JavaScript for the browser.

JUSIX uses the `_$` method, which is essentially a shorthand for `always`. It comes with optimizations and performance enhancements tailored to JSX.

For instance, JSX expressions like:
```tsx
<p>Counter + 1 = {counter + 1}</p>;
```

are transpiled by JUSIX into JavaScript code that looks like this:

```tsx
<p>Counter + 1 = {_$(() => counter + 1)}</p>;
```

### Reactivity examples

Reactive tenary statements to allow for updating the DOMs children based on conditions can be written like this:
```tsx
const isLoggedIn = $(false);
<div>
  <button onclick={() => isLoggedIn.val = true}>Click to login!</button>
  {
      isLoggedIn ? 
          <HelloComponent/> : 
          <span>Please login first</span>
  }
</div>;
```

Above code is transpiled to something like:

```tsx
const isLoggedIn = $(false);
<div>
  <button onclick={() => isLoggedIn.val = true}>Click to login!</button>
  {
      _$(() => isLoggedIn ? 
          <HelloComponent/> : 
          <span>Please login first</span>)
  }
</div>;
```

#### Reactivity for attributes
The reactivity does not only work for HTML children or content but also for HTML attribute values:

```tsx
const counter = $(0);
<button
  value={'Clicks:' + myValue}
  onclick={() => counter.val++}/>;
```

is transpiled to:

```tsx
const counter = $(0);
<button
  value={_$(() => 'Clicks:' + myValue)}
  onclick={() => counter.val++}/>;
```


### Reactive properties
To improve performance when updating properties of complex objects, such as arrays or JavaScript objects, DATEX propagates updates for an object's pointer properties. JUSIX will optimize the handling of the updates to use special accessors instead of the `always` call.

Properties of an object can be accessed using the `prop(ref, key)` call.

```tsx
const myForm = $({name: 'John'});
<input value={myForm.name}/>;
```

will transpile to:

```tsx
<input value={prop(myForm, 'name')}/>;
```

This will also work when using nested property access such as `myComplexForm.user.name` and transpile to something like:
```tsx
<input value={prop(prop(myComplexForm, 'user'), 'name')}/>;
```

### App configuration
JUSIX is optional. JUSIX can be activated by settings the compiler options [`jsxImportSource` property](https://docs.unyt.org/manual/uix/getting-started#deno-configuration) in the `deno.json` to `jusix`, or disabled when setting it to be `uix`.


```json title="deno.json" icon="fa-file"
{
    "importMap": "./importmap.json",
    "compilerOptions": {
        "jsx": "react-jsx",
        "jsxImportSource": "jusix", // "uix" or "jusix"
        "lib": [
            "dom",
            "deno.window"
        ]
    }
}
```

When running UIX without having [Deno for UIX](https://github.com/unyt-org/deno) installed, the app will terminate with an exception. To disable JUSIX or allow the UIX app to run with the original [denoland/deno](https://github.com/denoland/deno) build, make sure to set the `jsxImportSource` option to `uix`. Keep in mind that this will disable all reactivity for your UIX app.