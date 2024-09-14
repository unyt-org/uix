# Shadow DOM
## Using shadow roots in components

For more control over the location of child elements, shadow roots and slots can be used.
To add a shadow root to the root element add a `<shadow-root>` element as the first child of the outer element.
Alternatively, you can add a `shadow-root` attribute to the outer element.  In this case, all of the outer element's child elements are appended to the shadow root.

```tsx
import { template } from "uix/html/template.ts";

// define template:
const CustomComponentWithSlots = template(<div shadow-root>
    Before children
    <slot/>
    After children
</div>);

// alternative template definition:
const CustomComponentWithSlots2 = template(<div>
    <shadow-root>
        Before children
        <slot/>
        After children
    </shadow-root>
    This child is appended to the slot element inside the shadow root
</div>);

// create element:
const comp3 = <CustomComponentWithSlots id='c1'>
    <div>Child 1</div>
    {"Child 2"}
</CustomComponentWithSlots>;

/* returns:
<div id='c1'>
    #shadow-root
        Before children
        <slot>
            <div>Child 1</div>
            Child 2
        </slot>
        After children
</div>
*/
```


<!-- 
## The `@content` decorator

The `@content` decorator adds a child to the `slot#content` element and visually has the same effect as using the `@child` decorator.
But in contrast to the `@child` decorator, the `@content` does not add the child to the saved component state - it is still regarded as an internal layout. 

Also, it is not possible to use the `@content` decorator *and* append children to the component (e.g. by using `append()` or the `@child` decorator). In this case, all children defined with the `@content` decorator will no longer be displayed.

```tsx
@Component
class ParentComponent extends UIX.ShadowDOMComponent {
    @layout componentTitle = <div>Component Title</div>
    @content customContent = <div>Content</div>
}

export default <ParentComponent/>
``` -->
