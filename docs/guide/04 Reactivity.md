# Reactivity

In UIX, reactive values are called pointers.
Pointers can contain any kind of JavaScript value, including strings, numbers, objects, arrays, and functions.
DOM elements can also be bound to pointers, making them reactive.

When creating a DOM element with JSX, it is automatically bound to a pointer.

```tsx
const counter = $(0); // create a reactive pointer with initial value 0
const counterDisplay = <div>{counter}</div>; // bind the pointer to a DOM element
document.body.appendChild(counterDisplay); // append the element to the DOM
counter.val++; // increment the pointer value - updates the DOM element
```

Reactivity in UIX works cross-network by default.
You can share and synchronize pointers with other endpoints.
