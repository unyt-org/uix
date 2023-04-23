# State Management

## Component states

All HTML attributes, children, and the `options` property are DATEX compatible and part of the component state by default.

Every change to those values or can be synced over DATEX.
The saved component state can also be stored (e.g. in the DATEX Pointer storage) and restored completely at any time (e.g. after a page reload).

Since UIX components are normal DATEX JS template classes, additional DATEX-exposed properties can be declared using the `@property` decorator:

```typescript
@UIX.Component class CustomComponent extends UIX.Components.Base {

    // declare custom restorable properties
    @property someText = 'default value'
    @property someMap = new Map<number,Set<number>>()
    @property textView!: UIX.Components.TextView

    onConstruct() {
        this.textView = new UIX.Components.TextView({text:'Hi'}); // the this.textView property is restored when the component is recreated
    }

    // called always after construction or recreation
    onInit() {
        this.logger.info(this.textView); // this.textView exists
    }
}

```

## Global states

Persistent values can also be created outside of components with the `eternal` label:
```typescript
const counter = eternal ?? $$(0); // counter value gets restored from the previous state or initialized
                                  // if no previous state exists
counter.val ++; // counter gets incremented every time
```

The complete UIX page state can also be created/restored as an `eternal` DATEX value (use `lazyEternal` to make sure the type definitions are loaded):

```typescript
export default await lazyEternal ?? $$(<div>Content</div>)
```

```typescript
export default await lazyEternal ?? $$(new UIX.Components.TextView({text:"Hi"}))
```