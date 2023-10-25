# The `@content` decorator

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
```
