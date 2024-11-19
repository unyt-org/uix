# Shadow DOM and Light DOM
UIX provides mechanisms to encapsulate styles and manage child elements using [Shadow DOM](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM) and [Light DOM](https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model/Introduction). These features allow developers to build modular and reusable components while ensuring precise control over how child elements are rendered within the DOM.


Slots are a powerful feature in the Shadow DOM and Light DOM, allowing developers to inject children into specific placeholders within a UIX component. By assigning a name attribute to a <slot> element and a matching slot attribute to child elements, you can control which content appears in which slot. If the slot within the template definition has no name attribute set, all children will be injected into the first slot of the component.

To define a shadow or light root for a component, you can use:

* The `<shadow-root>`/`<light-root>` element: Add this element as the first child of the component.
* The `shadow-root`/`light-root` attribute: Wraps the element into a shadow/light root element automatically.

## Shadow Root
The Shadow DOM provides encapsulation for a component, separating its internal structure and styles from the rest of the document. 

```tsx
import { template } from "uix/html/template.ts";

@template(() => <shadow-root>
	<h1>Heading</h1>
	<slot/>
	<p>Footer</p>
</shadow-root>)
class ShadowComponentWithSlot extends Component {}

// Create the component and add children
<ShadowComponentWithSlot id="c1">
    <div>Child 1</div>
    {'Child 2'}
</ShadowComponentWithSlot>;
```

will be rendered as:
```html
<uix-shadow-component-with-slot id="c1">
    #shadow-root
        <h1>Heading</h1>
        <slot>
            ⮑ <div>Child 1</div>
            ⮑ Child 2
        </slot>
        <p>Footer</p>
</uix-shadow-component-with-slot>
```

The `shadow-root` attribute can be used like the following:

```tsx
import { template } from "uix/html/template.ts";

// define template:
const ShadowTemplateWithSlot = template(<div shadow-root>
    Before children
    <slot/>
    After children
</div>);

// create the element
<ShadowTemplateWithSlot id="c2">
    <div>Child 1</div>
    {'Child 2'}
</ShadowTemplateWithSlot>;
```

and will render as:

```html
<div id="c2">
    #shadow-root
        Before children
        <slot>
            <div>Child 1</div>
            Child 2
        </slot>
        After children
</div>
```

## Light Root
The Light DOM uses a `<light-root>` element to explicitly manage content placement in the component while allowing elements to participate in the global DOM structure. It’s important to understand that the content rendered in a light root is part of the global DOM structure. This means that it does not benefit from the encapsulation provided by Shadow DOM.

As a result, global styles, scripts, and DOM behavior can directly affect the content inside a light root.

```tsx
import { template } from "uix/html/template.ts";

@template(() => <light-root>
    <slot name="heading"/>
    <hr/>
    <slot name="content"/>
    <p>Footer</p>
</light-root>)
class LightComponentWithSlots extends Component {}

// Create the component and add children
<LightComponentWithSlots id="c3">
    <h1 slot="heading">Heading</h1>
    <div slot="content">
        My content!
    </div>
</LightComponentWithSlots>;
```

will render as
```html
<uix-light-component-with-slots id="c3">
    <light-root>
        <slot name="heading">
            <h1 slot="heading">Heading</h1>
        </slot>
        <hr/>
        <slot name="content">
            <div slot="content">My content!</div>
        </slot>
        <p>Footer</p>
    </light-root>
</uix-light-component-with-slots>
```
