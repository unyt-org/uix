# Reactivity

UIX’s reactivity system can look like magic when you see it in action the first time. Take this simple app made with UIX:

```tsx
const counter = $(0);
setInterval(() => counter.val++, 1000);

<div>
  <p>Counter = {counter}</p>
  <p>Counter + 1 = {counter + 1}</p>
</div>
```


UIX is reactive! That is because UIX utilizes the powerfull DATEX Pointers under the hood. Pointers can contain any kind of JavaScript value, including strings, numbers, objects, arrays, functions and many more. DOM elements can also be bound to pointers, making them reactive.


When creating a DOM element with JSX, it is automatically bound to a pointer.

```tsx
const counter = $(0); // create a reactive pointer with initial value 0
const counterDisplay = <div>{counter}</div>; // bind the pointer to a DOM element
document.body.appendChild(counterDisplay); // append the element to the DOM
counter.val++; // increment the pointer value - updates the DOM element
```

Reactivity in UIX works cross-network by default.
You can share and synchronize pointers with other endpoints.
