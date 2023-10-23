# Gettings Started - coming from React

Welcome to UIX! If you have used [React](https://react.dev/) before, this article is for you.

UIX has many concepts similar to React, but is based on a different approach.
With this article, we will try to make it is for you to transition from React to UIX.
This article roughly follows the [React quick start guide](https://react.dev/learn).

## The fundamental difference between React and UIX

While React and UIX components might look very similar on first glance, the
underlying approach is fundamentally different:

While the function of a React functional component is executed again on each state change,
UIX functions are only every run one time. To get dynamic updates for state changes,
UIX relies on fine-grained reactivity instead: State changes are passed through the data itself.

With this model, UIX still uses functional concepts, but gets rid of the often weird and "non-JavaScript-like"
behaviour of `useState`, `useEffect`, etc.
This also means that UIX does not need a virtual DOM, but works directly with the *actual* DOM instead.

Additionally, everything in UIX is fundamentally based on standard web APIs.
Within your UIX app, you can still use non-reactive APIs like `document.createElement`, `element.setAttribute` instead of JSX declarations.

## Let's start easy: JSX

Like React, UIX supports JSX for creating elements and components.
For the most basic use case - defining static UI - there aren't many differences between React and
UIX. 

Because UIX tries to support JSX that is as close to HTML as possible, there are 
a view small differences:
 * UIX uses the `class` attribute instead of `className`,
 * event handler attributes like `onclick` are also written in lowercase like they are normally written
 in HTML, not in camelCase (`onClick`) like in React.
 * UIX supports both objects and css strings for the `style` attribute


## Creating components

UIX components can be defined with functions, just like in React (In contrast to React, 
component classes are also still used in UIX).

The basic example from the React quick start guide can be used in UIX without any modifications:

```tsx
// entrypoint.tsx

function MyButton() {
  return (
    <button>
      I'm a button
    </button>
  );
}

export default function MyApp() {
  return (
    <div>
      <h1>Welcome to my app</h1>
      <MyButton/>
    </div>
  );
}
```

The default export in the `entrypoint.tsx` file is rendered on the page.
In contrast to React, this doesn't have to be a function, but can also take
[lots of other values](./05%20Entrypoints%20and%20Routing.md#entrypoint-values).
For example, you can just directly return a div element:

```tsx
export default (
    <div>
        <h1>Welcome to my app</h1>
	    <MyButton/>
    </div>
);
```

## Displaying data

Following the React examples, the following code is also valid UIX:

```tsx
const user = {
	name: 'Hedy Lamarr',
	imageUrl: 'https://i.imgur.com/yXOvdOSs.jpg',
	imageSize: 90,
};
  
export default function Profile() {
	return (
	  <>
		<h1>{user.name}</h1>
		<img
		  class="avatar"
		  src={user.imageUrl}
		  alt={'Photo of ' + user.name}
		  style={{
			  width: user.imageSize,
			  height: user.imageSize
		  }}
		/>
	  </>
	);
}
```

As you can see, UIX supports fragments and all default element attributes.

## Responding to events

Event handlers can also be assigned to attributes like in React (keep in mind that all attributes are written in lowercase, meaning `onClick` becomes `onclick`):

```tsx
function MyButton() {
  function handleClick() {
    alert('You clicked me!');
  }

  return (
    <button onclick={handleClick}>
      Click me
    </button>
  );
}

export default <MyButton/>
```

## Using state

Let's take a look at a simple React example using `useState`:
```tsx
function MyButton() {
  const [count, setCount] = useState(0);

  function handleClick() {
    setCount(count + 1);
  }

  return (
    <button onClick={handleClick}>
      Clicked {count} times
    </button>
  );
}
```

The `useState` hook returns two values, a `count` number
and and `setCount` function that has to be used to update the `count`
value.

UIX does not have the concept of hooks.
Instead, UIX has *pointers*, which are atomic reactive values
that can be used everywhere in a UIX app, not just within components.
A pointer is created with `$$()`, passing in the initial value as an argument.

Primitive pointer values are updated by setting the `.val` property of the pointer.

```tsx
function MyButton() {
	const count = $$(0); // create new pointer
  
	function handleClick() {
		count.val++ // update pointer value
	}
  
	return (
	  <button onclick={handleClick}>
		Clicked {count} times
	  </button>
	);
}
```

This is already less verbose than the React counterpart, while achieving the exact same outcome.
There is also another significant difference: 

In UIX, the `MyButton` function is only executed once. All following DOM updates happen by direct
propagation of the `count` value.
This means that in contrast to React, the `handleClick` function and the returned button are only
ever created once and not from scratch each time the count value is updated.

You can also use functions like `setInterval` much more
intuitively in UIX.

```tsx
function MyButton() {
	const count = $$(0);
  
	// no hooks required!
	setInterval(() => count.val++, 1000)
  
	return (
	  <div>
		Counter: {count}
	  </div>
	);
}
```


## Sharing data between components

Similar in React, pointers and other values can be
passed to other components.

We are using the following React example as a base

```tsx
function MyButton({ count, onClick }) {
  return (
    <button onClick={onClick}>
      Clicked {count} times
    </button>
  );
}

export default function MyApp() {
  const [count, setCount] = useState(0);

  function handleClick() {
    setCount(count + 1);
  }

  return (
    <div>
      <h1>Counters that update together</h1>
      <MyButton count={count} onClick={handleClick} />
      <MyButton count={count} onClick={handleClick} />
    </div>
  );
}
```

The same behaviour can be achieved with UIX:

```tsx
function MyButton({ count, onClick }) {
  return (
    <button onclick={onClick}>
      Clicked {count} times
    </button>
  );
}

export default function MyApp() {
  const count = $$(0);

  function handleClick() {
    count.val++
  }

  return (
    <div>
      <h1>Counters that update together</h1>
      <MyButton count={count} onClick={handleClick} />
      <MyButton count={count} onClick={handleClick} />
    </div>
  );
}
```


## Conditional rendering

The following React example also works correctly with UIX:

```tsx
export function IsGreaterThan1({random}) {
  return random > 1 ? 
    <div>Is greater than 1</div> : 
    <div>Is less than or equal 1</div>
}

export default function() {
	const random = $$(0);
	setInterval(() => random.val = Math.random() * 2, 500);
	return (
		<div>
			Random value: {random}
			<IsGreaterThan1 value={random}/>
		</div>
	)
}
```

The only caveat is that this only works with static data.
The content of `<ISGreaterThan1/>` is never updated.

For this reason, UIX provides special transform functions that can be used to transform values from
one pointer state to another.

The most versatile transform function is the `always` function, which allows you to write
most reactive state computations with normal JavaScript syntax, like it is possible in react:

```tsx
import { always } from "unyt_core/functions.ts";

export function IsGreaterThan1({random}) {
  return always(() =>
	    random > 1 ? 
        <div>Is greater than 1</div> : 
        <div>Is less than or equal 1</div>
  )
}

export default function() {
	const random = $$(0);
	setInterval(() => random.val = Math.random() * 2, 500);
	return (
		<div>
			Random value: {random}
			<IsGreaterThan1 random={random}/>
		</div>
	)
}
```

In UIX, you should always try to update the minimal amount of data.
This is why in this case, you could return just one div and make only the content reactive:

```tsx
export function IsGreaterThan1({random}) {
  const text = always(() => random > 1 ? "Is greater than 1" : "Is less than or equal 1");
  return <div>{text}</div>
}
```


> [!NOTE]
> The `always` function behaves as excpected in mose cases. There is just one limitation:
> The returned value must always have the same type.
> For DOM elements, this means that the value must be an HTML, SVG, MathML element, or a document fragment.
> To return plain values, wrap them in a document fragment:
>
> ```tsx
> always(() => loaded.val ? <div>User data...</div> : <>{"Loading..."}</>)
> ```