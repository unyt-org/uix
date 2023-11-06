# Component states

All HTML attributes, children, and the `options` property are DATEX compatible and part of the component state by default.

Every change to those values or can be synced over DATEX.
The saved component state can also be stored (e.g. in the DATEX Pointer storage) and restored completely at any time (e.g. after a page reload).

## The @property decorator
Since UIX components are [DATEX-compatible classes](https://docs.unyt.org/manual/datex/classes), additional DATEX state properties can be declared using the `@property` decorator.

In the following example a property `myVal` is declared that gets assigned to the value attribute of an input element (`HTMLInputElement`).
Modifing the inputs value will modify the value of the `myVal` property and vice versa.

```tsx
import { template } from "uix/html/template.ts";
import { Component } from "uix/components/Component.ts";

@template(function(this: CustomComponent) {
    return <div>
         <input value={this.$.myVal}/>
    </div>;
})
class CustomComponent extends Component {
    // declare property
    @poperty myVal = "myValue";
}
```

## Restorable state example

```tsx
import { template } from "uix/html/template.ts";
import { Component } from "uix/components/Component.ts";

@template() class CustomComponent extends Component {

    // declare custom restorable properties
    @property someText = 'default value'
    @property someMap = new Map<number,Set<number>>()
    @property textView!: HTMLDivElement

    onConstruct() {
        this.textView = <div>Hello World</div>; // the this.textView property is restored when the component is recreated
    }

    // called always after construction or recreation
    onInit() {
        this.logger.info(this.textView); // this.textView exists
        this.logger.info(this.someMap); // this.someMap exists
    }
}

```
