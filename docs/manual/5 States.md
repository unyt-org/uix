# State Management

## Component states

The `options` and the `constraints` property are part of the component state by default and are exposed to DATEX.
Every change to the `options` or `constraints`, or any of their child properties is synced over DATEX and can be restored.

Since UIX components are normal DATEX JS template classes, additional DATEX-exposed properties can be declared using the `@property` decorator:

```typescript
@UIX.Component class CustomComponent extends UIX.Components.Base {

    // declare custom restorable properties
    @property someText = 'default value'
    @property someMap = new Map<number,Set<number>>()
    @property textView!: UIX.Components.TextView

    onConstruct() {
        this.textView = new UIX.Components.TextView({text:'Hi'}); // the this.textView property is restored when the component recreated
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
const counter = eternal ?? $$(0);
counter.val ++; // counter gets incremented every time the page is reloaded
```

The saved UIX page state can also be created/restored by using `eternal` DATEX Values (use `lazyEternal` to make sure the type definitions are loaded):

```typescript
export default await lazyEternal ?? $$(<div>Content</div>)
```

```typescript
export default await lazyEternal ?? $$(new UIX.Components.TextView({text:"Hi"}))
```